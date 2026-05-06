/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.parse;

import foam.lang.*;
import foam.lib.parse.*;
import foam.lib.parse.Action;
import foam.lib.parse.Not;
import foam.lib.parse.Optional;
import foam.mlang.Constant;
import foam.mlang.Expr;
import foam.mlang.predicate.*;
import foam.util.SafetyUtil;

import java.lang.reflect.Method;
import java.util.*;

import static foam.mlang.MLang.*;

/**
 * A type-aware AQL (Advanced Query Language) parser that generates FOAM MLang
 * predicates from query strings. Supports AND, OR, grouping, and property-specific
 * predicates based on the properties of the specified ClassInfo.
 *
 * Each property type gets its own set of operators:
 *   String:      =, !=, >=, >, <=, <, :, ~, CONTAINS, IN(), NOT IN(), IS EMPTY, IS NOT EMPTY
 *   StringArray: =, HAS, !=, IN(), NOT IN()
 *   Number/Long: =, !=, >=, >, <=, <, IN(), NOT IN()
 *   Float/Double:=, !=, >=, >, <=, <, IN RANGE(), NOT IN RANGE()
 *   Date:        =, !=, >=, >, <=, <, IN RANGE(), NOT IN RANGE(), IS EMPTY, IS NOT EMPTY
 *   DateTime:    Same as Date but parses YYYY-MM-DDTHH:MM:SS format
 *   Boolean:     IS TRUE, IS FALSE
 *   Enum:        =, !=, IN(), NOT IN()
 *   Logical:     AND, OR, NOT, ()
 *   Dot access:  address.longitude >= 6.5
 */
public class SimpleQueryParser
{
  protected ClassInfo          info_;
  protected foam.lib.parse.Grammar grammar_;

  private static final double EPSILON = 0.0000000001;

  public SimpleQueryParser(ClassInfo classInfo) {
    info_ = classInfo;
    grammar_ = buildGrammar();
  }

  /**
   * Parse a query string into an MLang Predicate.
   * Returns null if the input is empty or parsing fails.
   */
  public Predicate parseString(String query) {
    return (Predicate) parseSymbol(query, null);
  }

  /**
   * Parse a query string with an external ParserContext.
   * Returns null if the input is empty or parsing fails.
   */
  public Predicate parseString(String query, ParserContext x) {
    if ( SafetyUtil.isEmpty(query) ) return null;

    StringPStream ps = new StringPStream();
    ps.setString(query);

    if ( x == null ) x = new ParserContextImpl();
    x.set("classInfo", info_);

    PStream result = grammar_.parse(ps, x, "");
    if ( result == null ) return null;

    Object val = result.value();
    return val instanceof Predicate ? ((Predicate) val).partialEval() : null;
  }

  /**
   * Parse a PStream with an external ParserContext.
   * Enables embedding this parser inside larger grammar compositions.
   */
  public PStream parse(PStream ps, ParserContext x) {
    if ( x == null ) x = new ParserContextImpl();
    x.set("classInfo", info_);
    return grammar_.parse(ps, x, "");
  }

  /**
   * Parse a query string starting from a specific grammar symbol.
   * If symbolName is null, defaults to "START".
   */
  protected Object parseSymbol(String query, String symbolName) {
    if ( SafetyUtil.isEmpty(query) ) return null;

    StringPStream ps = new StringPStream();
    ps.setString(query);
    ParserContext x = new ParserContextImpl();
    x.set("classInfo", info_);

    if ( symbolName == null ) symbolName = "";

    PStream result = grammar_.parse(ps, x, symbolName);
    if ( result == null ) return null;

    Object val = result.value();
    if ( val instanceof Predicate && symbolName.isEmpty() ) {
      val = ((Predicate) val).partialEval();
    }
    return val;
  }

  // ───────────────────── Grammar Construction ─────────────────────

  private foam.lib.parse.Grammar buildGrammar() {
    foam.lib.parse.Grammar g = new foam.lib.parse.Grammar();

    // ── Whitespace ──
    g.addSymbol("ws", new Repeat0(Literal.create(" ")));

    // ── Primitive symbols ──
    buildPrimitiveSymbols(g);

    // ── Comparison operators ──
    buildComparisonSymbols(g);

    // ── Logical structure ──
    buildLogicalSymbols(g);

    // ── Property-specific predicates ──
    buildPropertyPredicates(g);

    // ── Actions ──
    buildActions(g);

    return g;
  }

  // ───────── Primitive Symbols ─────────

  private void buildPrimitiveSymbols(foam.lib.parse.Grammar g) {
    // rawDigits: base grammar for one or more digit chars, no action (preserves leading zeros)
    g.addSymbol("rawDigits", new Join(new Repeat(Range.create('0', '9'), 1)));

    // digits: delegates to rawDigits, but has a parseInt action (see buildActions)
    g.addSymbol("digits", g.sym("rawDigits"));

    // float: optional negative, rawDigits, optional decimal part → joined string
    // Uses rawDigits (not digits) to avoid parseInt stripping leading zeros (e.g., "001" → 1)
    g.addSymbol("float",
      new Seq1(1,
        g.sym("ws"),
        new Join(new Seq(
          new Optional(Literal.create("-")),
          g.sym("rawDigits"),
          new Optional(new Join(new Seq(Literal.create("."), new Optional(g.sym("rawDigits")))))))));

    // floats: two or more floats separated by comma (for IN RANGE)
    g.addSymbol("floats", new Repeat(g.sym("float"), Literal.create(","), 2));

    // range float: ws floats ws )
    g.addSymbol("range float", new Seq1(1, g.sym("ws"), g.sym("floats"), g.sym("ws"), Literal.create(")")));

    // number: optional negative sign + digits
    g.addSymbol("number",
      new Seq1(1,
        g.sym("ws"),
        new Seq(new Optional(Literal.create("-")), g.sym("digits"))));

    // numbers: one or more numbers separated by comma
    g.addSymbol("numbers", new Repeat(g.sym("number"), Literal.create(","), 1));

    // numberArray: numbers ws )
    g.addSymbol("numberArray", new Seq1(1, g.sym("ws"), g.sym("numbers"), g.sym("ws"), Literal.create(")")));

    // char
    g.addSymbol("char", new Alt(
      Range.create('a', 'z'),
      Range.create('A', 'Z'),
      Range.create('0', '9'),
      Literal.create("-"),
      Literal.create("^"),
      Literal.create("_"),
      Literal.create("@"),
      Literal.create("%"),
      Literal.create(".")
    ));

    // word: one or more chars joined
    g.addSymbol("word", new Join(new Repeat(g.sym("char"), 1)));

    // quoted string: "..." with escaped quotes
    g.addSymbol("quoted string", new Join(new Seq1(1,
      Literal.create("\""),
      new Repeat(new Alt(
        new Literal("\\\"", "\""),
        new NotChars("\"")
      )),
      Literal.create("\"")
    )));

    // string: word or quoted string (with leading whitespace)
    g.addSymbol("string", new Seq1(1, g.sym("ws"), new Alt(g.sym("word"), g.sym("quoted string"))));

    // stringArray: ws strings ws )
    g.addSymbol("strings", new Repeat(g.sym("string"), Literal.create(","), 1));
    g.addSymbol("stringArray", new Seq1(1, g.sym("ws"), g.sym("strings"), g.sym("ws"), Literal.create(")")));

    // ── Date symbols ──
    // literal date: YYYY-MM-DD or YYYY-MM or YYYY (with - or / separator)
    g.addSymbol("literal date", new Alt(
      // YYYY-MM-DD
      new Seq(g.sym("digits"), new Chars("-/"), g.sym("digits"), new Chars("-/"), g.sym("digits")),
      // YYYY-MM
      new Seq(g.sym("digits"), new Chars("-/"), g.sym("digits")),
      // YYYY
      new Seq(g.sym("digits"))
    ));

    // literal datetime: extends date with T and time components
    g.addSymbol("literal datetime", new Alt(
      // YYYY-MM-DDTHH:MM:SS.mmmZ
      new Seq(g.sym("digits"), new Chars("-/"), g.sym("digits"), new Chars("-/"), g.sym("digits"),
        Literal.create("T"), g.sym("digits"), Literal.create(":"), g.sym("digits"),
        Literal.create(":"), g.sym("digits"), Literal.create("."), g.sym("digits"), Literal.create("Z")),
      // YYYY-MM-DDTHH:MM:SS.mmm
      new Seq(g.sym("digits"), new Chars("-/"), g.sym("digits"), new Chars("-/"), g.sym("digits"),
        Literal.create("T"), g.sym("digits"), Literal.create(":"), g.sym("digits"),
        Literal.create(":"), g.sym("digits"), Literal.create("."), g.sym("digits")),
      // YYYY-MM-DDTHH:MM:SS
      new Seq(g.sym("digits"), new Chars("-/"), g.sym("digits"), new Chars("-/"), g.sym("digits"),
        Literal.create("T"), g.sym("digits"), Literal.create(":"), g.sym("digits"),
        Literal.create(":"), g.sym("digits")),
      // YYYY-MM-DDTHH:MM
      new Seq(g.sym("digits"), new Chars("-/"), g.sym("digits"), new Chars("-/"), g.sym("digits"),
        Literal.create("T"), g.sym("digits"), Literal.create(":"), g.sym("digits")),
      // YYYY-MM-DDTHH
      new Seq(g.sym("digits"), new Chars("-/"), g.sym("digits"), new Chars("-/"), g.sym("digits"),
        Literal.create("T"), g.sym("digits"))
    ));

    // relative date: TODAY[+/-n]
    g.addSymbol("relative date", new Seq(
      new LiteralIC("TODAY"),
      new Optional(new Seq(new Chars("+-"), g.sym("digits")))
    ));

    // date: literal date or relative date (for Date properties, defaults to noon UTC)
    g.addSymbol("date", new Seq1(1, g.sym("ws"), new Alt(
      g.sym("literal date"),
      g.sym("relative date")
    )));

    // datetime: literal datetime, literal date, or relative date (for DateTime properties, defaults to midnight UTC)
    g.addSymbol("datetime", new Seq1(1, g.sym("ws"), new Alt(
      g.sym("literal datetime"),
      g.sym("literal date"),
      g.sym("relative date")
    )));

    // dates: two or more dates separated by comma
    g.addSymbol("dates", new Repeat(g.sym("date"), Literal.create(","), 2));
    g.addSymbol("range date", new Seq1(1, g.sym("ws"), g.sym("dates"), g.sym("ws"), Literal.create(")")));

    // datetimes: two or more datetimes separated by comma
    g.addSymbol("datetimes", new Repeat(g.sym("datetime"), Literal.create(","), 2));
    g.addSymbol("range datetime", new Seq1(1, g.sym("ws"), g.sym("datetimes"), g.sym("ws"), Literal.create(")")));
  }

  // ───────── Comparison Operator Symbols ─────────

  /**
   * Creates a parser for an operator keyword surrounded by optional whitespace.
   * Uses LiteralIC for case-insensitive matching.
   */
  private Parser operator(foam.lib.parse.Grammar g, String op) {
    return new Seq1(2, Literal.create(" "), g.sym("ws"), new LiteralIC(op));
  }

  /**
   * Variant without requiring leading space — for operators that may appear
   * directly after a property name (e.g., "id=6").
   */
  private Parser operatorNoSpace(foam.lib.parse.Grammar g, String op) {
    return new Seq1(1, g.sym("ws"), new LiteralIC(op));
  }

  /**
   * Parser for IN-style operators: requires opening parenthesis after keyword.
   */
  private Parser operatorIn(foam.lib.parse.Grammar g, String op) {
    return new Seq1(2, Literal.create(" "), g.sym("ws"),
      new Seq1(0, new LiteralIC(op), g.sym("ws"), Literal.create("(")));
  }

  private void buildComparisonSymbols(foam.lib.parse.Grammar g) {
    // compareFloat: comparison operators for float/double properties
    g.addSymbol("compareFloat", new Alt(
      new Seq(operatorNoSpace(g, ">="), g.sym("float")),
      new Seq(operatorNoSpace(g, ">"), g.sym("float")),
      new Seq(operatorNoSpace(g, "<="), g.sym("float")),
      new Seq(operatorNoSpace(g, "<"), g.sym("float")),
      new Seq(operatorNoSpace(g, "!="), g.sym("float")),
      new Seq(operatorNoSpace(g, "="), g.sym("float")),
      new Seq(operatorIn(g, "IN RANGE"), g.sym("range float")),
      new Seq(operatorIn(g, "NOT IN RANGE"), g.sym("range float"))
    ));

    // compareNumber: comparison operators for int/long properties
    g.addSymbol("compareNumber", new Alt(
      new Seq(operatorNoSpace(g, ">="), g.sym("number")),
      new Seq(operatorNoSpace(g, ">"), g.sym("number")),
      new Seq(operatorNoSpace(g, "<="), g.sym("number")),
      new Seq(operatorNoSpace(g, "<"), g.sym("number")),
      new Seq(operatorNoSpace(g, "!="), g.sym("number")),
      new Seq(operatorNoSpace(g, "="), g.sym("number")),
      new Seq(operatorIn(g, "IN"), g.sym("numberArray")),
      new Seq(operatorIn(g, "NOT IN"), g.sym("numberArray"))
    ));

    // compareDate: comparison operators for Date properties
    g.addSymbol("compareDate", new Alt(
      new Seq(operatorNoSpace(g, ">="), g.sym("date")),
      new Seq(operatorNoSpace(g, ">"), g.sym("date")),
      new Seq(operatorNoSpace(g, "<="), g.sym("date")),
      new Seq(operatorNoSpace(g, "<"), g.sym("date")),
      new Seq(operatorNoSpace(g, "!="), g.sym("date")),
      new Seq(operatorNoSpace(g, "="), g.sym("date")),
      new Seq(operatorIn(g, "IN RANGE"), g.sym("range date")),
      new Seq(operatorIn(g, "NOT IN RANGE"), g.sym("range date")),
      new Seq(operator(g, "IS EMPTY")),
      new Seq(operator(g, "IS NOT EMPTY"))
    ));

    // compareDatetime: comparison operators for DateTime/DateTimeUTC properties
    g.addSymbol("compareDatetime", new Alt(
      new Seq(operatorNoSpace(g, ">="), g.sym("datetime")),
      new Seq(operatorNoSpace(g, ">"), g.sym("datetime")),
      new Seq(operatorNoSpace(g, "<="), g.sym("datetime")),
      new Seq(operatorNoSpace(g, "<"), g.sym("datetime")),
      new Seq(operatorNoSpace(g, "!="), g.sym("datetime")),
      new Seq(operatorNoSpace(g, "="), g.sym("datetime")),
      new Seq(operatorIn(g, "IN RANGE"), g.sym("range datetime")),
      new Seq(operatorIn(g, "NOT IN RANGE"), g.sym("range datetime")),
      new Seq(operator(g, "IS EMPTY")),
      new Seq(operator(g, "IS NOT EMPTY"))
    ));

    // compareString: comparison operators for String properties
    g.addSymbol("compareString", new Alt(
      new Seq(operatorNoSpace(g, ">="), g.sym("string")),
      new Seq(operatorNoSpace(g, ">"), g.sym("string")),
      new Seq(operatorNoSpace(g, "<="), g.sym("string")),
      new Seq(operatorNoSpace(g, "<"), g.sym("string")),
      new Seq(operatorNoSpace(g, "!="), g.sym("string")),
      new Seq(operatorNoSpace(g, "="), g.sym("string")),
      new Seq(operatorNoSpace(g, ":"), g.sym("string")),
      new Seq(operatorNoSpace(g, "~"), g.sym("string")),
      new Seq(operator(g, "CONTAINS"), g.sym("string")),
      new Seq(operatorIn(g, "IN"), g.sym("stringArray")),
      new Seq(operatorIn(g, "NOT IN"), g.sym("stringArray")),
      new Seq(operator(g, "IS EMPTY")),
      new Seq(operator(g, "IS NOT EMPTY"))
    ));

    // compareStringArray: comparison operators for StringArray properties
    g.addSymbol("compareStringArray", new Alt(
      new Seq(operatorNoSpace(g, "="), g.sym("string")),
      new Seq(operator(g, "HAS"), g.sym("string")),
      new Seq(operatorNoSpace(g, "!="), g.sym("string")),
      new Seq(operatorIn(g, "IN"), g.sym("stringArray")),
      new Seq(operatorIn(g, "NOT IN"), g.sym("stringArray"))
    ));

    // compareBoolean
    g.addSymbol("compareBoolean", new Alt(
      new Seq(Literal.create(" "), new Seq1(1, g.sym("ws"), new LiteralIC("IS TRUE"))),
      new Seq(Literal.create(" "), new Seq1(1, g.sym("ws"), new LiteralIC("IS FALSE")))
    ));
  }

  // ───────── Logical Structure ─────────

  private void buildLogicalSymbols(foam.lib.parse.Grammar g) {
    // START: parse OR expression, consume trailing whitespace and EOF
    g.addSymbol("START",
      new Seq1(0, g.sym("or"), g.sym("ws")));

    // OR: one or more AND expressions separated by " OR " or " | "
    g.addSymbol("or",
      new Repeat(
        g.sym("and"),
        new Seq(Literal.create(" "), new Seq1(1, g.sym("ws"), new Alt(new LiteralIC("OR"), Literal.create("|")))),
        1));

    // AND: one or more expr separated by " AND " or " & "
    g.addSymbol("and",
      new Repeat(
        g.sym("expr"),
        new Seq(Literal.create(" "), new Seq1(1, g.sym("ws"), new Alt(new LiteralIC("AND"), Literal.create("&")))),
        1));

    // expr: parenthesized, negated, or property predicate
    // propPredicates and rangePropPredicates are built in buildPropertyPredicates
    g.addSymbol("expr", new Alt(
      g.sym("paren"),
      g.sym("negate"),
      g.sym("propPredicates"),
      g.sym("rangePropPredicates")
    ));

    // paren: ( query )
    g.addSymbol("paren", new Seq1(3, g.sym("ws"), Literal.create("("), g.sym("ws"), g.sym("or"), g.sym("ws"), Literal.create(")")));

    // negate: NOT expr
    g.addSymbol("negate", new Seq1(3, g.sym("ws"), new LiteralIC("NOT"), g.sym("ws"), g.sym("expr")));
  }

  // ───────── Property-specific Predicates ─────────

  private void buildPropertyPredicates(foam.lib.parse.Grammar g) {
    List<PropertyInfo> properties = info_.getAxiomsByClass(PropertyInfo.class);

    // Build property name → PropertyInfo map (including aliases, sorted by descending length)
    List<Parser> propPredicates      = new ArrayList<>();
    List<Parser> rangePropPredicates = new ArrayList<>();

    // Process each property
    for ( PropertyInfo prop : properties ) {
      processProperty(g, prop, propertyParser(g, prop), propPredicates, rangePropPredicates);
    }

    // Register propPredicates and rangePropPredicates as grammar symbols
    if ( propPredicates.isEmpty() ) {
      // No properties, add a fail parser
      g.addSymbol("propPredicates", new Fail());
    } else {
      g.addSymbol("propPredicates", new Alt(propPredicates));
    }

    if ( rangePropPredicates.isEmpty() ) {
      g.addSymbol("rangePropPredicates", new Fail());
    } else {
      g.addSymbol("rangePropPredicates", new Alt(rangePropPredicates));
    }
  }

  /**
   * Create a parser for a property name (case-insensitive) that returns
   * the PropertyInfo as the parsed value.
   */
  private Parser propertyParser(foam.lib.parse.Grammar g, PropertyInfo prop) {
    // Build all name variants: name + aliases, sorted by descending length
    List<Parser> nameParsers = new ArrayList<>();
    nameParsers.add(new LiteralIC(prop.getName(), prop));

    if ( prop.getAliases() != null ) {
      for ( String alias : prop.getAliases() ) {
        if ( ! SafetyUtil.isEmpty(alias) ) {
          nameParsers.add(new LiteralIC(alias, prop));
        }
      }
    }

    if ( ! SafetyUtil.isEmpty(prop.getShortName()) ) {
      nameParsers.add(new LiteralIC(prop.getShortName(), prop));
    }

    // Sort by descending length to prevent prefix conflicts
    nameParsers.sort((a, b) -> {
      // LiteralIC stores the uppercase string; compare lengths
      String as = a.toString();
      String bs = b.toString();
      return bs.length() - as.length();
    });

    Parser nameParser = nameParsers.size() == 1
      ? nameParsers.get(0)
      : new Alt(nameParsers);

    return new Seq1(1, g.sym("ws"), nameParser);
  }

  /**
   * Create a parser for inner property access (dot notation).
   * E.g., "address.longitude" → DOT(User.address, Address.longitude)
   */
  private Parser innerPropertyParser(foam.lib.parse.Grammar g, PropertyInfo outerProp, PropertyInfo innerProp) {
    foam.mlang.expr.Dot dotExpr = new foam.mlang.expr.Dot();
    dotExpr.setArg1(outerProp);
    dotExpr.setArg2(innerProp);

    return new Seq1(2,
      g.sym("ws"),
      new Seq1(0, new LiteralIC(outerProp.getName()), Literal.create(".")),
      new LiteralIC(innerProp.getName(), dotExpr)
    );
  }

  /**
   * Process a property and add its predicate parsers to the appropriate list.
   */
  private void processProperty(foam.lib.parse.Grammar g, PropertyInfo prop,
    Parser propertyParser, List<Parser> propPredicates, List<Parser> rangePropPredicates) {

    PropertyInfo type = prop;

    // For FObjectProperty, recurse into inner properties (skip self-referencing props)
    if ( prop instanceof AbstractFObjectPropertyInfo ) {
      String propName = prop.getName();
      if ( "language".equals(propName) || "next".equals(propName) ) return;
      AbstractFObjectPropertyInfo foProp = (AbstractFObjectPropertyInfo) prop;
      ClassInfo innerClassInfo = foProp.of();
      if ( innerClassInfo != null && innerClassInfo.getObjClass() != null ) {
        List<PropertyInfo> innerProps = innerClassInfo.getAxiomsByClass(PropertyInfo.class);
        for ( PropertyInfo innerProp : innerProps ) {
          // Skip language and next to prevent infinite recursion
          if ( "language".equals(innerProp.getName()) || "next".equals(innerProp.getName()) ) continue;
          processProperty(g, innerProp, innerPropertyParser(g, prop, innerProp),
            propPredicates, rangePropPredicates);
        }
      }
      return;
    }

    // Float/Double properties → range-based predicates
    if ( type instanceof AbstractFloatPropertyInfo || type instanceof AbstractDoublePropertyInfo ) {
      rangePropPredicates.add(new Seq(propertyParser, g.sym("compareFloat")));
    }
    // Int/Long/Short/Byte properties → number predicates
    else if ( type instanceof AbstractIntPropertyInfo || type instanceof AbstractLongPropertyInfo ||
              type instanceof AbstractShortPropertyInfo || type instanceof AbstractBytePropertyInfo ) {
      propPredicates.add(new Seq(propertyParser, g.sym("compareNumber")));
    }
    // Boolean properties
    else if ( type instanceof AbstractBooleanPropertyInfo ) {
      propPredicates.add(new Seq(propertyParser, g.sym("compareBoolean")));
    }
    // Enum properties
    else if ( type instanceof AbstractEnumPropertyInfo ) {
      buildEnumPredicate(g, prop, (AbstractEnumPropertyInfo) type, propertyParser, propPredicates);
    }
    // DateTime/DateTimeUTC properties (must check before Date since DateTime extends Date)
    else if ( isDateTimeProperty(type) ) {
      rangePropPredicates.add(new Seq(propertyParser, g.sym("compareDatetime")));
    }
    // Date properties
    else if ( type instanceof AbstractDatePropertyInfo ) {
      rangePropPredicates.add(new Seq(propertyParser, g.sym("compareDate")));
    }
    // String properties
    else if ( type instanceof AbstractStringPropertyInfo ) {
      propPredicates.add(new Seq(propertyParser, g.sym("compareString")));
    }
    // StringArray properties
    else if ( type instanceof AbstractArrayPropertyInfo ) {
      AbstractArrayPropertyInfo arrayProp = (AbstractArrayPropertyInfo) type;
      if ( "String".equals(arrayProp.of()) ) {
        propPredicates.add(new Seq(propertyParser, g.sym("compareStringArray")));
      }
    }
  }

  /**
   * Check if a property is a DateTime or DateTimeUTC (not just Date).
   * DateTime class names contain "DateTime".
   */
  private boolean isDateTimeProperty(PropertyInfo prop) {
    if ( ! ( prop instanceof AbstractDatePropertyInfo ) ) return false;
    String className = prop.getClass().getSimpleName();
    return className.contains("DateTime");
  }

  /**
   * Build enum-specific predicate parser with enum value alternatives.
   */
  private void buildEnumPredicate(foam.lib.parse.Grammar g, PropertyInfo prop,
    AbstractEnumPropertyInfo enumProp, Parser propertyParser, List<Parser> propPredicates) {

    Class enumClass = enumProp.getValueClass();
    Object[] enumVals = enumClass.getEnumConstants();
    if ( enumVals == null || enumVals.length == 0 ) return;

    try {
      Method nameMet = enumClass.getMethod("getName");

      List<Parser> valueParsers = new ArrayList<>();
      for ( Object enumVal : enumVals ) {
        String enumName = (String) nameMet.invoke(enumVal);
        valueParsers.add(new Seq1(1, g.sym("ws"), new LiteralIC(enumName, enumVal)));
      }

      Parser enumValue = new Alt(valueParsers);
      Parser enumArray = new Seq1(0,
        new Repeat(
          new Seq1(0, enumValue, g.sym("ws")),
          Literal.create(","), 1),
        g.sym("ws"),
        Literal.create(")"));

      // Create a unique symbol name for this enum's compare
      String compareSymName = "compareEnum_" + prop.getName();
      g.addSymbol(compareSymName, new Alt(
        new Seq(operatorNoSpace(g, "="), enumValue),
        new Seq(operatorNoSpace(g, "!="), enumValue),
        new Seq(operatorIn(g, "IN"), enumArray),
        new Seq(operatorIn(g, "NOT IN"), enumArray)
      ));

      // Add action for enum comparison to extract operator and value
      g.addAction(compareSymName, (val, x) -> {
        Object[] values = (Object[]) val;
        return new Object[] { values[0], values[1] }; // [operator, value]
      });

      propPredicates.add(new Seq(propertyParser, g.sym(compareSymName)));
    } catch ( java.lang.Exception e ) {
      // Skip this enum property if reflection fails
    }
  }

  // ───────── Actions ─────────

  private void buildActions(foam.lib.parse.Grammar g) {

    // ── Primitive actions ──

    g.addAction("digits", (val, x) -> {
      String s = compactToString(val);
      try { return Integer.parseInt(s.trim()); }
      catch ( NumberFormatException e ) { return Long.parseLong(s.trim()); }
    });

    g.addAction("number", (val, x) -> {
      Object[] values = (Object[]) val;
      // values[0] = optional "-" (null if positive), values[1] = digits (Integer or Long)
      if ( values[1] instanceof Long ) {
        long num = (Long) values[1];
        if ( values[0] != null ) num = -num;
        return num;
      }
      int num;
      if ( values[1] instanceof Integer ) {
        num = (Integer) values[1];
      } else {
        num = Integer.parseInt(values[1].toString().trim());
      }
      if ( values[0] != null ) num = -num;
      return num;
    });

    g.addAction("float", (val, x) -> {
      double d = Double.parseDouble(((String) val).trim());
      double start = d - EPSILON;
      double end   = d + EPSILON;
      return new double[] { start, end };
    });

    g.addAction("literal date", (val, x) -> {
      return parseLiteralDate((Object[]) val, new int[] { 0, 1, 1, 12 });
    });

    g.addAction("literal datetime", (val, x) -> {
      return parseLiteralDate((Object[]) val, new int[] { 0, 1, 1, 0 });
    });

    g.addAction("date", (val, x) -> {
      if ( val instanceof Date[] ) return val;
      // relative date returns an array of numbers that needs to go through literal date
      return parseLiteralDate((Object[]) val, new int[] { 0, 1, 1, 12 });
    });

    g.addAction("datetime", (val, x) -> {
      if ( val instanceof Date[] ) return val;
      return parseLiteralDate((Object[]) val, new int[] { 0, 1, 1, 0 });
    });

    g.addAction("relative date", (val, x) -> {
      Object[] values = (Object[]) val;
      Calendar now = Calendar.getInstance(TimeZone.getTimeZone("UTC"));

      // Apply offset if present, using Calendar.add() for proper month/year rollover
      if ( values[1] != null ) {
        Object[] offset = (Object[]) values[1];
        char sign = (Character) offset[0];
        int amount = (Integer) offset[1];
        now.add(Calendar.DAY_OF_MONTH, sign == '-' ? -amount : amount);
      }

      // Extract year/month/day AFTER normalization
      int year  = now.get(Calendar.YEAR);
      int month = now.get(Calendar.MONTH) + 1; // 1-based
      int date  = now.get(Calendar.DAY_OF_MONTH);

      // Return as array matching literal date format: [year, '-', month, '-', date]
      return new Object[] { year, "-", month, "-", date };
    });

    g.addAction("range date", (val, x) -> {
      Object[] values = (Object[]) val;
      Date[] first  = (Date[]) values[0];
      Date[] second = (Date[]) values[1];
      return new Date[] { first[0], second[1] };
    });

    g.addAction("range datetime", (val, x) -> {
      Object[] values = (Object[]) val;
      Date[] first  = (Date[]) values[0];
      Date[] second = (Date[]) values[1];
      return new Date[] { first[0], second[1] };
    });

    g.addAction("range float", (val, x) -> {
      Object[] values = (Object[]) val;
      double[] first  = (double[]) values[0];
      double[] second = (double[]) values[1];
      return new double[] { first[0], second[1] };
    });

    // ── Comparison actions ──

    g.addAction("compareNumber", (val, x) -> {
      Object[] values = (Object[]) val;
      return new Object[] { values[0], values[1] }; // [operator, value]
    });

    g.addAction("compareFloat", (val, x) -> {
      Object[] values = (Object[]) val;
      return new Object[] { values[0], values[1] }; // [operator, float range]
    });

    g.addAction("compareDate", (val, x) -> {
      Object[] values = (Object[]) val;
      // values[1] may be null for IS EMPTY / IS NOT EMPTY
      return new Object[] { values[0], values.length > 1 ? values[1] : null };
    });

    g.addAction("compareDatetime", (val, x) -> {
      Object[] values = (Object[]) val;
      return new Object[] { values[0], values.length > 1 ? values[1] : null };
    });

    g.addAction("compareString", (val, x) -> {
      Object[] values = (Object[]) val;
      return new Object[] { values[0], values.length > 1 ? values[1] : null };
    });

    g.addAction("compareStringArray", (val, x) -> {
      Object[] values = (Object[]) val;
      return new Object[] { values[0], values.length > 1 ? values[1] : null };
    });

    g.addAction("compareBoolean", (val, x) -> {
      Object[] values = (Object[]) val;
      String opStr = values[1].toString().toUpperCase().trim();
      boolean boolVal = opStr.endsWith("TRUE");
      return new Object[] { "IS", boolVal };
    });

    // ── Logical actions ──

    g.addAction("or", (val, x) -> {
      Object[] values = (Object[]) val;
      if ( values.length == 1 ) return values[0];
      return OR(Arrays.copyOf(values, values.length, Predicate[].class));
    });

    g.addAction("and", (val, x) -> {
      Object[] values = (Object[]) val;
      if ( values.length == 1 ) return values[0];
      return AND(Arrays.copyOf(values, values.length, Predicate[].class));
    });

    g.addAction("negate", (val, x) -> NOT((Predicate) val));

    // ── Property predicate actions ──

    g.addAction("propPredicates", (val, x) -> {
      Object[] values = (Object[]) val;
      Expr prop = (Expr) values[0];
      Object[] opVal = (Object[]) values[1];
      String op = opVal[0].toString().toUpperCase().trim();
      Object value = opVal[1];

      return buildSimplePredicate(prop, op, value);
    });

    g.addAction("rangePropPredicates", (val, x) -> {
      Object[] values = (Object[]) val;
      Expr prop = (Expr) values[0];
      Object[] opVal = (Object[]) values[1];
      String op = opVal[0].toString().toUpperCase().trim();
      Object value = opVal[1];

      return buildRangePredicate(prop, op, value);
    });
  }

  // ───────── Predicate Construction ─────────

  /**
   * Build predicates for simple (non-range) property types:
   * String, Number, Enum, Boolean, StringArray.
   */
  private Predicate buildSimplePredicate(Expr prop, String op, Object value) {
    switch ( op ) {
      case "=":
      case "HAS":
        if ( prop instanceof AbstractArrayPropertyInfo ) {
          return IN(prop, toArray(value));
        }
        return EQ(prop, value);

      case "!=":
        if ( prop instanceof AbstractArrayPropertyInfo ) {
          return NOT(IN(prop, toArray(value)));
        }
        return NEQ(prop, value);

      case ">=": return GTE(prop, value);
      case ">":  return GT(prop, value);
      case "<=": return LTE(prop, value);
      case "<":  return LT(prop, value);

      case "IN":
        return IN(prop, toArray(value));

      case "NOT IN":
        return NOT(IN(prop, toArray(value)));

      case "IS":
        return EQ(prop, value);

      case "CONTAINS":
      case ":":
      case "~":
        return CONTAINS_IC(prop, value);

      case "IS EMPTY":
        return NOT(HAS(prop));

      case "IS NOT EMPTY":
        return HAS(prop);

      default:
        return null;
    }
  }

  /**
   * Build predicates for range property types: Float/Double and Date/DateTime.
   * Range values are arrays: double[2] for floats, Date[2] for dates.
   */
  private Predicate buildRangePredicate(Expr prop, String op, Object value) {
    switch ( op ) {
      case "=":
      case "IN RANGE":
        return AND(GTE(prop, rangeStart(value)), LT(prop, rangeEnd(value)));

      case "!=":
      case "NOT IN RANGE":
        return OR(GTE(prop, rangeEnd(value)), LT(prop, rangeStart(value)));

      case ">=": return GTE(prop, rangeStart(value));
      case ">":  return GT(prop, rangeEnd(value));
      case "<=": return LTE(prop, rangeEnd(value));
      case "<":  return LT(prop, rangeStart(value));

      case "IS EMPTY":
        return NOT(HAS(prop));

      case "IS NOT EMPTY":
        return HAS(prop);

      default:
        return null;
    }
  }

  // ───────── Helpers ─────────

  /** Ensure value is array-compatible for IN predicates. */
  private Object toArray(Object value) {
    if ( value instanceof Object[] ) return Arrays.asList((Object[]) value);
    if ( value instanceof List )     return value;
    return new Object[] { value };
  }

  /** Extract the start (lower bound) from a range value (double[] or Date[]). */
  private Object rangeStart(Object value) {
    if ( value instanceof double[] ) return ((double[]) value)[0];
    if ( value instanceof Date[] )   return ((Date[]) value)[0];
    return value;
  }

  /** Extract the end (upper bound) from a range value (double[] or Date[]). */
  private Object rangeEnd(Object value) {
    if ( value instanceof double[] ) return ((double[]) value)[1];
    if ( value instanceof Date[] )   return ((Date[]) value)[1];
    return value;
  }

  /**
   * Join an array of values into a compact string, handling nested arrays recursively.
   */
  protected String compactToString(Object val) {
    if ( val instanceof String ) return (String) val;
    if ( ! ( val instanceof Object[] ) ) return val == null ? "" : val.toString();
    Object[] values = (Object[]) val;
    StringBuilder sb = new StringBuilder();
    for ( Object v : values ) {
      if ( v instanceof Object[] ) {
        sb.append(compactToString(v));
      } else if ( v != null ) {
        sb.append(v);
      }
    }
    return sb.toString();
  }

  /**
   * Parse a literal date array into a Date[2] range: [start, end).
   * Handles YYYY, YYYY-MM, YYYY-MM-DD, and datetime variants.
   *
   * @param parts    the parsed values (alternating digits and separators)
   * @param defaults default values for missing components [year, month, day, hour]
   */
  private Date[] parseLiteralDate(Object[] parts, int[] defaults) {
    // Extract numeric values, filtering out separators
    List<Integer> values = new ArrayList<>();
    for ( Object part : parts ) {
      if ( part instanceof Integer ) {
        values.add((Integer) part);
      } else if ( part instanceof Long ) {
        values.add(((Long) part).intValue());
      }
    }

    int count = values.size();
    if ( count == 0 ) return null;

    // Pad with defaults
    while ( values.size() < 4 ) {
      values.add(defaults[values.size()]);
    }

    int year  = values.get(0);
    if ( year < 100 ) year += 2000; // 2-digit year
    int month = values.get(1) - 1;  // Calendar is 0-based
    int day   = values.get(2);
    int hour  = values.get(3);

    // Additional time components
    int minute = values.size() > 4 ? values.get(4) : 0;
    int second = values.size() > 5 ? values.get(5) : 0;
    int millis = values.size() > 6 ? values.get(6) : 0;

    // Build start date
    Calendar start = new GregorianCalendar(TimeZone.getTimeZone("UTC"));
    start.clear();
    start.set(Calendar.YEAR, year);
    start.set(Calendar.MONTH, month);
    start.set(Calendar.DAY_OF_MONTH, day);
    start.set(Calendar.HOUR_OF_DAY, hour);
    start.set(Calendar.MINUTE, minute);
    start.set(Calendar.SECOND, second);
    start.set(Calendar.MILLISECOND, millis);

    // Build end date: bump the last given value by 1
    Calendar end = new GregorianCalendar(TimeZone.getTimeZone("UTC"));
    end.clear();
    end.set(Calendar.YEAR, year);
    end.set(Calendar.MONTH, month);
    end.set(Calendar.DAY_OF_MONTH, day);
    end.set(Calendar.HOUR_OF_DAY, hour);
    end.set(Calendar.MINUTE, minute);
    end.set(Calendar.SECOND, second);
    end.set(Calendar.MILLISECOND, millis);

    // Bump the last provided component
    switch ( count ) {
      case 1: end.add(Calendar.YEAR, 1); break;
      case 2: end.add(Calendar.MONTH, 1); break;
      case 3: end.add(Calendar.DAY_OF_MONTH, 1); break;
      case 4: end.add(Calendar.HOUR_OF_DAY, 1); break;
      case 5: end.add(Calendar.MINUTE, 1); break;
      case 6: end.add(Calendar.SECOND, 1); break;
      case 7: end.add(Calendar.MILLISECOND, 1); break;
    }

    return new Date[] { start.getTime(), end.getTime() };
  }
}
