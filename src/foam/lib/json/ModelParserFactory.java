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
    PrefixAlt alt        = EmptyPrefixAlt.instance();
    java.util.HashMap<String, Parser> valueParsers = new java.util.HashMap<>();

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

      valueParsers.put(pi.getName(), valueParser);
      alt = alt.add(pi.getName(),             valueParser);
      alt = alt.add('"' + pi.getName() + '"', valueParser);

      if ( pi.getShortName() != null ) {
        alt = alt.add(pi.getShortName(),             valueParser);
        alt = alt.add('"' + pi.getShortName() + '"', valueParser);
      }
    }

    alt = alt.rebalance();

    // Hashed key table: property names (and shortNames) resolve with one hash
    // probe over the key's exact span instead of a char-by-char walk of the
    // ternary PrefixAlt tree, which profiled at ~18% of replay CPU. Open
    // addressing, String-compatible hashing, built once per ClassInfo. The
    // PrefixAlt stays as the fallback for non-StringPStream inputs (error
    // reporting) — behavior there is unchanged.
    int keyCount = 0;
    iter = properties.iterator();
    while ( iter.hasNext() ) {
      PropertyInfo pi = (PropertyInfo) iter.next();
      if ( pi.jsonParser() == null ) continue;
      keyCount += pi.getShortName() != null ? 2 : 1;
    }
    int tableSize = Integer.highestOneBit(Math.max(4, keyCount) * 4 - 1) << 1;
    final String[] keys_       = new String[tableSize];
    final Parser[] keyParsers_ = new Parser[tableSize];
    final int      mask_       = tableSize - 1;

    iter = properties.iterator();
    while ( iter.hasNext() ) {
      PropertyInfo pi = (PropertyInfo) iter.next();
      Parser vp = valueParsers.get(pi.getName());
      if ( vp == null ) continue;
      String[] names = pi.getShortName() != null
        ? new String[] { pi.getName(), pi.getShortName() }
        : new String[] { pi.getName() };
      for ( String name : names ) {
        int slot = name.hashCode() & mask_;
        while ( keys_[slot] != null ) slot = ( slot + 1 ) & mask_;
        keys_[slot]       = name;
        keyParsers_[slot] = vp;
      }
    }

    // Inlined property loop: replaces Repeat0(Seq0(SKIP, Alt, SKIP), Literal(','))
    // to eliminate Repeat0 + Seq0 + Literal combinator overhead per property.
    final PrefixAlt finalAlt = alt;
    return new Parser() {
      final Parser unknownProperty = UNKNOWN_PROPERTY;

      /** Resolve the key at ps via the hash table; parses key + value or returns null. */
      private PStream parseKeyed(StringPStream sps, ParserContext x) {
        CharSequence str = sps.getString();
        int len   = str.length();
        int p0    = sps.pos();
        if ( p0 >= len ) return null;

        boolean quoted = str.charAt(p0) == '"';
        int start = quoted ? p0 + 1 : p0;

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
          if ( j == keyLen ) return keyParsers_[slot].parse(sps.createAt(i), x);
        }
        return null;
      }

      public PStream parse(PStream ps, ParserContext x) {
        while ( true ) {
          // Skip whitespace and // comments before the property name
          ps = SKIP.parse(ps, x);

          // Resolve the property name: hashed exact-span match on the fast
          // path, PrefixAlt on other PStreams, then unknown-property fallback
          PStream result = ps instanceof StringPStream
            ? parseKeyed((StringPStream) ps, x)
            : finalAlt.parse(ps, x);
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
