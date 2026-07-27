/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.parse;

import foam.lang.*;
import foam.lib.json.BooleanParser;
import foam.lib.json.NullParser;
import foam.lib.json.Whitespace;
import foam.lib.parse.*;
import foam.lib.parse.Action;
import foam.lib.parse.Optional;
import foam.mlang.*;
import foam.mlang.expr.*;
import foam.mlang.predicate.*;
import foam.mlang.predicate.Not;
import foam.util.SafetyUtil;
import java.lang.Exception;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import static foam.mlang.MLang.*;


public class FScriptParser {
  private final static Parser ESCAPED_QUOTE_PARSER = new Literal("\\\"", "\"");

  private final static Map map__ = new ConcurrentHashMap();

  /**
   * Implement the multiton pattern so we don't create the same
   * parser more than once.
   **/
  public static FScriptParser create(PropertyInfo prop) {
    FScriptParser p = (FScriptParser) map__.get(prop);

    if ( p == null ) {
      p = new FScriptParser(prop);
      map__.put(prop, p);
    }

    return p;
  }

  public static FScriptParser create(ClassInfo cls) {
    FScriptParser p = (FScriptParser) map__.get(cls.getId());

    if ( p == null ) {
      p = new FScriptParser(cls);
      map__.put(cls.getId(), p);
    }

    return p;
  }

  public static FScriptParser create(ClassInfo classInfo, List expressions) {
    if ( expressions == null ||
         expressions.size() == 0 ) {
      return FScriptParser.create(classInfo);
    }

    StringBuilder sb = new StringBuilder();
    sb.append(classInfo.getId());
    for ( Object exp : expressions ) {
      sb.append(exp.toString());
    }
    String key = sb.toString();

    FScriptParser p = (FScriptParser) map__.get(key);

    if ( p == null ) {
      p = new FScriptParser(classInfo, expressions);
      map__.put(key, p);
    }

    return p;
  }

  protected ClassInfo classInfo_;
  protected List      expressions;
  protected Grammar   grammar_;

  private FScriptParser(PropertyInfo property) {
    Map<String, PropertyInfo> props = new HashMap();
    props.put("thisValue", property);
    setup(property.getClassInfo(), props);
    grammar_ = getGrammar();
  }

  private FScriptParser(ClassInfo classInfo) {
    Map props = new HashMap<String, PropertyInfo>();
    setup(classInfo, props);
    grammar_ = getGrammar();
  }

  private FScriptParser(ClassInfo classInfo, List expressions) {
    Map props = new HashMap<String, PropertyInfo>();
    setup(classInfo, props);
    addExpressions(expressions);
    grammar_ = getGrammar();
  }

  private void addExpressions(List expressions) {
    this.expressions.addAll(expressions);
    this.expressions.sort(Comparator.comparing(LiteralIC::getString).reversed());
    // foam.core.logger.StdoutLogger.instance().info(this.getClass().getSimpleName(), "expressions", this.expressions.stream().map(Object::toString).collect(java.util.stream.Collectors.joining(",")));
  }

  /**
   * return copy, for inspection only
   */
  public List getExpressions() {
    return new ArrayList(expressions);
  }

  public void setup(ClassInfo classInfo, Map<String, PropertyInfo> props) {
    classInfo_  = classInfo;
    expressions = new ArrayList();
    List<PropertyInfo> properties = classInfo_.getAxiomsByClass(PropertyInfo.class);

    for ( PropertyInfo prop : properties ) {
      props.put(prop.getName(), prop);

      if ( ! SafetyUtil.isEmpty(prop.getShortName()) ) {
        props.put(prop.getShortName(), prop);
      }

      if ( prop.getAliases().length != 0 ) {
        for ( int i = 0 ; i < prop.getAliases().length ; i++) {
          props.put(prop.getAliases()[i], prop);
        }
      }
    }

    ArrayList<String> sortedKeys = new ArrayList<String>(props.keySet());

    Collections.sort(sortedKeys, Collections.reverseOrder());
    for (String propName : sortedKeys) {
      expressions.add(new LiteralIC(propName, props.get(propName)));
    }
  }

  public Object parse(String s) {
    StringPStream ps = new StringPStream();

    ps.setString(s);
    PStream ret = parse(ps, new ParserContextImpl());

    return ret == null ? null : ret.value();
  }

  public PStream parse(PStream ps, ParserContext x) {
    return grammar_.parse(ps, x, "");
  }

  protected Grammar getGrammar() {
    Grammar grammar = new Grammar();
    grammar.addSymbol("FIELD_NAME",   new Alt(new Alt(expressions)));
    grammar.addSymbol("START",        new Seq1(1, new Optional(grammar.sym("LET")), grammar.sym("START_VALUES"), EOF.instance()));
    grammar.addSymbol("START_VALUES", new Alt(grammar.sym("OR"), grammar.sym("TEMPLATE_STRING"), grammar.sym("FORMULA"), grammar.sym("IF_ELSE")));

    grammar.addSymbol(
      "OR",
      new Repeat(grammar.sym("AND"), Whitespace.wrap(Literal.create("||")), 1)
    );
    grammar.addAction("OR", (val, x) -> {
      Object[] values = (Object[])val;
      if ( values.length == 1 ) return values[0];

      Or or = new Or();
      Predicate[] args = new Predicate[values.length];
      for ( int i = 0 ; i < args.length ; i++ ) {
        args[i] = (Predicate) values[i];
      }
      or.setArgs(args);
      return or;
    });

    grammar.addSymbol(
      "AND",
       new Repeat(grammar.sym("EXPR"), Whitespace.wrap(Literal.create("&&")), 1)
    );

    grammar.addAction("AND", (val, x) -> {
      Object[] valArr = (Object[]) val;
      if ( valArr.length == 1 ) return valArr[0];

      And and = new And();
      Predicate[] args = new Predicate[valArr.length];
      for ( int i = 0 ; i < valArr.length ; i++ ) {
        args[i] = (Predicate) valArr[i];
      }
      and.setArgs(args);
      return and;
    });

    grammar.addSymbol("EXPR", Whitespace.wrap(new Alt(
      grammar.sym("PAREN"),
      grammar.sym("NEGATE"),
      grammar.sym("INSTANCE_OF"),
      grammar.sym("CLASS_OF"),
      grammar.sym("UNARY"),
      grammar.sym("COMPARISON")
    )));

    grammar.addSymbol("PAREN", new Seq1(1,
      Literal.create("("),
      grammar.sym("OR"),
      Literal.create(")")));

    grammar.addSymbol("FORM_PAREN", new Seq1(1,
      Literal.create("("),
      grammar.sym("FORMULA"),
      Literal.create(")")));

    grammar.addSymbol("NEGATE", new Seq1(1, new LiteralIC("!"), grammar.sym("OR")));
    grammar.addAction("NEGATE", (val, x) -> {
      foam.mlang.predicate.Not predicate = new foam.mlang.predicate.Not();
      predicate.setArg1((Predicate) val);
      return predicate;
    });

    grammar.addSymbol("COMPARISON", new Seq(
      grammar.sym("VALUE"),
      Whitespace.wrap(new Alt(
        new AbstractLiteral("==")  {
          @Override
          public Object value() {
            return new Eq();
          }
        },
        new AbstractLiteral("!=")  {
          @Override
          public Object value() {
            return new Neq();
          }
        },
        new AbstractLiteral("<=")  {
          @Override
          public Object value() {
            return new Lte();
          }
        },
        new AbstractLiteral(">=")  {
          @Override
          public Object value() {
            return new Gte();
          }
        },
        new AbstractLiteral("<")  {
          @Override
          public Object value() {
            return new Lt();
          }
        },
        new AbstractLiteral(">")  {
          @Override
          public Object value() {
            return new Gt();
          }
        },
        new AbstractLiteral("~")  {
          @Override
          public Object value() {
            return new RegExp();
          }
        },
        new AbstractLiteral(":")  {
          @Override
          public Object value() {
            return new In();
          }
        }
      )),
      new Alt(
        grammar.sym("VALUE"),
        NullParser.instance()
      ))
    );

    grammar.addAction("COMPARISON", (val, x) -> {
      Object[] values = (Object[]) val;
      if ( values[1] instanceof foam.mlang.predicate.RegExp ) {
        RegExp regex = ( RegExp ) values[1];
        regex.setArg1((Expr) values[0]);
        try {
          regex.setRegExp((Pattern) values[2]);
        } catch (Exception e) {
          //logger
          return null;
        }
        return regex;
      }

      Binary bin = ( Binary ) values[1];
      bin.setArg1(( values[0] instanceof Expr ) ? ( Expr ) values[0] : new foam.mlang.Constant (values[0]));
      bin.setArg2(( values[2] instanceof Expr ) ? ( Expr ) values[2] : new foam.mlang.Constant (values[2]));
      return bin;
    });

    grammar.addSymbol(
      "FORMULA",
      new Repeat(grammar.sym("MINUS"), Whitespace.wrap(Literal.create("+")), 1)
    );
    grammar.addAction("FORMULA", (val, x) -> {
      Object[] vals = (Object[]) val;
      if ( vals[0] == null  ) return null;
      if ( vals.length == 1 ) return vals[0];

      Expr[] args = new Expr[vals.length];
      for ( int i = 0 ; i < vals.length ; i++ ) {
        args[i] = (Expr) vals[i];
      }
      Formula formula = new Add();
      formula.setArgs(args);
      return formula;
    });

    grammar.addSymbol(
      "MINUS",
      new Repeat(grammar.sym("FORM_EXPR"), Whitespace.wrap(Literal.create("-")), 1)
    );
    grammar.addAction("MINUS", (val, x) -> {
      Object[] vals = (Object[]) val;
      if ( vals[0] == null ) return null;
      if ( vals.length == 1 ) return vals[0];

      Expr[] args = new Expr[vals.length];
      for ( int i = 0 ; i < vals.length ; i++ ) {
        if ( vals[i] instanceof If && ! isPropNumber(((If) vals[i]).getTrueExpr())) return Action.NO_PARSE;
        args[i] = (Expr)vals[i];
      }
      Formula formula = new Subtract();
      formula.setArgs(args);
      return formula;
    });

    grammar.addSymbol("FORM_EXPR", new Seq(
      // lhs
      grammar.sym("FORM_VALUE"),
      new Alt(
        new Repeat(
          new Seq(
            // MUL or DIV
            Whitespace.wrap(new Alt(
              new AbstractLiteral("*") {
                @Override
                public Object value() {
                  return new Multiply();
                }
              },
              new AbstractLiteral("/") {
                @Override
                public Object value() {
                  return new Divide();
                }
              }
            )),
            // rhs
            grammar.sym("FORM_VALUE")
          ), 1),
        new foam.lib.parse.Not(
          new Alt(new Seq(Whitespace.instance(), Literal.create("*")), new Seq(Whitespace.instance(), Literal.create("/")))
        )
      )
    ));
    grammar.addAction("FORM_EXPR", (val, x) -> {
      Object[] vals = (Object[]) val;
      if ( vals[0] instanceof Expr && ! isPropNumber((Expr)vals[0]) || (vals[0] instanceof Dot) ||
        vals[0] instanceof Constant && ((Constant)vals[0]).f(null) instanceof String
      ) {
        return Action.NO_PARSE;
      }

      // handle left hand side (lhs) value as formula without MUL or DIV operator and right hand side (rhs) value
      // v[0] is lhs value and v[1] is null or empty
      if ( vals.length == 1 || vals[1] == null || ! (vals[1] instanceof Object[]) || ((Object[])vals[1]).length == 0 ) return ( vals[0] instanceof Expr ) ? vals[0] : new foam.mlang.Constant (vals[0]);


      // handle formula with lhs value followed by MUL or DIV and rhs value
      // v[0] is the lhs and v[1] contains an array of [MUL or DIV, rhs]
      // Eg.
      //    v = [ 1,
      //          [
      //            [ '*', 2 ],
      //            [ '/', 3 ]
      //          ]
      //        ];
      //
      // will return DIV(MUL(1, 2), 3) which is 1*2/3
      var lhs       = ( vals[0] instanceof Expr ) ? (Expr) vals[0] : new Constant(vals[0]);
      var formulas  = (Object[]) vals[1];
      var f0        = (Object[]) formulas[0];
      var formula   = (Formula) f0[0];
      var rhs       = ( f0[1] instanceof Expr ) ? (Expr) f0[1] : new Constant(f0[1]);

      formula.setArgs(new Expr[] { lhs, rhs });
      for ( int i = 1 ; i < formulas.length ; i++ ) {
        var fi = (Object[]) formulas[i];
        var next = (Formula) fi[0];
        var nextVal = ( fi[1] instanceof Expr ) ? (Expr) fi[1] : new Constant (fi[1]);
        next.setArgs(new Expr[] { formula, nextVal });
        formula = next;
      }
      return formula;
    });

    grammar.addSymbol("FORM_VALUE", new Alt(
      grammar.sym("FORM_PAREN"),
      grammar.sym("NUMBER"),
      grammar.sym("FIELD_LEN"),
      grammar.sym("FIELD"),
      grammar.sym("MAX"),
      grammar.sym("MIN"),
      grammar.sym("IF_ELSE")
    ));

    grammar.addSymbol("IF_ELSE", new SeqI(new int[] { 5, 11,14 },
      Whitespace.instance(),
      Literal.create("if"),
      Whitespace.instance(),
      Literal.create("("),
      Whitespace.instance(),
      grammar.sym("OR"),
      Whitespace.instance(),
      Literal.create(")"),
      Whitespace.instance(),
      Literal.create("{"),
      new Alt(NewlineParser.create(), Whitespace.instance()),
      new Alt(
        grammar.sym("START_VALUES"),
        grammar.sym("VALUE")
      ),
      new Alt(NewlineParser.create(), Whitespace.instance()),
      Literal.create("}"),
      new Optional(
        new Seq1(5,
          new Alt(NewlineParser.create(), Whitespace.instance()),
          Literal.create("else"),
          Whitespace.instance(),
          Literal.create("{"),
          new Alt(NewlineParser.create(), Whitespace.instance()),
          new Alt(
            grammar.sym("START_VALUES"),
            grammar.sym("VALUE")
          ),
          new Alt(NewlineParser.create(), Whitespace.instance()),
          Literal.create("}")
        )
      )
    ));

    grammar.addAction("IF_ELSE", (val, x) -> {
      Object[] vals = (Object[]) val;
      var ifelse = new If();
      ifelse.setPredicate((Predicate) vals[0]);
      ifelse.setTrueExpr((Expr) vals[1]);
      if ( vals.length > 2 ) ifelse.setFalseExpr((Expr) vals[2]);
      return ifelse;
    });

    grammar.addSymbol("LET", new SeqI(new int[] { 2, 6 },
      Literal.create("let"),
      Whitespace.instance(),
      grammar.sym("WORD"),
      Whitespace.instance(),
      Literal.create("="),
      Whitespace.instance(),
      grammar.sym("VALUE"),
      Literal.create(";"),
      Whitespace.instance()
    ));

    grammar.addAction("LET", (val, x) -> {
      Object[] vals = (Object[]) val;
      if (vals.length < 2 ) return null;
      x.set((String) vals[0], vals[1]);
      return val;
    });

    grammar.addSymbol("UNARY", new Seq(grammar.sym("VALUE"), Whitespace.instance(),
      new Alt(
        new AbstractLiteral("exists") {
          public Object value() {
            return new Has();
          }
        },
        new AbstractLiteral("!exists") {
          @Override
          public Object value() {
            return new Not(new Has());
          }
        },
        new AbstractLiteral("isValid") {
          @Override
          public Object value() {
            return new IsValid();
          }
        }
      ),
      new Optional(grammar.sym("VALUE"))));

    grammar.addAction("UNARY", (val, x) -> {
      Object[] values = (Object[]) val;
      Predicate pred = (Predicate) values[2];
      if ( pred instanceof Not ) {
        ((Unary) ((Not) pred).getArg1()).setArg1((Expr) values[0]);
        return pred;
      }
      ((Unary) pred).setArg1((Expr) values[0]);
      return pred;
    });

    grammar.addSymbol("INSTANCE_OF", new Seq2(0, 2,
      new Optional(grammar.sym("FIELD")),
      Whitespace.wrap(Literal.create("instanceof")),
      grammar.sym("CLASS_INFO")));

    grammar.addAction("INSTANCE_OF", (val, x) -> {
      Object[] vals = (Object[]) val;
      ClassInfo cls = (ClassInfo) vals[1];
      IsInstanceOf pred = new IsInstanceOf();
      pred.setOf(cls);
      if ( vals[0] != null ) {
        pred.setPropExpr((Expr) vals[0]);
      }
      return pred;
    });

    grammar.addSymbol("CLASS_OF", new Seq2(0, 2,
      new Optional(grammar.sym("FIELD")),
      Whitespace.wrap(Literal.create("classof")),
      grammar.sym("CLASS_INFO")));

    grammar.addAction("CLASS_OF", (val, x) -> {
      Object[] vals = (Object[]) val;
      ClassInfo cls = (ClassInfo) vals[1];
      IsClassOf pred = new IsClassOf();
      pred.setOf(cls);
      if ( vals[0] != null ) {
        pred.setPropExpr((Expr) vals[0]);
      }
      return pred;
    });

    grammar.addSymbol("VALUE", new Alt(
      grammar.sym("YEARS"),
      grammar.sym("MONTHS"),
      grammar.sym("DAYS"),
      grammar.sym("HOURS"),
      grammar.sym("MINUTES"),
      grammar.sym("REGEX"),
      grammar.sym("DATE"),
      grammar.sym("VAR"),
      grammar.sym("STRING"),
      BooleanParser.instance(),
      NullParser.instance(),
      grammar.sym("FORMULA"),
      grammar.sym("NUMBER"),
      grammar.sym("FIELD_LEN"),
      grammar.sym("ENUM"),
      grammar.sym("FIELD")
    ));

    grammar.addSymbol("REGEX", new Seq2(
      1, 3, Literal.create("/"),
      new Repeat(new Alt(Literal.create("\\/"), new NotChars("/"))),
      Literal.create("/"),
      new Optional(new Repeat(
        new Alt(
          Literal.create("i"), //CASE_INSENSITIVE
          Literal.create("m"), //MULTILINE
          Literal.create("s"), //DOTALL
          Literal.create("x") //COMMENTS
        ), 1
      ))
    ));
    grammar.addAction("REGEX", (val, x) -> {
      Object[] vals = (Object[]) val;
      HashMap hm = new HashMap();
      hm.put("i", Pattern.CASE_INSENSITIVE);
      hm.put("m", Pattern.MULTILINE);
      hm.put("s", Pattern.DOTALL);
      hm.put("x", Pattern.COMMENTS);
      var flags = -1;
      if ( vals[1] != null ) {
        Object[] flagsArr = (Object[]) vals[1];
        for (int i = 0 ; i < flagsArr.length-1 ; i++ ) {
          var en = hm.get(flagsArr[i]);
          flags = en == null ? flags : flags | (int) en;
        }
      }
      return flags < 0 ? Pattern.compile(compactToString(vals[0])) : Pattern.compile(compactToString(vals[0]), flags);
    });

    grammar.addSymbol("DATE", new Alt(
      Literal.create("now"),
      Literal.create("minDate"),
      Literal.create("maxDate"),
      new Seq(
        grammar.sym("NUMBER"),
        new Alt(Literal.create("-"), Literal.create("/")),
        grammar.sym("NUMBER"),
        new Alt(Literal.create("-"), Literal.create("/")),
        grammar.sym("NUMBER"),
        Literal.create("T"),
        grammar.sym("NUMBER"),
        Literal.create(":"),
        grammar.sym("NUMBER")
      ),
      new Seq(
        grammar.sym("NUMBER"),
        new Alt(Literal.create("-"), Literal.create("/")),
        grammar.sym("NUMBER"),
        new Alt(Literal.create("-"), Literal.create("/")),
        grammar.sym("NUMBER"),
        Literal.create("T"),
        grammar.sym("NUMBER")
      ),
      new Seq(
        grammar.sym("NUMBER"),
        new Alt(Literal.create("-"), Literal.create("/")),
        grammar.sym("NUMBER"),
        new Alt(Literal.create("-"), Literal.create("/")),
        grammar.sym("NUMBER")
      ),
      new Seq(
        grammar.sym("NUMBER"),
        new Alt(Literal.create("-"), Literal.create("/")),
        grammar.sym("NUMBER")
      )
    ));
    grammar.addAction("DATE", (val, x) -> {
      if ( "now".equals(val) ) return MLang.NOW;
      // min-date and max-date should be kept consistent with js version
      // in stdlib.js
      if ( "minDate".equals(val) ) return new Date(-8640000000000000L);
      if ( "maxDate".equals(val) ) return new Date(8640000000000000L);
      Calendar start = new GregorianCalendar();
      start.clear();
      start.setTimeZone(TimeZone.getTimeZone("UTC"));

      Object[] result = (Object[]) val;
      var dateFmt = result.length;
      int year = dateFmt >=  3 ? (Integer) result[0] : 0;
      if ( year < 0 ) {
        start.set(Calendar.ERA, GregorianCalendar.BC);
        year = (Integer) result[0]*-1;
      }

      start.set(
        year,
        dateFmt >= 3 ? (Integer) result[2] - 1 : 0,
        dateFmt >= 5 ? (Integer) result[4]     : 0,
        dateFmt >= 7 ? (Integer) result[6]     : 0,
        dateFmt >= 9 ? (Integer) result[8]     : 0);

      return start.getTime();
    });

    grammar.addSymbol("STRING", new Alt(
      new Seq1(1,
        Literal.create("\""),
        new Repeat(new Alt(
          ESCAPED_QUOTE_PARSER,
          new NotChars("\"")
        )),
        Literal.create("\"")
      )
    ));
    grammar.addAction("STRING", (val, x) -> compactToString(val));
    var stringParser = new Repeat(new NotChars("{{"));
    var stringParser2 = new Repeat(new Alt(
      ESCAPED_QUOTE_PARSER,
      new NotChars("}}")
    ));

    grammar.addSymbol("TEMPLATE_STRING", new Seq2(0,2,
      new Repeat(
        new Seq(new Until(Literal.create("{{")), new Repeat(new foam.lib.parse.Not(Literal.create("}}"), AnyChar.instance()))
        ), Literal.create("}}"), 1),
      Literal.create("}}"),
      new Optional(new Repeat(AnyChar.instance()))
    ));
//    grammar.addSymbol("TEMPLATE_STRING", new Seq( new Until(Literal.create("}}")), new Repeat(new Alt(new Seq1(1, Literal.create("{{"), new Until(Literal.create("}}"))), AnyChar.instance()))));

    grammar.addAction("TEMPLATE_STRING", (val, x) -> {
      Object[] vals = (Object[]) val;
      Object[] repeat = (Object[]) vals[0];
      String ret = "";
      for ( Object v : repeat )  {
        Object[] seq = (Object[]) v;
        ret += compactToString(seq[0]);
        ret += "{{" + compactToString(seq[1]) + "}}";
      }
      ret += compactToString(vals[1]);
      if ( vals.length == 3 ) {
        ret += compactToString(vals[2]);
      }
      var templStr = new TemplateString();
      templStr.setString(ret);
      return templStr;
    });

    grammar.addSymbol("ENUM", new Seq(
      grammar.sym("WORD"),
      new Repeat(
        new Seq(
          Literal.create("."),
          grammar.sym("WORD")
        )
      )
    ));
    grammar.addAction("ENUM", (val, x) -> {
      Object[] values = (Object[]) val;
      Object[] pckArr = (Object[]) values[1];
      if ( pckArr.length == 0 ) {
        try {
          var field = this.classInfo_.getObjClass().getDeclaredField((String) values[0]).get(null);
          if ( field != null ) return field;
        } catch (Exception e) {
          return Action.NO_PARSE;
        }
      }
      var sb = new StringBuilder();
      sb.append(values[0]);
      for ( int i = 0 ; pckArr.length - 1 > i ; i ++) {
        sb.append(compactToString(pckArr[i]));
      }
      Class cls;
      try {
        cls = Class.forName(sb.toString());
      } catch (ClassNotFoundException e) {
        return Action.NO_PARSE;
      }
      String name = (String)((Object[]) pckArr[pckArr.length-1])[1];
      if ( ! cls.isEnum() ) return null;
      for (int i = 0 ; cls.getEnumConstants().length > i ; i ++ ) {
        Enum en= (Enum) cls.getEnumConstants()[i];
        if ( en.name().equals(name)) return en;
      }
      return Action.NO_PARSE;
    });

    grammar.addSymbol("CLASS_INFO", new Seq(
      grammar.sym("WORD"),
      new Repeat(
        new Seq(
          Literal.create("."),
          grammar.sym("WORD")
        )
      )
    ));
    grammar.addAction("CLASS_INFO", (val, x) -> {
      Object[] values = (Object[]) val;
      Object[] pckArr = (Object[]) values[1];
      if ( pckArr.length == 0 ) {
        try {
          var field = this.classInfo_.getObjClass().getDeclaredField((String) values[0]).get(null);
          if ( field != null ) return field;
        } catch (Exception e) {
          return null;
        }
      }
      var sb = new StringBuilder();
      sb.append(values[0]);
      for ( int i = 0; pckArr.length > i; i ++) {
        sb.append(compactToString(pckArr[i]));
      }
      try {
        return Class.forName(sb.toString()).getMethod("getOwnClassInfo") .invoke(null);
      } catch (Exception e) {
        return Action.NO_PARSE;
      }
    });

    grammar.addSymbol("WORD", new Repeat(
      grammar.sym("CHAR"), 1
    ));
    grammar.addAction("WORD", (val, x) -> {
      var ret = compactToString(val);
      if (ret.equals("len")) return null;
      return ret;
    });

    grammar.addSymbol("VAR", new Repeat(
      grammar.sym("CHAR"), 1
    ));
    grammar.addAction("VAR", (val, x) -> {
      var ret = compactToString(val);
      if (ret.equals("len")) return Action.NO_PARSE;
      try {
        return new foam.mlang.Constant (classInfo_.getObjClass().getDeclaredField(ret).get(null));
      } catch (Exception e) {
      }
      return x.get(ret) == null ? Action.NO_PARSE : x.get(ret);
    });

    grammar.addSymbol("CHAR", new Alt(
      Range.create('a', 'z'),
      Range.create('A', 'Z'),
      Range.create('0', '9'),
      Literal.create("-"),
      Literal.create("^"),
      Literal.create("_")
    ));

    grammar.addSymbol("NUMBER", new Alt(
      grammar.sym("DOUBLE"),
      grammar.sym("INTEGER")
    ));

    grammar.addSymbol("YEARS", new Seq1(2,
      new LiteralIC("YEARS("),
      Whitespace.instance(),
      grammar.sym("VALUE"), // FORMULA?
      Whitespace.instance(),
      Literal.create(")")
    ));
    grammar.addAction("YEARS", (val, x) -> {
      return YEARS(val);
    });

    grammar.addSymbol("MONTHS", new Seq1(2,
      new LiteralIC("MONTHS("),
      Whitespace.instance(),
      grammar.sym("VALUE"), // FORMULA?
      Whitespace.instance(),
      Literal.create(")")
    ));
    grammar.addAction("MONTHS", (val, x) -> {
      return MONTHS(val);
    });

    grammar.addSymbol("DAYS", new Seq1(2,
      new LiteralIC("DAYS("),
      Whitespace.instance(),
      grammar.sym("VALUE"), // FORMULA?
      Whitespace.instance(),
      Literal.create(")")
    ));
    grammar.addAction("DAYS", (val, x) -> {
      return DAYS(val);
    });

    grammar.addSymbol("HOURS", new Seq1(2,
      new LiteralIC("HOURS("),
      Whitespace.instance(),
      grammar.sym("VALUE"), // FORMULA?
      Whitespace.instance(),
      Literal.create(")")
    ));
    grammar.addAction("HOURS", (val, x) -> {
      return HOURS(val);
    });

    grammar.addSymbol("MINUTES", new Seq1(2,
      new LiteralIC("MINUTES("),
      Whitespace.instance(),
      grammar.sym("VALUE"), // FORMULA?
      Whitespace.instance(),
      Literal.create(")")
    ));
    grammar.addAction("MINUTES", (val, x) -> {
      return MINUTES(val);
    });

    grammar.addSymbol("MAX", new Seq2(2, 6,
      new LiteralIC("MAX("),
      Whitespace.instance(),
      grammar.sym("FORMULA"),
      Whitespace.instance(),
      Literal.create(","),
      Whitespace.instance(),
      grammar.sym("FORMULA"),
      Whitespace.instance(),
      Literal.create(")")
    ));
    grammar.addAction("MAX", (val, x) -> {
      Object[] vals = (Object[]) val;
      Expr[] t = new Expr[2];
      t[0] = vals[0] instanceof Expr ? (Expr) vals[0] : new Constant(vals[0]);
      t[1] = vals[1] instanceof Expr ? (Expr) vals[1] : new Constant(vals[1]);
      return new MaxFunc(t, true);
    });

    grammar.addSymbol("MIN", new Seq2(2, 6,
      new LiteralIC("MIN("),
      Whitespace.instance(),
      grammar.sym("FORMULA"),
      Whitespace.instance(),
      Literal.create(","),
      Whitespace.instance(),
      grammar.sym("FORMULA"),
      Whitespace.instance(),
      Literal.create(")")
    ));
    grammar.addAction("MIN", (val, x) -> {
      Object[] vals = (Object[]) val;
      Expr[] t = new Expr[2];
      t[0] = vals[0] instanceof Expr ? (Expr) vals[0] : new Constant(vals[0]);
      t[1] = vals[1] instanceof Expr ? (Expr) vals[1] : new Constant(vals[1]);
      return new MinFunc(t, true);
    });

    grammar.addSymbol("INTEGER", new Seq(new Optional(Literal.create("-")), new Repeat(
      Range.create('0', '9'), 1
    )));
    grammar.addAction("INTEGER", (val, x) -> {
      var sb = new StringBuilder();
      Object[] values = (Object[]) val;
      if ( values[0] != null  ) sb.append(values[0]);
      sb.append(compactToString(values[1]));
      var finalStr = sb.toString();
      if ( finalStr.length() == 0 ) return val;
      try {
        return Integer.parseInt(finalStr);
      } catch (NumberFormatException e) {
        return Long.parseLong(finalStr);
      }
    });

    grammar.addSymbol("DOUBLE", new Seq(new Optional(Literal.create("-")),
      new Seq(
        new Repeat(Range.create('0', '9'), 1),
        Literal.create("."),
        new Repeat(Range.create('0', '9'), 1)
      )));
    grammar.addAction("DOUBLE", (val, x) -> {
      var sb = new StringBuilder();
      Object[] values = (Object[]) val;
      if ( values[0] != null ) sb.append(values[0]);
      Object[] v = (Object[]) values[1];
      sb.append(compactToString(v[0]));
      sb.append(v[1]);
      sb.append(compactToString(v[2]));
      var finalStr = sb.toString();
      if ( finalStr.length() == 0 ) return val;
      try {
        return Double.parseDouble(finalStr);
      } catch (NumberFormatException e) {
        return Long.parseLong(finalStr);
      }
    });

    grammar.addSymbol("FIELD_LEN", new Seq1(0, grammar.sym("FIELD"), Literal.create(".len")));
    grammar.addAction("FIELD_LEN", (val, x) -> new StringLength((Expr) val));

    grammar.addSymbol("FIELD", new Seq(grammar.sym("FIELD_NAME"), new Optional(
      new Seq1(1, Literal.create("."), new Repeat(new foam.lib.parse.Not(Literal.create("len"),
        grammar.sym("WORD")), Literal.create("."), 1)))));
    grammar.addAction("FIELD", (val, x) -> {
      Object[] values = (Object[]) val;
      var expr = (Expr) values[0];
      if (values.length > 1 && values[1] != null) {
        Object[] values2 = (Object[]) values[1];
//        var parts = (String[]) values2[1];
        for ( var i = 0 ; i < values2.length ; i++ ) {
          expr = new Dot(expr, NamedProperty.create((String) values2[i]));
        }
      }
      return expr;
    });

    return grammar;
  }

  protected Date[] convertToYearRange(int year) {
    Calendar start = Calendar.getInstance();
    start.set(year, 0, 0);

    Calendar end = Calendar.getInstance();
    end.set(year + 1, 0, 0);

    return new Date[] { start.getTime(), end.getTime() };
  }

  protected String compactToString(Object val) {
    Object[] values = (Object[]) val;
    StringBuilder sb = new StringBuilder();
    for ( Object num: values ) {
      sb.append(num);
    }
    return sb.toString();
  }

  protected Boolean isCapitalized(String str) {
    for ( int i = 0 ; i < str.length() ; i++ ) {
      if ( ! Character.isUpperCase(str.charAt(i)) ) return false;
    }
    return true;
  }

  protected Boolean isPropNumber(Expr expr) {
    return ! (expr instanceof AbstractPropertyInfo && ! (expr instanceof AbstractDoublePropertyInfo) && ! (expr instanceof AbstractFloatPropertyInfo) &&
      ! (expr instanceof AbstractIntPropertyInfo) && ! (expr instanceof AbstractLongPropertyInfo) || (expr instanceof Dot));
  }
}
