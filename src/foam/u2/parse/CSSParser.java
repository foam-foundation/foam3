/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.u2.parse;

import foam.lib.parse.*;
import foam.lib.parse.Optional;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Server-side CSS grammar: parses FOAM css: text into a tree of CSSNode with
 * offsets, so Java code (an audit, a linter) can read CSS the way the browser
 * side does instead of scanning characters.
 *
 * KEEP IN SYNC WITH src/foam/u2/parse/CSSParser.js
 * Problem: this grammar exists twice, here for server-side code and as
 * sheetGrammar_ in CSSParser.js for the browser, and nothing but this note
 * ties them. A rule fixed on one side only makes the two parse the same CSS
 * into different trees, and no build step notices. The two implement the
 * same node model (kinds, fields, offsets, error nodes and messages) and run
 * the same cases: foam.u2.parse.test.CSSParserJavaTest here,
 * foam.u2.parse.test.CSSParserTest there, with the same assertion messages.
 * A change to one grammar lands in the same commit as the matching change to
 * the other, plus the matching test case in both test classes.
 *
 * The rules, node kinds and fields are those of the JS grammar in
 * src/foam/u2/parse/CSSParser.js (sheetGrammar_); its class documentation is
 * the reference for what each node kind means, for error recovery, nesting,
 * MAX_DEPTH and the rewrite hazards. Symbol names below are the JS symbol
 * names, so a rule can be found on both sides by name.
 *
 * Thread safety: the grammar holds no per-parse state. The input string and
 * the nesting counter live in the ParserContext each parse() creates, so one
 * instance can be shared.
 *
 * The autocomplete symbols of CSSParser.js (autocompleteSymbols_(), used by
 * foam.u2.StyleConfigurator) are JS only and have no twin here.
 *
 * Locale and whitespace: JS case folding and \s / trim() do not depend on
 * the JVM locale, while Java's toUpperCase(), toLowerCase() and \s do (a
 * Turkish JVM upper-cases 'important' with a dotted capital I) or cover a different
 * set (\s is ASCII only). So every fold here is ASCII or Locale.ROOT, and
 * JS_WS / jsTrim() stand in for the JS \s and trim() sets.
 *
 * Span and SpanValue are public because the test drives Span directly.
 * Span is general (offsets for any foam.lib.parse grammar) and is a
 * candidate to move to foam.lib.parse once a second grammar needs it.
 */
public class CSSParser {

  // See MAX_DEPTH in CSSParser.js: past this many nested blocks, parens,
  // brackets and functions (counted together) the rest of the nested text is
  // skipped flat, up to the next ';' or '}', as one error node. Depth 64
  // needs roughly 300 KB of thread stack (measured: 128-256 KB stacks
  // overflow at 64 nested blocks or 100 nested functions, 512 KB is fine);
  // below that, parse() catches the StackOverflowError and returns the
  // input as one 'Internal parser failure' error.
  public static final int MAX_DEPTH = 64;

  protected static final String  WS           = " \t\n\r\f";
  protected static final Pattern MATH_FN      = Pattern.compile("(^|-)(calc|min|max|clamp)$", Pattern.CASE_INSENSITIVE);
  protected static final Pattern HEX_COLOR    = Pattern.compile("^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$");
  // The characters JS \s and String.prototype.trim() treat as whitespace.
  // Java's \s is ASCII only and String.trim() strips everything <= U+0020
  // (including U+0001), so '/*\u00A0%NAME%\u00A0*/' or '/*$x\u0001*/'
  // would classify differently from the JS side without this.
  protected static final String  JS_WS        = "\t\n\u000B\f\r \u00A0\u1680" +
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A" +
    "\u2028\u2029\u202F\u205F\u3000\uFEFF";
  protected static final Pattern PLACEHOLDER  = Pattern.compile("^[" + JS_WS + "]*%([A-Za-z0-9_]+)%[" + JS_WS + "]*$");
  // At-rules whose block holds declarations, not rules, so a stray ';' in
  // it is harmless (see fillSemicolons). Lower case.
  protected static final List<String> DECLARATION_AT_RULES = Arrays.asList("font-face", "page", "counter-style", "property",
    "font-palette-values", "color-profile", "view-transition", "position-try");
  protected static final Pattern ESCAPE       = Pattern.compile("\\\\([0-9a-fA-F]{1,6})[ \\t\\n]?|\\\\(?:\\r\\n|[\\n\\r\\f])|\\\\([\\s\\S])|\\\\$");

  // ParserContext key of the per-parse nesting counter (an int[1]).
  protected static final String DEPTH = "css.depth";

  /** Called by walk() for each node; returning false skips the node's children. */
  public interface Visitor {
    boolean visit(CSSNode node, List<CSSNode> ancestors);
  }

  /** Adds fields to a freshly made node; returning false rejects the match. */
  protected interface Build {
    boolean build(CSSNode n, Object v, String str);
  }

  /** One declaration as declarations() lists it. */
  public static class Declaration {
    public CSSNode       node;
    public String        property;
    public String        value;
    public boolean       important;
    public boolean       custom;
    public List<CSSNode> ancestors; // enclosing rules and at-rules, outermost first
    public List<String>  path;      // their labels: '^a, ^b' or '@media (max-width: 600px)'
  }

  /** What a Span with no build function returns: the delegate's value and where it matched. */
  public static class SpanValue {
    public final Object node;
    public final int    start;
    public final int    end;

    public SpanValue(Object node, int start, int end) {
      this.node  = node;
      this.start = start;
      this.end   = end;
    }
  }

  /**
   * Wraps a parser and records where its match starts and ends. No
   * foam.lib.parse combinator reports offsets; this reads ps.pos() before and
   * after the delegate, like foam.parse.Span on the JS side. Without a
   * build function the value is a SpanValue; with one, the value is whatever
   * build(value, start, end, str) returns (str is the whole input), and
   * build returning null fails the parse. Needs a StringPStream, which is
   * what hands it the input string.
   */
  public static class Span implements Parser {
    public interface Builder {
      Object build(Object value, int start, int end, String str);
    }

    protected final Parser  p_;
    protected final Builder build_;

    public Span(Parser p) {
      this(p, null);
    }

    public Span(Parser p, Builder build) {
      p_     = p;
      build_ = build;
    }

    public PStream parse(PStream ps, ParserContext x) {
      int     start = ps.pos();
      PStream res   = ps.apply(p_, x);
      if ( res == null ) return null;
      if ( build_ == null ) return res.setValue(new SpanValue(res.value(), start, res.pos()));
      String str = ((StringPStream) ps).getString().toString();
      Object v   = build_.build(res.value(), start, res.pos(), str);
      return v == null ? null : res.setValue(v);
    }
  }

  /** The unquoted argument of url(): its text and the $name tokens inside it. */
  protected static class UrlRaw {
    String        text;
    List<CSSNode> tokens;
  }

  protected final Grammar grammar_;
  protected Supplier<Collection<String>> tokenNames_ = CSSParser::defaultTokenNames;

  public CSSParser() {
    grammar_ = buildGrammar();
  }

  // ---- token names ----------------------------------------------------------

  /**
   * The token names ($ omitted) this parser knows. Nothing in parsing reads
   * them; they are here so a consumer (an audit that flags unknown tokens)
   * has the same pluggable source as the JS tokenNames. Defaults to the
   * CSSToken constants of the generated foam.u2.CSSTokens class.
   */
  public Collection<String> getTokenNames() {
    return tokenNames_.get();
  }

  public void setTokenNames(Supplier<Collection<String>> supplier) {
    tokenNames_ = supplier == null ? CSSParser::defaultTokenNames : supplier;
  }

  public static Collection<String> defaultTokenNames() {
    List<String> out = new ArrayList<>();
    for ( Field f : foam.u2.CSSTokens.class.getFields() ) {
      if ( ! Modifier.isStatic(f.getModifiers()) || ! foam.u2.CSSToken.class.isAssignableFrom(f.getType()) ) continue;
      try {
        foam.u2.CSSToken t = (foam.u2.CSSToken) f.get(null);
        if ( t != null ) out.add(t.getName());
      } catch (IllegalAccessException e) {
        // public static field; not reachable
      }
    }
    return out;
  }

  // ---- combinator shorthands ------------------------------------------------

  protected static Parser lit(String s)              { return Literal.create(s); }
  // Case-insensitive literal folding ASCII letters only, like the JS
  // literalIC does for these ASCII literals. foam.lib.parse.LiteralIC folds
  // with Character.toUpperCase (so a dotless i, U+0131, matched 'i') and upper-cases
  // the literal with the JVM locale (so under Turkish '!important' never
  // matched).
  protected static Parser litIC(String s) {
    String lower = s.toLowerCase(Locale.ROOT);
    return (ps, x) -> {
      for ( int i = 0 ; i < lower.length() ; i++ ) {
        if ( ! ps.valid() ) return null;
        char c = ps.head();
        if ( c >= 'A' && c <= 'Z' ) c = (char) ( c | 0x20 );
        if ( c != lower.charAt(i) ) return null;
        ps = ps.tail();
      }
      return ps.setValue(s);
    };
  }
  protected static Parser chars(String s)            { return new Chars(s); }
  protected static Parser notChars(String s)         { return new NotChars(s); }
  protected static Parser range(char a, char b)      { return Range.create(a, b); }
  protected static Parser alt(Parser... ps)          { return new Alt(ps); }
  protected static Parser seq(Parser... ps)          { return new Seq(ps); }
  protected static Parser seq1(int i, Parser... ps)  { return new Seq1(i, ps); }
  protected static Parser opt(Parser p)              { return new Optional(p); }
  protected static Parser repeat(Parser p)           { return new Repeat(p); }
  protected static Parser plus(Parser p)             { return new Repeat(p, 1); }
  protected static Parser not(Parser p)              { return new Not(p); }
  protected static Parser substring(Parser p)        { return new Substring(p); }

  // foam.lib.parse.EOF keeps the previous value; the JS eof() yields ''.
  // Rules below compare the closer's value ('}' vs end of input), so this one
  // sets '' to match.
  protected static final Parser EOF_ = (ps, x) -> ps.valid() ? null : ps.setValue("");

  // Succeeds without consuming when p would match (JS peek()).
  protected static Parser peek(Parser p) {
    return (ps, x) -> ps.apply(p, x) != null ? ps.setValue(null) : null;
  }

  // node(kind, p, build): run p, then make { kind, start, end, raw } and let
  // build add fields. build returning false rejects the match.
  protected static Parser node(String kind, Parser p, Build build) {
    return new Span(p, (v, start, end, str) -> {
      CSSNode n = new CSSNode(kind, start, end, str.substring(start, end));
      return build == null || build.build(n, v, str) ? n : null;
    });
  }

  // deep(first, p, fallback): p is a nesting construct. Below MAX_DEPTH it
  // runs p. At MAX_DEPTH, when 'first' matches (so p would have started
  // here), it runs the flat, non-recursive fallback instead.
  protected static Parser deep(Parser first, Parser p, Parser fallback) {
    return (ps, x) -> {
      int[] d = (int[]) x.get(DEPTH);
      if ( d[0] >= MAX_DEPTH ) return ps.apply(first, x) != null ? ps.apply(fallback, x) : null;
      d[0]++;
      try {
        return ps.apply(p, x);
      } finally {
        d[0]--;
      }
    };
  }

  // ---- grammar ----------------------------------------------------------------

  protected Grammar buildGrammar() {
    Grammar g = new Grammar();

    Parser tooDeepValue    = tooDeep(g, false);
    Parser tooDeepSelector = tooDeep(g, true);
    Build  delimValue      = (n, v, str) -> { n.value = n.raw; return true; };

    // ---- whitespace and comments
    g.addSymbol("ws",  plus(chars(WS)));
    g.addSymbol("wsc", repeat(alt(g.sym("ws"), g.sym("comment"))));

    // $name and ^ inside the comment are token and caret nodes (context
    // 'comment', see hazards()) because FOAM rewrites them there too.
    g.addSymbol("comment", node("comment", seq(lit("/*"),
        repeat(alt(g.sym("token"), g.sym("textCaret"), notChars("*$^"), seq(lit("*"), not(lit("/"))), lit("$"), lit("^"))),
        alt(lit("*/"), EOF_)),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.closed = "*/".equals(a[2]);
        n.text   = n.raw.substring(2, n.closed ? n.raw.length() - 2 : n.raw.length());
        Matcher m = PLACEHOLDER.matcher(n.text);
        n.placeholder = m.matches() ? m.group(1) : null;
        fillParts(n, nodes(a[1]), "comment");
        n.token  = n.tokens.size() == 1 && jsTrim(n.text).equals(n.tokens.get(0).raw) ? n.tokens.get(0).raw : null;
        return true;
      }));

    // A '^' inside a string or comment. foam.u2.CSS expandCSS rewrites
    // /\^(.)/g, a '^' followed by any character but a line break, so only
    // that '^' becomes a node.
    g.addSymbol("textCaret", node("caret", seq(lit("^"), peek(notChars("\n\r\u2028\u2029"))), (n, v, str) -> {
      n.inAttr = n.end < str.length() && str.charAt(n.end) == '=';
      return true;
    }));

    // ---- lexical pieces
    g.addSymbol("identStart", alt(range('a', 'z'), range('A', 'Z'), lit("_"), range('\u0080', '\uFFFF')));
    g.addSymbol("identChar",  alt(g.sym("identStart"), range('0', '9'), lit("-")));
    g.addSymbol("identText",  substring(alt(
      seq(lit("--"), repeat(g.sym("identChar"))),
      seq(opt(lit("-")), g.sym("identStart"), repeat(g.sym("identChar"))))));
    g.addSymbol("digits",     plus(range('0', '9')));
    g.addSymbol("string",     alt(g.sym("dqString"), g.sym("sqString")));
    g.addSymbol("dqString",   stringParser(g, '"'));
    g.addSymbol("sqString",   stringParser(g, '\''));

    // ---- value components
    g.addSymbol("value", node("value",
      seq(g.sym("wsc"), plus(alt(g.sym("ws"), g.sym("comment"), g.sym("important"), g.sym("component")))),
      (n, v, str) -> {
        List<CSSNode> comps = nodes(v);
        CSSNode last = null;
        for ( CSSNode c : comps ) if ( ! "comment".equals(c.kind) ) last = c;
        // A value made only of comments is no value: 'color: /*x*/;'
        if ( last == null ) return false;
        List<CSSNode> out = new ArrayList<>();
        for ( CSSNode c : comps ) {
          // A ':' outside ( ) and [ ] is never valid in a value; it usually
          // means a missing ';' merged two declarations.
          if ( "operator".equals(c.kind) && ":".equals(c.value) ) {
            out.add(errorNode(str, c.start, c.end, "':' inside a value: is a ';' missing before it?"));
          } else if ( "important".equals(c.kind) && c != last ) {
            out.add(errorNode(str, c.start, c.end, "!important must be the last part of a value"));
          } else {
            out.add(c);
          }
        }
        n.components = out;
        n.important  = "important".equals(last.kind);
        trimTo(n, comps.get(0).start, comps.get(comps.size() - 1).end, str);
        return true;
      }));

    g.addSymbol("important", node("important", seq(lit("!"), g.sym("wsc"), litIC("important")), null));

    g.addSymbol("component", alt(
      g.sym("url"),
      g.sym("function"),
      g.sym("number"),
      g.sym("hash"),
      g.sym("token"),
      g.sym("placeholder"),
      g.sym("string"),
      g.sym("ident"),
      g.sym("paren"),
      g.sym("bracket"),
      g.sym("operator"),
      g.sym("delim")));

    // Stop points for an unclosed ( or [; not consumed.
    g.addSymbol("unclosed", peek(alt(chars(";{}"), EOF_)));

    // Inside ( ) a stray ']' is a delim, inside [ ] a stray ')'.
    g.addSymbol("parenArgs",   repeat(alt(g.sym("ws"), g.sym("comment"), g.sym("component"), node("delim", lit("]"), delimValue))));
    g.addSymbol("bracketArgs", repeat(alt(g.sym("ws"), g.sym("comment"), g.sym("component"), node("delim", lit(")"), delimValue))));

    g.addSymbol("function", deep(seq(g.sym("identText"), lit("(")), node("function",
      seq(g.sym("identText"), lit("("), g.sym("parenArgs"), alt(lit(")"), g.sym("unclosed"))),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.name   = (String) a[0];
        n.args   = nodes(a[2]);
        n.closed = ")".equals(a[3]);
        return true;
      }), tooDeepValue));

    g.addSymbol("url", node("url",
      seq(litIC("url("), g.sym("wsc"), alt(g.sym("string"), g.sym("urlRaw")), g.sym("wsc"), lit(")")),
      (n, v, str) -> {
        Object a = ((Object[]) v)[2];
        n.quoted = a instanceof CSSNode;
        if ( n.quoted ) {
          n.arg    = (CSSNode) a;
          n.value  = n.arg.value;
          n.tokens = new ArrayList<>();
        } else {
          n.value  = ((UrlRaw) a).text;
          n.tokens = ((UrlRaw) a).tokens;
        }
        return true;
      }));

    // Unquoted url() argument. ';' and braces are plain text, as in a
    // browser, so an SVG data URL with a style inside
    // (url(data:image/svg+xml;utf8,<svg><style>a{fill:red}...)) parses whole
    // up to the first whitespace or ')'; it used to end at the first '{'.
    // '(' still ends it, so an unclosed 'url(' in minified CSS stops at the
    // next 'url(' instead of scanning to end of input (quadratic).
    g.addSymbol("urlRaw", new Span(plus(alt(g.sym("token"), notChars(")(\"'" + WS))), (v, start, end, str) -> {
      UrlRaw u = new UrlRaw();
      u.text   = str.substring(start, end);
      u.tokens = hazardParts(nodes(v), "url");
      return u;
    }));

    g.addSymbol("paren", deep(lit("("), node("paren", seq(lit("("), g.sym("parenArgs"), alt(lit(")"), g.sym("unclosed"))),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.components = nodes(a[1]);
        n.closed     = ")".equals(a[2]);
        return true;
      }), tooDeepValue));

    g.addSymbol("bracket", deep(lit("["), node("bracket", seq(lit("["), g.sym("bracketArgs"), alt(lit("]"), g.sym("unclosed"))),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.components = nodes(a[1]);
        n.closed     = "]".equals(a[2]);
        return true;
      }), tooDeepValue));

    // The exponent needs a digit after the 'e', so '1em' is 1 + 'em'.
    g.addSymbol("number", node("number", seq(
        opt(chars("+-")),
        alt(seq(g.sym("digits"), opt(seq(lit("."), g.sym("digits")))), seq(lit("."), g.sym("digits"))),
        opt(seq(chars("eE"), opt(chars("+-")), g.sym("digits"))),
        opt(alt(lit("%"), substring(plus(alt(range('a', 'z'), range('A', 'Z'))))))),
      (n, v, str) -> {
        Object unit = ((Object[]) v)[3];
        n.unit  = unit == null ? "" : (String) unit;
        n.value = Double.valueOf(n.raw.substring(0, n.raw.length() - n.unit.length()));
        return true;
      }));

    g.addSymbol("hash", node("hash", seq(lit("#"), plus(g.sym("identChar"))), (n, v, str) -> {
      n.value      = n.raw.substring(1);
      n.isHexColor = HEX_COLOR.matcher(n.raw.substring(1)).matches();
      return true;
    }));

    g.addSymbol("tokenChar", alt(range('a', 'z'), range('A', 'Z'), range('0', '9'), chars("_$-")));

    g.addSymbol("token", node("token",
      seq(lit("$"), plus(g.sym("tokenChar")), repeat(seq(lit("."), plus(g.sym("tokenChar"))))),
      (n, v, str) -> { fillToken(n); return true; }));

    g.addSymbol("placeholder", node("placeholder",
      seq(lit("%"), plus(alt(range('A', 'Z'), range('a', 'z'), range('0', '9'), lit("_"))), lit("%")),
      (n, v, str) -> { n.name = n.raw.substring(1, n.raw.length() - 1); return true; }));

    g.addSymbol("ident",    node("ident", g.sym("identText"), (n, v, str) -> { n.value = n.raw; return true; }));
    g.addSymbol("operator", node("operator", chars(",/*+-=:<>"), delimValue));
    g.addSymbol("delim",    node("delim", notChars(WS + ";{}()[]\"'"), delimValue));

    // ---- statements
    g.addSymbol("START", g.sym("stylesheet"));

    g.addSymbol("stylesheet", node("stylesheet",
      repeat(alt(g.sym("ws"), g.sym("comment"), g.sym("item"), g.sym("semicolon"), g.sym("strayClose"))),
      (n, v, str) -> { n.children = nodes(v); return true; }));

    g.addSymbol("item", alt(
      g.sym("atRule"),
      g.sym("customDeclaration"),
      g.sym("declaration"),
      g.sym("placeholderStatement"),
      g.sym("lineComment"),
      g.sym("rule"),
      g.sym("recover")));

    // A ';' between statements, which no statement took as its end. A marker
    // node here; once the tree is built, fillSemicolons turns it into an
    // error node or drops it, by where it stands.
    g.addSymbol("semicolon", node("semicolon", lit(";"), null));

    // Problem: CSS has no '//' comments. A browser reads '// note' as
    // the start of a selector or declaration and drops that whole
    // statement: '// note\nb{color:blue}' loses the b rule and
    // 'b{ // note\n color:blue }' loses color. Here the first parsed as
    // one rule whose selector began with '// note', with no error. Now
    // the statement the '//' starts is one error node spanning what the
    // browser drops: up to the next ';', through a '{ }' block, or up to
    // the '}' that closes the enclosing block. A line break does not end
    // it. Strings, comments and ( ) inside are skipped whole, so a ';' or
    // '}' in them does not end it. A '//' inside a string, comment or
    // url() is text of that node.
    g.addSymbol("lineComment", node("error",
      seq(lit("//"), repeat(alt(g.sym("comment"), g.sym("string"), g.sym("skipParen"), notChars(";{}"))), opt(g.sym("skipBrace"))),
      (n, v, str) -> {
        n.message = "'//' is not a CSS comment: the browser drops the statement it starts; use /* */";
        trimEnd(n, str);
        return true;
      }));

    // Problem: FOAM's returnExpandedCSS replaces a statement-level
    // '%CUSTOMCSS%;' (foam.core.u2.navigation.Stack) or a whole css:
    // '%CUSTOMCSS%' (foam.u2.layout.MDStackView) with theme CSS before the
    // browser sees it, but it read here as 'Not a declaration, rule or
    // at-rule'. A %NAME% standing alone is a placeholder statement; one glued
    // to more text ('%X%.a { }') is left to rule and recover.
    g.addSymbol("placeholderStatement", node("placeholder",
      seq(g.sym("placeholder"), peek(alt(chars(WS + ";}"), lit("/*"), EOF_)), opt(seq(opt(g.sym("ws")), lit(";")))),
      (n, v, str) -> { n.name = ((CSSNode) ((Object[]) v)[0]).name; return true; }));

    // '{' items '}'. Never fails once '{' is seen. At MAX_DEPTH the value is
    // an error node instead (see fillBlock).
    g.addSymbol("block", deep(lit("{"), new Span(seq(lit("{"),
      repeat(alt(g.sym("ws"), g.sym("comment"), g.sym("item"), g.sym("semicolon"))),
      alt(lit("}"), EOF_))), tooDeepValue));

    g.addSymbol("rule", node("rule", seq(new Repeat(g.sym("selector"), lit(","), 1), g.sym("block")), (n, v, str) -> {
      Object[] a = (Object[]) v;
      n.selectors = nodes(a[0]);
      fillBlock(n, a[1], str);
      return true;
    }));

    g.addSymbol("selector", node("selector",
      plus(alt(g.sym("comment"), g.sym("string"), g.sym("caret"), g.sym("token"), g.sym("selParen"), g.sym("selBracket"),
        notChars("{};,([\"'^"))),
      (n, v, str) -> {
        int s = n.start, e = n.end;
        while ( s < e && WS.indexOf(str.charAt(s))     != -1 ) s++;
        while ( e > s && WS.indexOf(str.charAt(e - 1)) != -1 ) e--;
        if ( s == e ) return false;
        trimTo(n, s, e, str);
        n.parts  = nodes(v);
        n.carets = ofKind(n.parts, "caret");
        n.tokens = ofKind(n.parts, "token");
        return true;
      }));

    // FOAM expands every '^', including the one in [class^=x].
    g.addSymbol("caret", node("caret", lit("^"), (n, v, str) -> {
      n.inAttr  = n.end < str.length() && str.charAt(n.end) == '=';
      n.context = null;
      return true;
    }));

    g.addSymbol("selParen", deep(lit("("), seq(lit("("), repeat(alt(g.sym("comment"), g.sym("string"), g.sym("caret"), g.sym("token"),
      g.sym("selParen"), g.sym("selBracket"), notChars("{};()[\"'^"))), opt(lit(")"))), tooDeepSelector));

    g.addSymbol("selBracket", deep(lit("["), seq(lit("["), repeat(alt(g.sym("comment"), g.sym("string"), g.sym("caret"), g.sym("token"),
      g.sym("selParen"), g.sym("selBracket"), notChars("{};]([\"'^"))), opt(lit("]"))), tooDeepSelector));

    g.addSymbol("atRule", node("atrule",
      seq(lit("@"), substring(plus(g.sym("identChar"))), g.sym("prelude"), alt(lit(";"), g.sym("block"), peek(lit("}")), EOF_)),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.name    = ((String) a[1]).toLowerCase(Locale.ROOT);
        n.prelude = (CSSNode) a[2];
        if ( a[3] instanceof SpanValue || a[3] instanceof CSSNode ) {
          fillBlock(n, a[3], str);
        } else {
          n.children = null;
          n.closed   = true;
        }
        trimEnd(n, str);
        return true;
      }));

    g.addSymbol("prelude", node("prelude",
      repeat(alt(g.sym("ws"), g.sym("comment"), g.sym("component"), node("delim", chars(")]"), delimValue))),
      (n, v, str) -> {
        n.components = nodes(v);
        List<CSSNode> c = n.components;
        if ( c.isEmpty() ) trimTo(n, n.start, n.start, str);
        else trimTo(n, c.get(0).start, c.get(c.size() - 1).end, str);
        return true;
      }));

    g.addSymbol("property", node("property", g.sym("identText"), (n, v, str) -> { n.name = n.raw; return true; }));

    g.addSymbol("declaration", node("declaration",
      seq(g.sym("property"), g.sym("wsc"), lit(":"), g.sym("value"), g.sym("declEnd")),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.property  = (CSSNode) a[0];
        n.comments  = nodes(a[1]);
        n.value     = a[3];
        n.important = ((CSSNode) a[3]).important;
        n.custom    = false;
        trimEnd(n, str);
        return true;
      }));

    // A declaration ends at ';' (kept in its span), or just before '}' or end
    // of input. Anything else, notably '{', means it was not a declaration.
    g.addSymbol("declEnd", alt(lit(";"), peek(lit("}")), EOF_));

    g.addSymbol("customProperty", node("property", substring(seq(lit("--"), repeat(g.sym("identChar")))),
      (n, v, str) -> { n.name = n.raw; return true; }));

    g.addSymbol("customDeclaration", node("declaration",
      seq(g.sym("customProperty"), g.sym("wsc"), lit(":"), g.sym("customValue"), g.sym("declEnd")),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.property  = (CSSNode) a[0];
        n.comments  = nodes(a[1]);
        n.value     = a[3];
        n.important = ((CSSNode) a[3]).important;
        n.custom    = true;
        trimEnd(n, str);
        return true;
      }));

    // '--foo: anything' keeps the text raw; parts holds the comments,
    // strings, tokens and name( ) functions found in it.
    //
    // Problem: '--gap: 4px !important' read as important false with the value
    // '4px !important', although a browser applies it as important with the
    // value 4px. A !important followed only by whitespace, comments and the
    // declaration's end is split off: important is true and the value's span
    // ends before the '!' (the comments after it are not kept). One followed
    // by more text stays raw text.
    g.addSymbol("customValue", node("value",
      seq(
        repeat(new Not(g.sym("trailingImportant"), alt(g.sym("comment"), g.sym("string"), g.sym("token"), g.sym("rawFunction"),
          plus(g.sym("identChar")), g.sym("skipParen"), g.sym("skipBrace"), notChars(";{}(\"'")))),
        opt(g.sym("trailingImportant"))),
      (n, v, str) -> {
        Object[] a   = (Object[]) v;
        CSSNode  imp = (CSSNode) a[1];
        int s = n.start, e = imp != null ? imp.start : n.end;
        while ( s < e && WS.indexOf(str.charAt(s))     != -1 ) s++;
        while ( e > s && WS.indexOf(str.charAt(e - 1)) != -1 ) e--;
        trimTo(n, s, e, str);
        n.components = null;
        n.important  = imp != null;
        n.parts      = nodes(a[0]);
        List<CSSNode> toks = new ArrayList<>();
        CSSNode holder = new CSSNode("value", 0, 0, "");
        holder.components = n.parts;
        walk(holder, (t, anc) -> {
          if ( "token".equals(t.kind) && t.context == null ) toks.add(t);
          return true;
        });
        n.tokens = toks;
        return true;
      }));

    // The important node, when only whitespace and comments separate it
    // from the end of the declaration (see customValue).
    g.addSymbol("trailingImportant", seq1(0, g.sym("important"), g.sym("wsc"), peek(alt(chars(";}"), EOF_))));

    g.addSymbol("rawFunction", deep(seq(g.sym("identText"), lit("(")), node("function",
      seq(g.sym("identText"), lit("("), repeat(alt(g.sym("comment"), g.sym("string"), g.sym("token"), g.sym("rawFunction"),
        plus(g.sym("identChar")), g.sym("skipParen"), g.sym("skipBrace"), notChars(")}{(\"'"))), opt(lit(")"))),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.name   = (String) a[0];
        n.args   = nodes(a[2]);
        n.closed = ")".equals(a[3]);
        return true;
      }), tooDeepValue));

    // ---- error recovery
    // Skip one malformed statement: up to (and eating) the next ';', or up to
    // (not eating) the next '}', at the current depth.
    g.addSymbol("recover", seq1(0,
      node("error", plus(g.sym("skipAtom")), (n, v, str) -> {
        n.message = "Not a declaration, rule or at-rule";
        trimEnd(n, str);
        return true;
      }),
      opt(lit(";"))));

    g.addSymbol("skipAtom", alt(g.sym("comment"), g.sym("string"), g.sym("skipParen"), g.sym("skipBrace"), notChars(";}")));

    // A '}' at depth 0 ends a paren too, so an unbalanced '(' cannot swallow
    // the end of the enclosing block.
    g.addSymbol("skipParen", deep(lit("("), seq(lit("("), repeat(alt(g.sym("comment"), g.sym("string"), g.sym("token"),
      g.sym("skipParen"), g.sym("skipBrace"), notChars(")}{(\"'"))), opt(lit(")"))), tooDeepValue));

    g.addSymbol("skipBrace", deep(lit("{"), seq(lit("{"), repeat(alt(g.sym("comment"), g.sym("string"), g.sym("token"),
      g.sym("skipParen"), g.sym("skipBrace"), notChars("{}(\"'"))), opt(lit("}"))), tooDeepValue));

    // A run of stray '}' is one error, not one per brace.
    g.addSymbol("strayClose", node("error", seq(lit("}"), repeat(alt(g.sym("ws"), lit("}")))), (n, v, str) -> {
      n.message = "Unexpected }";
      trimEnd(n, str);
      return true;
    }));

    // Entry point of parseValue(): a value and nothing after it.
    g.addSymbol("valueOnly", seq1(0, g.sym("value"), EOF_));

    return g;
  }

  // The MAX_DEPTH fallback: skip the too-deep construct with a loop that
  // counts ( [ and { against their closers instead of recursing, so the
  // enclosing levels still close normally. It stops, unconsumed, at a closer
  // it did not open, at ';' outside its own brackets and, for selectors, at
  // any { } ;. Once it has opened something it stops right after the closer
  // that balances it. Comments and strings are skipped whole. Same loop as
  // tooDeep in CSSParser.js.
  protected static Parser tooDeep(Grammar g, boolean selector) {
    Parser comment = g.sym("comment");
    Parser string  = g.sym("string");
    Parser skip = (ps, x) -> {
      int     paren = 0, brace = 0, start = ps.pos();
      boolean opened = false;
      PStream r;
      while ( ps.valid() ) {
        if ( ( r = ps.apply(comment, x) ) != null || ( r = ps.apply(string, x) ) != null ) { ps = r; continue; }
        char c = ps.head();
        if ( selector && ( c == '{' || c == '}' || c == ';' ) ) break;
        if ( c == ';' && paren == 0 && brace == 0 ) break;
        if ( c == '(' || c == '[' ) { paren++; opened = true; }
        else if ( c == '{' ) { brace++; opened = true; }
        else if ( c == ')' || c == ']' ) { if ( paren == 0 ) break; paren--; }
        else if ( c == '}' ) { if ( brace == 0 ) break; brace--; }
        ps = ps.tail();
        if ( opened && paren == 0 && brace == 0 ) break;
      }
      return ps.pos() > start ? ps.setValue(null) : null;
    };
    return node("error", skip, (n, v, str) -> {
      n.message = "Nested deeper than " + MAX_DEPTH + " levels: skipped";
      trimEnd(n, str);
      return true;
    });
  }

  // A backslash escapes the next character, including the quote and a line
  // break (CR LF counts as one). An unterminated string is marked closed
  // false instead of failing, so one missing quote cannot make the grammar
  // retry every shorter reading of the rest. $name and ^ inside are token and
  // caret nodes with context 'string'.
  //
  // An unterminated string ends before the next unescaped line break (LF, CR
  // or FF), as CSS Syntax's bad-string does. Problem: running to the end of
  // input, one stray quote hid the rest of its css: block from
  // declarations() and tokens(), e.g. the quote before "bold;" in
  // "font-weight': 'bold;" (DateTimePicker) took in every rule after it. Now
  // the damage stops at the enclosing statement's next ';' or '}', where a
  // browser recovers too, and only that statement is lost.
  protected static Parser stringParser(Grammar g, char q) {
    String qs = String.valueOf(q);
    return node("string", seq(
        lit(qs),
        repeat(alt(g.sym("token"), g.sym("textCaret"), seq(lit("\\"), opt(alt(lit("\r\n"), AnyChar.instance()))),
          notChars(qs + "\\\n\r\f"))),
        alt(lit(qs), peek(chars("\n\r\f")), EOF_)),
      (n, v, str) -> {
        Object[] a = (Object[]) v;
        n.quote  = qs;
        n.closed = qs.equals(a[2]);
        n.value  = unescape(n.raw.substring(1, n.closed ? n.raw.length() - 1 : n.raw.length()));
        fillParts(n, nodes(a[1]), "string");
        return true;
      });
  }

  // ---- node helpers -----------------------------------------------------------

  // CSS escapes: \26 or \000026 (hex, one optional trailing space),
  // backslash-line-break (line continuation, dropped; the break is LF, CR LF,
  // CR or FF, as the string grammar reads it), backslash-any.
  protected static String unescape(String s) {
    Matcher       m  = ESCAPE.matcher(s);
    StringBuilder sb = new StringBuilder();
    int           at = 0;
    while ( m.find() ) {
      sb.append(s, at, m.start());
      if ( m.group(1) != null ) {
        int cp = Math.min(Integer.parseInt(m.group(1), 16), 0x10FFFF);
        sb.appendCodePoint(cp == 0 ? 0xFFFD : cp);
      } else if ( m.group(2) != null ) {
        sb.append(m.group(2));
      }
      at = m.end();
    }
    sb.append(s, at, s.length());
    return sb.toString();
  }

  // $primary$hover -> base 'primary', variants ['hover'];
  // $foam.u2.Tabs.tabColor -> cls 'foam.u2.Tabs', base 'tabColor'.
  protected static void fillToken(CSSNode n) {
    n.name     = n.raw.substring(1);
    int dot    = n.name.lastIndexOf('.');
    n.cls      = dot == -1 ? null : n.name.substring(0, dot);
    String[] p = n.name.substring(dot + 1).split("\\$", -1);
    n.base     = p[0];
    n.variants = new ArrayList<>(Arrays.asList(p).subList(1, p.length));
    n.inMath   = false;
    n.context  = null;
  }

  // Tokens and carets inside a comment, string or unquoted url(): FOAM's
  // regex rewrites rewrite them anyway (see hazards()).
  protected static List<CSSNode> hazardParts(List<CSSNode> list, String context) {
    List<CSSNode> out = new ArrayList<>();
    for ( CSSNode t : list ) {
      if ( "token".equals(t.kind) || "caret".equals(t.kind) ) {
        t.context = context;
        out.add(t);
      }
    }
    return out;
  }

  protected static void fillParts(CSSNode n, List<CSSNode> list, String context) {
    n.parts  = hazardParts(list, context);
    n.tokens = ofKind(n.parts, "token");
    n.carets = ofKind(n.parts, "caret");
  }

  protected static List<CSSNode> ofKind(List<CSSNode> list, String kind) {
    List<CSSNode> out = new ArrayList<>();
    for ( CSSNode n : list ) if ( kind.equals(n.kind) ) out.add(n);
    return out;
  }

  // String.prototype.trim(): strips JS_WS from both ends.
  protected static String jsTrim(String s) {
    int b = 0, e = s.length();
    while ( b < e && JS_WS.indexOf(s.charAt(b))     != -1 ) b++;
    while ( e > b && JS_WS.indexOf(s.charAt(e - 1)) != -1 ) e--;
    return s.substring(b, e);
  }

  protected static void trimTo(CSSNode n, int start, int end, String str) {
    n.start = start;
    n.end   = end;
    n.raw   = str.substring(start, end);
  }

  protected static void trimEnd(CSSNode n, String str) {
    int e = n.end;
    while ( e > n.start && WS.indexOf(str.charAt(e - 1)) != -1 ) e--;
    trimTo(n, n.start, e, str);
  }

  // Problem: a ';' where a rule may start is not skipped by a browser:
  // it becomes the first token of the next rule's selector, so
  // 'a{color:red};b{color:blue}' loses the b rule (Chromium keeps only
  // a), and so do '@media all { a{}; b{} }', @layer, @supports and
  // @keyframes. Where declarations may stand the browser skips it:
  // 'b{;color:blue;;}', 'b{ &:hover{}; color:blue }',
  // '@font-face{font-family:x;;src:url(a.woff)}', an at-rule nested in
  // a style rule, 'x{ @media all { a{}; b{} } }', and one nested in a
  // declaration at-rule, '@page { @top-left { a:1;; } }'. A ';' with no
  // rule after it ('a{};', 'color:red;;margin:0') loses nothing.
  // So a 'semicolon' marker the grammar leaves in children becomes an
  // error node when the next child that is not a comment is a rule or
  // at-rule, and the marker stands at stylesheet level or in the block
  // of an at-rule not in DECLARATION_AT_RULES with no style rule or
  // DECLARATION_AT_RULES at-rule around it. Every other marker is
  // dropped. Run on the finished tree because the enclosing nodes are
  // only known once the whole tree is built.
  protected static void fillSemicolons(CSSNode tree, String str) {
    walk(tree, (n, ancestors) -> {
      if ( n.children == null ) return true;
      boolean keep = "stylesheet".equals(n.kind);
      if ( "atrule".equals(n.kind) && ! DECLARATION_AT_RULES.contains(n.name) ) {
        keep = true;
        for ( CSSNode a : ancestors ) {
          if ( "rule".equals(a.kind) || ( "atrule".equals(a.kind) && DECLARATION_AT_RULES.contains(a.name) ) ) keep = false;
        }
      }
      List<CSSNode> kids = n.children, out = new ArrayList<>();
      for ( int i = 0 ; i < kids.size() ; i++ ) {
        CSSNode c = kids.get(i);
        if ( ! "semicolon".equals(c.kind) ) { out.add(c); continue; }
        if ( ! keep ) continue;
        int j = i + 1;
        while ( j < kids.size() && "comment".equals(kids.get(j).kind) ) j++;
        if ( j < kids.size() && ( "rule".equals(kids.get(j).kind) || "atrule".equals(kids.get(j).kind) ) ) {
          out.add(errorNode(str, c.start, c.end, "';' between rules: the browser drops the rule after it"));
        }
      }
      n.children = out;
      return true;
    });
  }

  protected static CSSNode errorNode(String str, int start, int end, String message) {
    CSSNode n = new CSSNode("error", start, end, str.substring(start, end));
    n.message = message;
    return n;
  }

  // Flatten a combinator result (nested Object[], Characters and Strings for
  // skipped whitespace and punctuation) down to the nodes inside it.
  protected static List<CSSNode> nodes(Object v) {
    List<CSSNode> out = new ArrayList<>();
    collect(v, out);
    return out;
  }

  protected static void collect(Object v, List<CSSNode> out) {
    if ( v instanceof Object[] ) {
      for ( Object o : (Object[]) v ) collect(o, out);
    } else if ( v instanceof CSSNode ) {
      out.add((CSSNode) v);
    }
  }

  // block is the SpanValue of the 'block' symbol, { [ '{', items, '}' or '' ],
  // start, end }, or, past MAX_DEPTH, the error node that skipped it.
  protected static void fillBlock(CSSNode n, Object block, String str) {
    if ( block instanceof CSSNode ) {
      n.children = new ArrayList<>(Collections.singletonList((CSSNode) block));
      n.closed   = false;
      return;
    }
    SpanValue sv  = (SpanValue) block;
    Object[]  seq = (Object[]) sv.node;
    n.children = nodes(seq[1]);
    n.closed   = "}".equals(seq[2]);
    // First, so children stay in input order: the error spans the '{'.
    if ( ! n.closed ) n.children.add(0, errorNode(str, sv.start, sv.start + 1, "Unclosed block: missing }"));
  }

  // ---- public API ---------------------------------------------------------------

  protected ParserContext context(String str) {
    ParserContext x = new ParserContextImpl();
    x.set(DEPTH, new int[1]);
    return x;
  }

  /**
   * Parse a whole stylesheet (or an inline declaration list) into a
   * 'stylesheet' node. Never throws: malformed input yields 'error' nodes,
   * and an internal failure yields a stylesheet holding one error node that
   * spans the whole input.
   */
  public CSSNode parse(String str) {
    if ( str == null ) str = "";
    CSSNode tree;
    try {
      PStream r = grammar_.parse(new StringPStream(str), context(str), "START");
      tree = r == null ? null : (CSSNode) r.value();
    } catch (RuntimeException | StackOverflowError e) {
      // A StackOverflowError is possible on a thread stack below ~300 KB
      // (see MAX_DEPTH); either way the promise 'never throws' holds.
      tree = null;
    }
    if ( tree == null ) {
      tree = new CSSNode("stylesheet", 0, str.length(), str);
      tree.children = new ArrayList<>();
      if ( str.length() > 0 ) tree.children.add(errorNode(str, 0, str.length(), "Internal parser failure"));
    } else if ( tree.end < str.length() ) {
      // Not expected (every character has a rule); kept so the tree always
      // covers the input.
      tree.children.add(errorNode(str, tree.end, str.length(), "Unparsed input"));
      trimTo(tree, 0, str.length(), str);
    }
    fillSemicolons(tree, str);
    markMath(tree);
    return tree;
  }

  /**
   * Parse one declaration value ('1px solid $border') into a value node, or
   * return null when str is not a single value. Offsets are into str.
   */
  public CSSNode parseValue(String str) {
    if ( str == null ) return null;
    try {
      PStream r = grammar_.parse(new StringPStream(str), context(str), "valueOnly");
      CSSNode v = r == null ? null : (CSSNode) r.value();
      if ( v != null ) markMath(v);
      return v;
    } catch (RuntimeException | StackOverflowError e) {
      return null;
    }
  }

  protected static void markMath(CSSNode tree) {
    walk(tree, (n, ancestors) -> {
      if ( "token".equals(n.kind) ) {
        n.inMath = false;
        for ( CSSNode a : ancestors ) {
          if ( "function".equals(a.kind) && MATH_FN.matcher(a.name).find() ) n.inMath = true;
        }
      }
      return true;
    });
  }

  /**
   * Visit every node depth-first in input order. The visitor gets the chain
   * of enclosing nodes, outermost first; returning false skips that node's
   * children.
   */
  public static void walk(CSSNode tree, Visitor fn) {
    if ( tree != null ) visit(tree, new ArrayList<>(), fn);
  }

  protected static void visit(CSSNode n, List<CSSNode> ancestors, Visitor fn) {
    if ( ! fn.visit(n, ancestors) ) return;
    List<CSSNode> kids = n.childNodes();
    if ( kids.isEmpty() ) return;
    List<CSSNode> next = new ArrayList<>(ancestors);
    next.add(n);
    for ( CSSNode k : kids ) visit(k, next, fn);
  }

  /**
   * Flat list of declarations in input order, with the enclosing rules and
   * at-rules and their labels, outermost first. A declaration whose value
   * holds an error or open node (a cut string, a stray ':') is still listed
   * although a browser drops it, so an audit cross-checks errors().
   */
  public static List<Declaration> declarations(CSSNode tree) {
    List<Declaration> out = new ArrayList<>();
    walk(tree, (n, ancestors) -> {
      if ( ! "declaration".equals(n.kind) ) return true;
      Declaration d = new Declaration();
      d.node      = n;
      d.property  = n.property.name;
      d.value     = n.valueNode().raw;
      d.important = n.important;
      d.custom    = n.custom;
      d.ancestors = new ArrayList<>();
      d.path      = new ArrayList<>();
      for ( CSSNode a : ancestors ) {
        if ( "rule".equals(a.kind) ) {
          List<String> sels = new ArrayList<>();
          for ( CSSNode s : a.selectors ) sels.add(s.raw);
          d.ancestors.add(a);
          d.path.add(String.join(", ", sels));
        } else if ( "atrule".equals(a.kind) ) {
          d.ancestors.add(a);
          d.path.add("@" + a.name + ( a.prelude.raw.isEmpty() ? "" : " " + a.prelude.raw ));
        }
      }
      out.add(d);
      return false;
    });
    return out;
  }

  /**
   * Every $token reference meant as one (context null), from values,
   * selectors and custom property values. Occurrences inside a comment,
   * string or unquoted url() are left to hazards().
   */
  public static List<CSSNode> tokens(CSSNode tree) {
    List<CSSNode> out = new ArrayList<>();
    walk(tree, (n, a) -> {
      if ( "token".equals(n.kind) && n.context == null ) out.add(n);
      return true;
    });
    return out;
  }

  /**
   * Text FOAM rewrites before the CSS reaches the browser, where the rewrite
   * breaks it: token nodes with context 'comment', 'string' or 'url'; caret
   * nodes with context 'string' or 'comment' (expandCSS rewrites every '^'
   * in the css text, so content: "^" becomes class selector text); and
   * caret nodes with inAttr (the '^' of [class^=x]). See hazards() in
   * CSSParser.js for the details of each rewrite.
   */
  public static List<CSSNode> hazards(CSSNode tree) {
    List<CSSNode> out = new ArrayList<>();
    walk(tree, (n, a) -> {
      if ( ( "token".equals(n.kind) || "caret".equals(n.kind) ) && n.context != null ) out.add(n);
      else if ( "caret".equals(n.kind) && n.inAttr ) out.add(n);
      return true;
    });
    return out;
  }

  /**
   * Every 'error' node, plus string, comment, function, paren and bracket
   * nodes left open (closed false). Of nested open nodes only the outermost
   * is listed, but 'error' nodes inside it (a MAX_DEPTH skip, a misplaced
   * !important) still are. An open rule or at-rule block already has an
   * 'error' node. Open nodes carry no message: a listed string with closed
   * false is one cut by a line break or the end of input.
   */
  public static List<CSSNode> errors(CSSNode tree) {
    List<CSSNode> out = new ArrayList<>();
    walk(tree, (n, ancestors) -> {
      if ( "error".equals(n.kind) ) {
        out.add(n);
      } else if ( isOpen(n) ) {
        boolean inOpen = false;
        for ( CSSNode a : ancestors ) if ( isOpen(a) ) inOpen = true;
        if ( ! inOpen ) out.add(n);
      }
      return true;
    });
    return out;
  }

  protected static boolean isOpen(CSSNode n) {
    return Boolean.FALSE.equals(n.closed) && ! "rule".equals(n.kind) && ! "atrule".equals(n.kind);
  }
}
