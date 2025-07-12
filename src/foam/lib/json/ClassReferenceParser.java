/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lang.ClassInfo;
import foam.lang.XLocator;
import foam.lib.parse.*;

public class ClassReferenceParser
  extends ProxyParser
{
  private final static Parser instance__ = new ClassReferenceParser();

  public static Parser instance() { return instance__; }

  private ClassReferenceParser() {
    super(new Alt(
      NullParser.instance(),
      new Seq1(15,
        Whitespace.instance(),
        Literal.create("{"),
        Whitespace.instance(),
        new KeyParser("class"),
        Whitespace.instance(),
        Literal.create(":"),
        Whitespace.instance(),
        Literal.create("\"__Class__\""),
        Whitespace.instance(),
        Literal.create(","),
        Whitespace.instance(),
        new KeyParser("forClass_"),
        Whitespace.instance(),
        Literal.create(":"),
        Whitespace.instance(),
        StringParser.instance(),
        Whitespace.instance(),
        Literal.create("}")),
      StringParser.instance()
    ));
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( ( ps = super.parse(ps, x)) == null ) {
      return null;
    }

    if ( ps.value() == null ) {
      return ps;
    }

    String classId = (String) ps.value();
    // Expects classId be a fully qualified name of a modelled class
    // with Java code generation for class lookup and returns
    // ClassInfo of the modelled class if found, otherwise return null.
    //
    // Eg.,
    // When parsing "foam.core.auth.User", returns User.getOwnClassInfo().
    //
    // And when parsing "java.lang.Object", returns null
    // because java.lang.Object is not a modelled class.
    ClassInfo info = XLocator.get().getClassInfo(classId);

    if ( info != null )
      return ps.setValue(info);

    String msg = classId + " is not a modelled class.";
    System.err.println(msg);
    x.set("error", msg);
    throw new RuntimeException(msg);
  }
}
