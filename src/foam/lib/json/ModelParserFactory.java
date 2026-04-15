/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lang.ClassInfo;
import foam.lang.PropertyInfo;
import foam.lib.parse.*;
import foam.parse.NewlineParser;
import java.lang.reflect.InvocationTargetException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Iterator;
import java.util.List;

class WS
  implements Parser
{

  public WS() {
  }
  public PStream parse(PStream ps, ParserContext x) {
    PStream ops = ps;

    while ( ps.valid() ) {
      char c = ps.head();
      if ( c == ' '  || c == '\t' || c == '\r' || c == '\n' ) {
        ps = ps.tail();
      } else {
        return ps == ops ? null : ps;
      }
    }

    return ps == ops ? null : ps;
  }

  public String toString() {
    return "WS";
  }
}

public class ModelParserFactory {
  protected final static ConcurrentHashMap<ClassInfo, Parser> parsers_ = new ConcurrentHashMap<ClassInfo, Parser>();
  protected final static Parser COMMENTS          = CommentParser.create();
  protected final static Parser OPTIONAL_COMMENTS = new Optional(COMMENTS);
  protected final static Parser UNKNOWN_PROPERTY  = new UnknownPropertyParser();

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

  /*
  public static Parser buildInstance_(ClassInfo info) {
    List     properties      = info.getAxiomsByClass(PropertyInfo.class);
    Parser[] propertyParsers = new Parser[properties.size() + 2]; // space for UnknownPropertyParser and Comment Parser
    Iterator iter            = properties.iterator();
    int      i               = 0;

    while ( iter.hasNext() ) {
      PropertyInfo pi = (PropertyInfo) iter.next();
      // If javaJSONParser: null, then don't add a PropertyParser for this field
      if ( pi.jsonParser() != null ) {
        propertyParsers[i] = PropertyParser.create(pi);
        i++;
      }
    }

    // Prevents failure to parse if unknown property found
    propertyParsers[i] = new UnknownPropertyParser();

    propertyParsers[i+1] = COMMENTS;

    return new Repeat0(
      new Seq0(OPTIONAL_COMMENTS,
        Whitespace.instance(), new Alt(propertyParsers)),
      Literal.create(",")
    );
  }
  */

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
      // Inlined value parser: skip ws, match ':', skip ws, parse value, set property.
      // Replaces Seq0(SKIP, Literal(':'), SKIP, valueParser) to eliminate
      // 4 combinator layers of virtual dispatch per property.
      Parser valueParser = new Parser() {
        public PStream parse(PStream ps, ParserContext x) {
          // Inline whitespace skip
          while ( ps.valid() ) {
            char c = ps.head();
            if ( c != ' ' && c != '\t' && c != '\r' && c != '\n' ) break;
            ps = ps.tail();
          }
          // Match ':'
          if ( ! ps.valid() || ps.head() != ':' ) return null;
          ps = ps.tail();
          // Inline whitespace skip
          while ( ps.valid() ) {
            char c = ps.head();
            if ( c != ' ' && c != '\t' && c != '\r' && c != '\n' ) break;
            ps = ps.tail();
          }
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
        boolean first = true;

        while ( true ) {
          // Skip whitespace (inline SKIP — no comment check needed between properties)
          while ( ps.valid() ) {
            char c = ps.head();
            if ( c != ' ' && c != '\t' && c != '\r' && c != '\n' ) break;
            ps = ps.tail();
          }

          // Try property name via PrefixAlt, then unknown property fallback
          PStream result = finalAlt.parse(ps, x);
          if ( result == null ) {
            result = unknownProperty.parse(ps, x);
          }
          if ( result == null ) break;
          ps = result;

          // Skip trailing whitespace
          while ( ps.valid() ) {
            char c = ps.head();
            if ( c != ' ' && c != '\t' && c != '\r' && c != '\n' ) break;
            ps = ps.tail();
          }

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
