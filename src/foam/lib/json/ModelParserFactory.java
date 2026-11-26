/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lang.ClassInfo;
import foam.lang.PropertyInfo;
import foam.lib.parse.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Iterator;
import java.util.List;

public class ModelParserFactory {
  protected final static ConcurrentHashMap<ClassInfo, Parser> parsers_ = new ConcurrentHashMap<ClassInfo, Parser>();
  protected final static Parser UNKNOWN_PROPERTY  = new UnknownPropertyParser();

  // Skip whitespace AND single-line // comments between structural tokens.
  // A single flat Parser (one virtual dispatch per skip) rather than the old
  // Repeat0(Alt(Seq0(Literal,Until),WS)) combinator stack — keeps the perf win
  // while preserving inline-comment tolerance in FObject bodies.
  protected final static Parser SKIP              = new Parser() {
    public PStream parse(PStream ps, ParserContext x) {
      while ( ps.valid() ) {
        char c = ps.head();
        if ( c == ' ' || c == '\t' || c == '\r' || c == '\n' ) {
          ps = ps.tail();
          continue;
        }
        if ( c == '/' ) {
          PStream next = ps.tail();
          if ( next.valid() && next.head() == '/' ) {
            ps = next.tail();
            while ( ps.valid() ) {
              char nc = ps.head();
              if ( nc == '\n' || nc == '\r' ) { ps = ps.tail(); break; }
              ps = ps.tail();
            }
            continue;
          }
        }
        break;
      }
      return ps;
    }
  };

  /**
   * Resolves a property key to its value parser: hash the key's span, index
   * into two parallel arrays, step right on collision.
   *
   * The array index is the hash's LOW BITS: & mask_ keeps just enough bits to
   * address the slots (a full-hash array would need 2^32 slots). Different
   * hashes can share low bits — that is the only collision:
   *
   *   "fee".hashCode()     = ...0000110   & 15 = slot 6   empty: placed
   *   "country".hashCode() = ...0010110   & 15 = slot 6   taken: step right
   *
   *     slot:        6        7
   *     keys_:    [ fee ][ country ]
   *     parsers_: [ vp  ][   vp    ]
   *
   * Lookup replays the same moves without ever building a String for the key.
   * Slots are derived from mask_, so grow() re-inserts names, never copies.
   * A miss falls back to UnknownPropertyParser — unknown keys skip as before.
   */
  static final class PropertyKeyParser implements Parser {
    // Parallel arrays: slot i pairs a name with its value parser. Power-of-two
    // size makes '& mask_' equal 'mod size' in one instruction.
    private String[]  keys_    = new String[8];
    private Parser[]  parsers_ = new Parser[8];
    private int       count_, mask_ = 7;

    void add(String name, Parser valueParser) {
      // Lookups stay one-probe only while most slots are empty, so the table
      // is kept at most a quarter full; the cost is null slots (8 bytes each).
      if ( ( count_ + 1 ) * 4 > keys_.length ) grow();
      insert(name, valueParser);
      count_++;
    }

    private void grow() {
      // re-insert, never copy: the new mask_ derives new slots (see javadoc)
      String[] oldKeys    = keys_;
      Parser[] oldParsers = parsers_;
      keys_    = new String[oldKeys.length * 2];
      parsers_ = new Parser[oldKeys.length * 2];
      mask_    = keys_.length - 1;
      for ( int i = 0 ; i < oldKeys.length ; i++ ) {
        if ( oldKeys[i] != null ) insert(oldKeys[i], oldParsers[i]);
      }
    }

    private void insert(String name, Parser valueParser) {
      int slot = name.hashCode() & mask_;
      while ( keys_[slot] != null ) slot = ( slot + 1 ) & mask_;
      keys_[slot]    = name;
      parsers_[slot] = valueParser;
    }

    public PStream parse(PStream ps, ParserContext x) {
      if ( ! ( ps instanceof StringPStream ) ) return parseGeneric(ps, x);

      StringPStream sps = (StringPStream) ps;
      CharSequence  str = sps.getString();
      int len = str.length();
      int p0  = sps.pos();
      if ( p0 >= len ) return null;

      boolean quoted = str.charAt(p0) == '"';
      int start = quoted ? p0 + 1 : p0;

      // Short names are not always identifiers, and the journal writes them
      // unquoted: CSPViolation's document-uri:"http://a/b". So a quoted key
      // runs to its closing quote and an unquoted one to the ':' after it,
      // less any whitespace before that ':'.
      int i = start;
      while ( i < len && ! endsKey(str.charAt(i), quoted) ) i++;
      int keyLen = i - start;
      if ( ! quoted ) while ( keyLen > 0 && str.charAt(start + keyLen - 1) <= ' ' ) keyLen--;
      if ( keyLen == 0 ) return null;
      if ( quoted ) {
        if ( i >= len ) return null;
        i++;
      }

      // String.hashCode-compatible hash of the key's span
      int h = 0;
      for ( int k = 0 ; k < keyLen ; k++ ) h = h * 31 + str.charAt(start + k);

      // Probe from the hashed slot, stepping right exactly as insert() did.
      // An empty slot ends the search: the key is not a property. Two integer
      // rejects (length, cached hashCode) skip non-matches before the
      // char-by-char confirm — correctness never rests on the hash.
      for ( int slot = h & mask_ ; keys_[slot] != null ; slot = ( slot + 1 ) & mask_ ) {
        String k = keys_[slot];
        if ( k.length() != keyLen || k.hashCode() != h ) continue;
        int j = 0;
        while ( j < keyLen && k.charAt(j) == str.charAt(start + j) ) j++;
        if ( j == keyLen ) return parsers_[slot].parse(sps.createAt(i), x);
      }
      return null;
    }

    /** Where a key ends: its closing quote, or for an unquoted key the ':' after it. */
    private static boolean endsKey(char c, boolean quoted) {
      return quoted ? c == '"' : c == ':' || c == ',' || c == '}' || c == '"';
    }

    /** The same scan and lookup over any PStream — only the error-reporting streams take this path. */
    private PStream parseGeneric(PStream ps, ParserContext x) {
      if ( ! ps.valid() ) return null;

      boolean quoted = ps.head() == '"';
      if ( quoted ) ps = ps.tail();

      StringBuilder sb = new StringBuilder();
      while ( ps.valid() && ! endsKey(ps.head(), quoted) ) {
        sb.append(ps.head());
        ps = ps.tail();
      }
      if ( quoted ) {
        if ( ! ps.valid() ) return null;
        ps = ps.tail();
      } else {
        while ( sb.length() > 0 && sb.charAt(sb.length() - 1) <= ' ' ) sb.setLength(sb.length() - 1);
      }
      if ( sb.length() == 0 ) return null;

      String key = sb.toString();
      for ( int slot = key.hashCode() & mask_ ; keys_[slot] != null ; slot = ( slot + 1 ) & mask_ ) {
        if ( keys_[slot].equals(key) ) return parsers_[slot].parse(ps, x);
      }
      return null;
    }
  }

  public static Parser getInstance(ClassInfo ci) {
    if ( parsers_.containsKey(ci) ) return parsers_.get(ci);
    // Sync is required to avoid building one parser per AssemblyLine thread.
    synchronized ( ci ) {
      if ( parsers_.containsKey(ci) ) return parsers_.get(ci);

      Parser parser = buildInstance_(ci);
      parsers_.put(ci, parser);
      return parser;
    }
  }

  public static Parser buildInstance_(ClassInfo info) {
    List      properties = info.getAxiomsByClass(PropertyInfo.class);
    Iterator  iter       = properties.iterator();
    PropertyKeyParser keys = new PropertyKeyParser();

    while ( iter.hasNext() ) {
      final PropertyInfo pi = (PropertyInfo) iter.next();
      final Parser       pp = pi.jsonParser();

      // If javaJSONParser: null, then don't add a PropertyParser for this field
      if ( pp == null ) continue;

      //      System.err.println("PI " + pi.getName() + " " + pp);
      // Value parser: skip (ws + comments), match ':', skip, parse value, set
      // property. SKIP replaces the Seq0(SKIP, Literal(':'), SKIP, valueParser)
      // combinator layers with one dispatch per skip.
      Parser valueParser = new Parser() {
        public PStream parse(PStream ps, ParserContext x) {
          ps = SKIP.parse(ps, x);
          // Match ':'
          if ( ! ps.valid() || ps.head() != ':' ) return null;
          ps = ps.tail();
          ps = SKIP.parse(ps, x);
          // Parse value and set property
          ps = pp.parse(ps, x);
          if ( ps == null ) return null;
          pi.set(x.get("obj"), ps.value());
          return ps;
        }
      };

      keys.add(pi.getName(), valueParser);
      if ( pi.getShortName() != null ) keys.add(pi.getShortName(), valueParser);
    }

    // Inlined property loop: replaces Repeat0(Seq0(SKIP, Alt, SKIP), Literal(','))
    // to eliminate Repeat0 + Seq0 + Literal combinator overhead per property.
    final PropertyKeyParser finalKeys = keys;
    return new Parser() {
      final Parser unknownProperty = UNKNOWN_PROPERTY;

      public PStream parse(PStream ps, ParserContext x) {
        while ( true ) {
          // Skip whitespace and // comments before the property name
          ps = SKIP.parse(ps, x);

          // Resolve the property key, then unknown property fallback
          PStream result = finalKeys.parse(ps, x);
          if ( result == null ) {
            result = unknownProperty.parse(ps, x);
          }
          if ( result == null ) break;
          ps = result;

          // Skip trailing whitespace and // comments
          ps = SKIP.parse(ps, x);

          // Inline comma check (replaces Literal(',') delimiter in Repeat0)
          if ( ps.valid() && ps.head() == ',' ) {
            ps = ps.tail();
          } else {
            break;
          }
        }

        return ps;
      }
    };
  }
}
