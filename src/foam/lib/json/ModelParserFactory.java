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

  protected final static Parser SKIP              = new Repeat0(new Alt(new Seq0(Literal.create("//"),new Until(NewlineParser.create())), new WS()));

  public static Parser getInstance(ClassInfo ci) {
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
      // valueParser is the part of the key:value parser that happens after 'key'
      Parser valueParser = new Seq0(
        SKIP,
        Literal.create(":"),
        SKIP,
        new Parser() {
          public PStream parse(PStream ps, ParserContext x) {
            ps = pp.parse(ps, x);
            if ( ps == null ) return null;
            pi.set(x.get("obj"), ps.value());
            return ps;
          }
        }
      );

      alt = alt.add(pi.getName(),             valueParser);
      alt = alt.add('"' + pi.getName() + '"', valueParser);

      if ( pi.getShortName() != null ) {
        alt = alt.add(pi.getShortName(),             valueParser);
        alt = alt.add('"' + pi.getShortName() + '"', valueParser);
      }
    }

    alt = alt.rebalance();

    return new Repeat0(
      new Seq0(SKIP, new Alt(alt, UNKNOWN_PROPERTY), SKIP),
      Literal.create(",")
    );
  }
}
