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
   * Resolves a property key to its value parser.
   *
   * On a StringPStream the key's exact span is scanned once (quote-aware,
   * identifier chars, String-compatible hashing, no allocation) and resolved
   * with one open-addressed probe — a profile put the previous per-character
   * PrefixAlt tree walk at ~18% of journal-replay CPU. Other PStreams (error
   * reporting) keep the PrefixAlt tree, built from the same entries.
   *
   * A miss returns null and the caller falls back to UnknownPropertyParser,
   * so an unknown key behaves exactly as before.
   */
  static final class PropertyKeyParser implements Parser {
    private PrefixAlt tree_    = EmptyPrefixAlt.instance();
    private String[]  keys_    = new String[8];
    private Parser[]  parsers_ = new Parser[8];
    private int       count_, mask_ = 7;

    void add(String name, Parser valueParser) {
      tree_ = tree_.add(name, valueParser);
      tree_ = tree_.add('"' + name + '"', valueParser);

      // keep the table at most quarter full so probe chains stay short
      if ( ( count_ + 1 ) * 4 > keys_.length ) grow();
      insert(name, valueParser);
      count_++;
    }

    void seal() {
      tree_ = tree_.rebalance();
    }

    private void grow() {
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
      if ( ! ( ps instanceof StringPStream ) ) return tree_.parse(ps, x);

      StringPStream sps = (StringPStream) ps;
      CharSequence  str = sps.getString();
      int len = str.length();
      int p0  = sps.pos();
      if ( p0 >= len ) return null;

      boolean quoted = str.charAt(p0) == '"';
      int start = quoted ? p0 + 1 : p0;

      // scan the key's span, hashing with String's own formula so the stored
      // keys' cached hashCode() values compare directly
      int i = start, h = 0;
      for ( ; i < len ; i++ ) {
        char c = str.charAt(i);
        if ( ! ( c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '$' ) ) break;
        h = h * 31 + c;
      }
      int keyLen = i - start;
      if ( keyLen == 0 ) return null;
      if ( quoted ) {
        if ( i >= len || str.charAt(i) != '"' ) return null;
        i++;
      }

      for ( int slot = h & mask_ ; keys_[slot] != null ; slot = ( slot + 1 ) & mask_ ) {
        String k = keys_[slot];
        if ( k.length() != keyLen || k.hashCode() != h ) continue;
        int j = 0;
        while ( j < keyLen && k.charAt(j) == str.charAt(start + j) ) j++;
        if ( j == keyLen ) return parsers_[slot].parse(sps.createAt(i), x);
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

    keys.seal();

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
