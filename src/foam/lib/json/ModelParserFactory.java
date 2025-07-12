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

public class ModelParserFactory {
  protected final static ConcurrentHashMap<ClassInfo, Parser> parsers_ = new ConcurrentHashMap<ClassInfo, Parser>();
  protected final static Parser COMMENTS = CommentParser.create();
  protected final static Parser OPTIONAL_COMMENTS = new Optional(COMMENTS);

  public static Parser getInstance(ClassInfo ci) {
    // Sync is required to avoid building one parser per AssemblyLine thread.
    synchronized ( ci ) {
      if ( parsers_.containsKey(ci) ) return parsers_.get(ci);

      Parser parser = buildInstance_(ci);
      parsers_.put(ci, parser);
      return parser;
    }
  }

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
}
