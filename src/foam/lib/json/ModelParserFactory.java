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

      alt = alt.add(pi.getName(),             valueParser);
      alt = alt.add('"' + pi.getName() + '"', valueParser);

      if ( pi.getShortName() != null ) {
        alt = alt.add(pi.getShortName(),             valueParser);
        alt = alt.add('"' + pi.getShortName() + '"', valueParser);
      }
    }

    alt = alt.rebalance();

    // Inlined property loop: replaces Repeat0(Seq0(SKIP, Alt, SKIP), Literal(','))
    // to eliminate Repeat0 + Seq0 + Literal combinator overhead per property.
    final PrefixAlt finalAlt = alt;
    return new Parser() {
      final Parser unknownProperty = UNKNOWN_PROPERTY;

      public PStream parse(PStream ps, ParserContext x) {
        while ( true ) {
          // Skip whitespace and // comments before the property name
          ps = SKIP.parse(ps, x);

          // Try property name via PrefixAlt, then unknown property fallback
          PStream result = finalAlt.parse(ps, x);
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
