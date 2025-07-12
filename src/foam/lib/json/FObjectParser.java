/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lang.*;
import foam.lib.parse.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

public class FObjectParser
  extends ObjectNullParser
{
  private final static Map    map__      = new ConcurrentHashMap();
  private final static Parser instance__ = new FObjectParser();

  public static Parser instance() {
    return instance__ == null ?
      new ProxyParser() { public Parser getDelegate() { return instance__; } } :
      instance__;
  }

  /**
   * Implement the multiton pattern so we don't create the same
   * parser more than once.
   **/
  public static Parser create(Class cls) {
    if ( cls == null ) return instance();

    Parser p = (Parser) map__.get(cls.getName());

    if ( p == null ) {
      p = new FObjectParser(cls);
      map__.put(cls.getName(), p);
    }

    return p;
  }

  public FObjectParser(final Class defaultClass) {
    super(new Seq1(3,
      Whitespace.instance(),
      Literal.create("{"),
      Whitespace.instance(),
      new Parser() {
        private Parser delegate = new Seq1(4,
            new KeyParser("class"),
            Whitespace.instance(),
            Literal.create(":"),
            Whitespace.instance(),
            StringParser.instance(),
            new Optional(Literal.create(",")));

        public PStream parse(PStream ps, ParserContext x) {
          PStream originalPS = ps;

          try {
            PStream   ps1 = ps.apply(delegate, x);
            Class     c   = null;
            ClassInfo ci  = null;
            X         ctx = (X) x.get("X");

            if ( ps1 != null ) {
              var className = ps1.value().toString();

               ci = ctx.getClassInfo(className);

              if ( ci == null ) {
                try {
                  c = Class.forName(className);
                } catch (ClassNotFoundException t) {
                }
              } else {
                c = ci.getObjClass();
              }
            } else {
              c = defaultClass;
            }

            ParserContext subx = x.sub();
            Parser        subParser;

            if ( c == null && ci == null ) {
              if ( ps1 == null ) return null;

              // If the class doesn't exist, try creating an object using the class name
              Object obj = ctx.create(ps1.value().toString());
              subx.set("obj", obj);
              subParser = ModelParserFactory.getInstance(SimpleFacetManager.getClassInfo(obj.getClass()));
            } else {
              if ( c == foam.lang.FObject.class ) return null;

              if ( c != null && c.isEnum() ) {
                subx.set("enum", c);
                subParser = EnumParserFactory.getInstance(c);
              } else {
                FObject obj = ci == null ? (FObject) ctx.create(c) : (FObject) ci.newInstance() ;
                obj.setX(ctx);

                subx.set("obj", obj);
                if ( ci == null )
                  ci = SimpleFacetManager.getClassInfo(obj.getClass());

                subParser = ModelParserFactory.getInstance(ci);
              }
            }

            // Ensure that apply method is not invoked on null value
            if ( ps1 != null ) ps = ps1;

            ps = ps.apply(subParser, subx);

            if ( ps != null ) {
              var ret = subx.get("obj");
              if ( ret instanceof FObject )
                ((FObject) ret).init_();

              return ps.setValue(ret);
            }
            return null;
          } catch (Throwable t) {
            // t.printStackTrace();
            x.set("error", t);
            throw new RuntimeException(t);
          }
        }
      },
      Whitespace.instance(),
      Literal.create("}")));
  }

  public FObjectParser() {
    this(null);
  }

  public PStream parse(PStream ps, ParserContext x) {
    return getDelegate().parse(ps, x);
  }
}
