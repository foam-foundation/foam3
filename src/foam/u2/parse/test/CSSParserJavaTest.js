/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.parse.test',
  name: 'CSSParserJavaTest',
  extends: 'foam.core.test.Test',

  documentation: `
    The Java CSS grammar, src/foam/u2/parse/CSSParser.java, checked with the
    same cases as foam.u2.parse.test.CSSParserTest (the JS grammar), one for
    one and with the same assertion messages, so a failure names the same case
    on both sides. The JS test's autocomplete checks have no Java counterpart;
    testTokenNames covers the pluggable token-name source instead. A case
    added or changed here gets its twin in CSSParserTest in the same commit;
    see the sync note in CSSParser.js and CSSParser.java.

    Reads src/foam/u2/theme/ThemeGlyphs.js under the System property
    project.home for the long-line case, falling back to the shortened glyph
    the JS test also falls back to.

    Backslashes below are doubled: this javaCode is a JS template literal.
  `,

  javaImports: [
    'foam.lib.parse.*',
    'foam.u2.parse.CSSNode',
    'foam.u2.parse.CSSParser',
    'java.lang.reflect.Field',
    'java.lang.reflect.Modifier',
    'java.nio.charset.StandardCharsets',
    'java.nio.file.Files',
    'java.nio.file.Paths',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.Collections',
    'java.util.IdentityHashMap',
    'java.util.List',
    'java.util.Locale',
    'java.util.Set'
  ],

  javaCode: `
  // One check whose condition may throw (a missing node, a wrong cast):
  // that counts as a failure with the same message, the way a JS 'v && ...'
  // chain evaluates to false.
  protected interface Cond { boolean get() throws Exception; }
  protected interface Text { String get() throws Exception; }

  protected void t(Cond c, String message) {
    boolean ok;
    try {
      ok = c.get();
    } catch (Throwable e) {
      ok = false;
    }
    test(ok, message);
  }

  protected static String s(Text f) {
    try {
      return f.get();
    } catch (Throwable e) {
      return "?";
    }
  }

  // Every CSSNode reachable through any field, found by reflection rather
  // than CSSNode.childNodes() or CSSParser.walk(), so the check does not
  // trust the code it checks.
  protected static List<CSSNode> allNodes(CSSNode tree) {
    List<CSSNode> out  = new ArrayList<>();
    Set<Object>   seen = Collections.newSetFromMap(new IdentityHashMap<>());
    collectAll(tree, out, seen);
    return out;
  }

  protected static void collectAll(Object v, List<CSSNode> out, Set<Object> seen) {
    if ( v == null || ! seen.add(v) ) return;
    if ( v instanceof List ) {
      for ( Object o : (List) v ) collectAll(o, out, seen);
      return;
    }
    if ( ! ( v instanceof CSSNode ) ) return;
    out.add((CSSNode) v);
    for ( Field f : CSSNode.class.getFields() ) {
      if ( Modifier.isStatic(f.getModifiers()) ) continue;
      try {
        collectAll(f.get(v), out, seen);
      } catch (IllegalAccessException e) {
        // public field
      }
    }
  }

  protected void spansMatch(String input, CSSNode tree, String label) {
    List<CSSNode> bad = new ArrayList<>();
    for ( CSSNode n : allNodes(tree) ) {
      if ( n.raw == null || n.start < 0 || n.end > input.length() || n.start > n.end ||
           ! input.substring(n.start, n.end).equals(n.raw) ) bad.add(n);
    }
    test(bad.isEmpty(), label + ": every node raw === input.slice(start, end)" +
      ( bad.isEmpty() ? "" : " (first bad: " + bad.get(0).kind + " \\"" + bad.get(0).raw + "\\" @" + bad.get(0).start + ")" ));
  }

  protected static String kinds(List<CSSNode> list) {
    List<String> k = new ArrayList<>();
    for ( CSSNode n : list ) k.add(n.kind);
    return String.join(" ", k);
  }

  protected static List<CSSNode> errorsIn(CSSNode tree) {
    List<CSSNode> out = new ArrayList<>();
    for ( CSSNode n : allNodes(tree) ) if ( "error".equals(n.kind) ) out.add(n);
    return out;
  }

  protected static List<CSSNode> ofKind(List<CSSNode> list, String kind) {
    List<CSSNode> out = new ArrayList<>();
    for ( CSSNode n : list ) if ( kind.equals(n.kind) ) out.add(n);
    return out;
  }

  protected static boolean num(CSSNode n, double expected) {
    return n.value instanceof Double && ((Double) n.value).doubleValue() == expected;
  }

  protected static String names(List<CSSNode> list) {
    List<String> k = new ArrayList<>();
    for ( CSSNode n : list ) k.add(n.name);
    return String.join(",", k);
  }

  protected static String selectorRaws(CSSNode rule, String sep) {
    List<String> k = new ArrayList<>();
    for ( CSSNode n : rule.selectors ) k.add(n.raw);
    return String.join(sep, k);
  }

  protected static String repeat(String s, int n) {
    StringBuilder sb = new StringBuilder();
    for ( int i = 0 ; i < n ; i++ ) sb.append(s);
    return sb.toString();
  }

  protected static double ms(long t0) {
    return ( System.nanoTime() - t0 ) / 1e6;
  }

  protected static boolean anyInternalFailure(CSSNode tree) {
    for ( CSSNode e : CSSParser.errors(tree) ) if ( "Internal parser failure".equals(e.message) ) return true;
    return false;
  }

  public void runAll() {
    testSpan();
    testValueComponents();
    testNumbers();
    testStrings();
    testUrl();
    testTokensAndPlaceholders();
    testValueComments();
    testValueRejects();
    testEmptyAndWhitespace();
    testComments();
    testRulesAndSelectors();
    testNestedMedia();
    testKeyframes();
    testFontFaceAndImport();
    testGenericAtRules();
    testDeclarations();
    testCustomProperty();
    testQuotedAndUrlInRules();
    testRecovery();
    testUnclosedBlock();
    testLongLine();
    testNeverThrows();
    testWalk();
    testDeclarationsHelper();
    testTokensHelper();
    testErrorsHelper();
    testTokenNames();
    testMissingSemicolon();
    testImportantPosition();
    testHazards();
    testDeepAndLargeInput();
    testAtRuleClosedByBrace();
    testDeepSkipBalances();
    testCaretHazards();
    testCaseAndWhitespace();
    testJvmLocale();
  }

  // ---- Span helper ------------------------------------------------------------

  protected void testSpan() {
    StringPStream ps = new StringPStream("ab  cd");
    ParserContext x  = new ParserContextImpl();

    Parser  span = new CSSParser.Span(new Seq(new Repeat(Literal.create(" ")), new Repeat(Range.create('a', 'z'), 1)));
    PStream r    = span.parse(ps.tail().tail(), x);
    t(() -> ((CSSParser.SpanValue) r.value()).start == 2 && ((CSSParser.SpanValue) r.value()).end == 6,
      "Span: default value records start 2 and end 6");
    t(() -> {
      Object[] chars = (Object[]) ((Object[]) ((CSSParser.SpanValue) r.value()).node)[1];
      return ( "" + chars[0] + chars[1] ).equals("cd");
    }, "Span: default value keeps the delegate value under node");

    Parser reject = new CSSParser.Span(new Repeat(Range.create('a', 'z'), 1), (v, s, e, str) -> null);
    t(() -> reject.parse(ps, x) == null, "Span: build returning undefined fails the parse");

    Parser built = new CSSParser.Span(new Repeat(Range.create('a', 'z'), 1), (v, s, e, str) -> str.substring(s, e).toUpperCase());
    t(() -> "AB".equals(built.parse(ps, x).value()), "Span: build(value, start, end, str) result becomes the value");
  }

  // ---- values -----------------------------------------------------------------

  protected void testValueComponents() {
    CSSParser p = new CSSParser();
    String  input = "1px solid #fff , a/b !IMPORTANT";
    CSSNode v     = p.parseValue(input);
    t(() -> "value".equals(v.kind), "value: parses to a value node");
    t(() -> kinds(v.components).equals("number ident hash operator ident operator ident important"),
      "value: components are number ident hash operator ident operator ident important, got " + s(() -> kinds(v.components)));
    t(() -> v.important, "value: !IMPORTANT (any case) sets important");
    spansMatch(input, v, "value");

    String  i2 = "rgb(255, 0, 0)";
    CSSNode v2 = p.parseValue(i2);
    t(() -> { CSSNode f = v2.components.get(0); return "function".equals(f.kind) && "rgb".equals(f.name) && f.closed; },
      "rgb(): a closed function node");
    t(() -> {
      List<CSSNode> n = ofKind(v2.components.get(0).args, "number");
      return n.size() == 3 && num(n.get(0), 255) && num(n.get(1), 0) && num(n.get(2), 0);
    }, "rgb(): the three channels are real numbers 255, 0, 0");
    spansMatch(i2, v2, "rgb()");

    String  i3 = "hsl(210 50% 40% / .5)";
    CSSNode v3 = p.parseValue(i3);
    t(() -> {
      List<CSSNode> n = ofKind(v3.components.get(0).args, "number");
      return n.size() == 4 && num(n.get(0), 210) && "".equals(n.get(0).unit) &&
             num(n.get(1), 50) && "%".equals(n.get(1).unit) && num(n.get(3), 0.5);
    }, "hsl(): hue 210 is a number, 50% a percentage, .5 alpha is 0.5");
    t(() -> {
      for ( CSSNode a : v3.components.get(0).args ) if ( "operator".equals(a.kind) && "/".equals(a.value) ) return true;
      return false;
    }, "hsl(): the / separator is an operator node");
    spansMatch(i3, v3, "hsl()");

    String  i4 = "linear-gradient(to right, rgba(0,0,0,.5) 0%, var(--c, $primary) 100%)";
    CSSNode v4 = p.parseValue(i4);
    t(() -> "linear-gradient".equals(v4.components.get(0).name) &&
            names(ofKind(v4.components.get(0).args, "function")).equals("rgba,var"),
      "linear-gradient(): nested rgba() and var() are function nodes");
    spansMatch(i4, v4, "linear-gradient()");

    CSSNode v5 = p.parseValue("repeat(2, [col-start] 1fr)");
    t(() -> {
      for ( CSSNode a : v5.components.get(0).args ) if ( "bracket".equals(a.kind) && a.closed ) return true;
      return false;
    }, "grid: [col-start] is a bracket node");
  }

  protected void testNumbers() {
    CSSParser p = new CSSParser();
    Object[][] cases = {
      { "16px",   16.0,   "px"  , "16"   },
      { "1.5rem", 1.5,    "rem" , "1.5"  },
      { "50%",    50.0,   "%"   , "50"   },
      { "0",      0.0,    ""    , "0"    },
      { "-2px",   -2.0,   "px"  , "-2"   },
      { "+.25em", 0.25,   "em"  , "0.25" },
      { "1e3",    1000.0, ""    , "1000" },
      { "1em",    1.0,    "em"  , "1"    },
      { "360deg", 360.0,  "deg" , "360"  }
    };
    for ( Object[] c : cases ) {
      CSSNode v = p.parseValue((String) c[0]);
      t(() -> {
        CSSNode n = v.components.get(0);
        return "number".equals(n.kind) && num(n, (Double) c[1]) && c[2].equals(n.unit) && v.components.size() == 1;
      }, "number: " + c[0] + " -> " + c[3] + " unit \\"" + c[2] + "\\"");
    }
  }

  protected void testStrings() {
    CSSParser p = new CSSParser();
    String  input = "\\"a;b}c\\" 'it\\\\'s' \\"\\\\\\"q\\\\\\"\\"";
    CSSNode v     = p.parseValue(input);
    t(() -> {
      if ( v.components.size() != 3 ) return false;
      for ( CSSNode n : v.components ) if ( ! "string".equals(n.kind) || ! n.closed ) return false;
      return true;
    }, "string: three closed strings");
    t(() -> "a;b}c".equals(v.components.get(0).value), "string: ; and } inside quotes are text");
    t(() -> "it's".equals(v.components.get(1).value) && "'".equals(v.components.get(1).quote), "string: single quotes with an escaped quote");
    t(() -> "\\"q\\"".equals(v.components.get(2).value), "string: escaped double quotes");
    spansMatch(input, v, "strings");

    CSSNode v2 = p.parseValue("\\"\\\\26 x\\"");
    t(() -> "&x".equals(v2.components.get(0).value), "string: hex escape \\\\26 plus one space is &");

    CSSNode v3 = p.parseValue("\\"open");
    t(() -> Boolean.FALSE.equals(v3.components.get(0).closed) && "open".equals(v3.components.get(0).value),
      "string: unterminated string runs to end of input with closed false");
  }

  protected void testUrl() {
    CSSParser p = new CSSParser();
    String  input = "url(data:image/svg+xml;base64,AAA=) no-repeat";
    CSSNode v     = p.parseValue(input);
    t(() -> { CSSNode u = v.components.get(0); return "url".equals(u.kind) && ! u.quoted && "data:image/svg+xml;base64,AAA=".equals(u.value); },
      "url: unquoted data URL keeps its ; inside one url node");
    t(() -> "ident".equals(v.components.get(1).kind), "url: parsing continues after the url");
    spansMatch(input, v, "url unquoted");

    String  i2 = "url( \\"a b.png\\" )";
    CSSNode v2 = p.parseValue(i2);
    t(() -> { CSSNode u = v2.components.get(0); return "url".equals(u.kind) && u.quoted && "a b.png".equals(u.value) && "string".equals(u.arg.kind); },
      "url: quoted argument is a string node under arg");
    spansMatch(i2, v2, "url quoted");
  }

  protected void testTokensAndPlaceholders() {
    CSSParser p = new CSSParser();
    String  input = "$primary$hover $space-4 $foam.u2.Tabs.tabColor %LEGACY%";
    CSSNode v     = p.parseValue(input);
    t(() -> { CSSNode c = v.components.get(0); return "token".equals(c.kind) && "primary$hover".equals(c.name) && "primary".equals(c.base) &&
      String.join(",", c.variants).equals("hover"); }, "$primary$hover: one token, base primary, variant hover");
    t(() -> "token".equals(v.components.get(1).kind) && "space-4".equals(v.components.get(1).name), "$space-4: the - is part of the name");
    t(() -> "foam.u2.Tabs".equals(v.components.get(2).cls) && "tabColor".equals(v.components.get(2).base), "$foam.u2.Tabs.tabColor: class-scoped token");
    t(() -> "placeholder".equals(v.components.get(3).kind) && "LEGACY".equals(v.components.get(3).name), "%LEGACY%: placeholder node");
    spansMatch(input, v, "tokens");
  }

  protected void testValueComments() {
    CSSParser p = new CSSParser();
    String  input = "/*%PRIMARY%*/ #406dea\\t/* two\\nlines */\\n1px /*$primary*/ red";
    CSSNode v     = p.parseValue(input);
    t(() -> "comment".equals(v.components.get(0).kind) && "PRIMARY".equals(v.components.get(0).placeholder),
      "comment: /*%PRIMARY%*/ is a comment node with placeholder PRIMARY");
    t(() -> "hash".equals(v.components.get(1).kind) && v.components.get(1).isHexColor, "comment: the #hex after the legacy comment is a hash colour");
    t(() -> "comment".equals(v.components.get(2).kind) && " two\\nlines ".equals(v.components.get(2).text), "comment: multi-line comment text");
    t(() -> "$primary".equals(v.components.get(4).token), "comment: /*$primary*/ (replaceTokens output) records the token");
    t(() -> kinds(v.components).equals("comment hash comment number comment ident"), "comment: tabs and newlines separate components");
    spansMatch(input, v, "comments");
  }

  protected void testValueRejects() {
    CSSParser p = new CSSParser();
    t(() -> p.parseValue("") == null, "parseValue: empty string is null");
    t(() -> p.parseValue("/* only */") == null, "parseValue: a value of only comments is null");
    t(() -> p.parseValue("a )") == null, "parseValue: a stray ) is null");
    t(() -> p.parseValue(null) == null, "parseValue: non-string is null");
    CSSNode v = p.parseValue("#zz");
    t(() -> "hash".equals(v.components.get(0).kind) && ! v.components.get(0).isHexColor,
      "hash: #zz is a hash that is not a colour, not an error");
    CSSNode v2 = p.parseValue("rgb(1, 2");
    t(() -> Boolean.FALSE.equals(v2.components.get(0).closed), "function: unclosed at end of input has closed false");
  }

  // ---- stylesheets --------------------------------------------------------------

  protected void testEmptyAndWhitespace() {
    CSSParser p = new CSSParser();
    CSSNode t1 = p.parse("");
    t(() -> "stylesheet".equals(t1.kind) && t1.children.isEmpty() && t1.start == 0 && t1.end == 0,
      "empty string: stylesheet with no children");
    CSSNode t2 = p.parse(" \\t\\n\\r\\n ");
    t(() -> t2.children.isEmpty() && errorsIn(t2).isEmpty(), "whitespace only: no children, no errors");
    CSSNode t3 = p.parse(null);
    t(() -> "stylesheet".equals(t3.kind) && t3.children.isEmpty(), "null input: empty stylesheet");

    String  input = "^a\\t{\\n\\tcolor:\\tred;\\n\\tmargin :\\n0\\n}\\n";
    CSSNode tr    = p.parse(input);
    t(() -> {
      CSSNode r = tr.children.get(0);
      return tr.children.size() == 1 && "rule".equals(r.kind) && r.children.size() == 2 &&
             ofKind(r.children, "declaration").size() == 2;
    }, "tabs and newlines: one rule with two declarations");
    t(() -> { CSSNode r = tr.children.get(0); return "margin".equals(r.children.get(1).property.name) && "0".equals(r.children.get(1).valueNode().raw); },
      "tabs and newlines: \\"margin :\\\\n0\\" is margin = 0");
    spansMatch(input, tr, "tabs and newlines");
  }

  protected void testComments() {
    CSSParser p = new CSSParser();
    String  input = "/* head */\\n^a /* in selector */ { /* before */ color /* gap */ : /*%PRIMARY%*/ #406dea /* after */; }\\n/* tail";
    CSSNode tr    = p.parse(input);
    t(() -> kinds(tr.children).equals("comment rule comment"), "comments: top level is comment rule comment, got " + s(() -> kinds(tr.children)));
    t(() -> "^a /* in selector */".equals(tr.children.get(1).selectors.get(0).raw), "comments: a comment inside a selector stays in its raw text");
    t(() -> "comment".equals(tr.children.get(1).children.get(0).kind) && " before ".equals(tr.children.get(1).children.get(0).text),
      "comments: comment inside a block is a child");
    t(() -> { CSSNode d = tr.children.get(1).children.get(1);
      return "declaration".equals(d.kind) && d.comments.size() == 1 && " gap ".equals(d.comments.get(0).text); },
      "comments: comment between property and : is kept on the declaration");
    t(() -> { CSSNode d = tr.children.get(1).children.get(1);
      return "PRIMARY".equals(d.valueNode().components.get(0).placeholder) && "hash".equals(d.valueNode().components.get(1).kind); },
      "comments: legacy /*%PRIMARY%*/ #hex is a placeholder comment then a hash");
    t(() -> Boolean.FALSE.equals(tr.children.get(2).closed) && " tail".equals(tr.children.get(2).text),
      "comments: unterminated comment at end has closed false");
    spansMatch(input, tr, "comments");
  }

  protected void testRulesAndSelectors() {
    CSSParser p = new CSSParser();
    String  input = "^ { a: b } ^title, .x ^y:not(.a, .b), [class^=z] $sel { c: d }";
    CSSNode tr    = p.parse(input);
    t(() -> { CSSNode r0 = tr.children.get(0);
      return tr.children.size() == 2 && r0.selectors.size() == 1 && "^".equals(r0.selectors.get(0).raw) && r0.selectors.get(0).carets.size() == 1; },
      "^ alone: one selector \\"^\\" with one caret");
    t(() -> selectorRaws(tr.children.get(1), "|").equals("^title|.x ^y:not(.a, .b)|[class^=z] $sel"),
      "selector list splits on top-level commas only, got " + s(() -> selectorRaws(tr.children.get(1), "|")));
    t(() -> { CSSNode c = tr.children.get(1).selectors.get(0).carets.get(0); return c.start == input.indexOf("^title") && ! c.inAttr; },
      "^title: caret node at its offset");
    t(() -> { CSSNode sel = tr.children.get(1).selectors.get(2); return sel.carets.size() == 1 && sel.carets.get(0).inAttr; },
      "[class^=z]: the ^ of ^= is a caret with inAttr (FOAM still rewrites it)");
    t(() -> { CSSNode sel = tr.children.get(1).selectors.get(2); return sel.tokens.size() == 1 && "sel".equals(sel.tokens.get(0).name); },
      "$sel inside a selector is noted as a token");
    spansMatch(input, tr, "selectors");

    String  i2 = "^ { color: red; &:hover { color: blue } span:hover{ x: y } }";
    CSSNode t2 = p.parse(i2);
    t(() -> kinds(t2.children.get(0).children).equals("declaration rule rule"),
      "nesting: declaration then two nested rules, got " + s(() -> kinds(t2.children.get(0).children)));
    t(() -> "span:hover".equals(t2.children.get(0).children.get(2).selectors.get(0).raw), "nesting: \\"span:hover{\\" is a rule, not a declaration");
    spansMatch(i2, t2, "nesting");
  }

  protected void testNestedMedia() {
    CSSParser p = new CSSParser();
    String  input = "@media (max-width: 600px) and (orientation: landscape) {\\n  ^ { padding: 0 }\\n  @supports (display: grid) { ^grid { display: grid } }\\n}";
    CSSNode tr    = p.parse(input);
    t(() -> { CSSNode m = tr.children.get(0); return "atrule".equals(m.kind) && "media".equals(m.name) && m.closed; }, "@media: a closed at-rule");
    t(() -> "(max-width: 600px) and (orientation: landscape)".equals(tr.children.get(0).prelude.raw), "@media: prelude raw text is trimmed");
    t(() -> { CSSNode c = tr.children.get(0).prelude.components.get(0);
      if ( ! "paren".equals(c.kind) ) return false;
      for ( CSSNode k : c.components ) if ( "number".equals(k.kind) && num(k, 600) ) return true;
      return false; }, "@media: (max-width: 600px) is a paren holding the number 600");
    t(() -> kinds(tr.children.get(0).children).equals("rule atrule"), "@media: holds a rule and a nested @supports");
    t(() -> { CSSNode sup = tr.children.get(0).children.get(1); return "supports".equals(sup.name) && "^grid".equals(sup.children.get(0).selectors.get(0).raw); },
      "@supports: its rule parses");
    spansMatch(input, tr, "@media");

    CSSNode t2 = p.parse("@container card (min-width: 400px) { ^ { gap: 1rem } }");
    t(() -> "container".equals(t2.children.get(0).name) && "rule".equals(t2.children.get(0).children.get(0).kind), "@container: prelude then rules");
  }

  protected void testKeyframes() {
    CSSParser p = new CSSParser();
    String  input = "@keyframes spin { from { transform: rotate(0deg) } 50% { opacity: .5 } to { transform: rotate(360deg); } }";
    CSSNode tr    = p.parse(input);
    t(() -> { CSSNode k = tr.children.get(0); return "keyframes".equals(k.name) && "spin".equals(k.prelude.components.get(0).value); },
      "@keyframes: name spin in the prelude");
    t(() -> {
      List<String> sels = new ArrayList<>();
      for ( CSSNode r : tr.children.get(0).children ) sels.add(r.selectors.get(0).raw);
      return String.join(",", sels).equals("from,50%,to");
    }, "@keyframes: from, 50%, to are rule selectors");
    t(() -> { CSSNode deg = tr.children.get(0).children.get(2).children.get(0).valueNode().components.get(0).args.get(0);
      return num(deg, 360) && "deg".equals(deg.unit); }, "@keyframes: rotate(360deg) is the number 360 unit deg");
    spansMatch(input, tr, "@keyframes");
  }

  protected void testFontFaceAndImport() {
    CSSParser p = new CSSParser();
    String  input = "@charset \\"UTF-8\\";\\n@import url(theme.css) screen;\\n@font-face { font-family: \\"Inter\\"; src: url(inter.woff2) format(\\"woff2\\") }\\n@page :first { margin: 1in }";
    CSSNode tr    = p.parse(input);
    List<CSSNode> c = tr.children;
    t(() -> kinds(c).equals("atrule atrule atrule atrule"), "at-rules: four at-rules");
    t(() -> "charset".equals(c.get(0).name) && c.get(0).children == null && "UTF-8".equals(c.get(0).prelude.components.get(0).value),
      "@charset: statement with a string prelude");
    t(() -> "import".equals(c.get(1).name) && c.get(1).children == null && c.get(1).raw.endsWith(";") &&
            "url".equals(c.get(1).prelude.components.get(0).kind) && "theme.css".equals(c.get(1).prelude.components.get(0).value),
      "@import url(theme.css): statement ending at ;, url node in prelude");
    t(() -> {
      List<String> props = new ArrayList<>();
      for ( CSSNode d : c.get(2).children ) props.add(d.property.name);
      return "font-face".equals(c.get(2).name) && String.join(",", props).equals("font-family,src");
    }, "@font-face: a declaration block");
    t(() -> "page".equals(c.get(3).name) && ":first".equals(c.get(3).prelude.raw) && "margin".equals(c.get(3).children.get(0).property.name),
      "@page :first: prelude and declarations");
    spansMatch(input, tr, "at-rules");
  }

  protected void testGenericAtRules() {
    CSSParser p = new CSSParser();
    String  input = "@foo bar baz;\\n@layer base { ^ { a: b } }\\n@unknown { weird: 1 }";
    CSSNode tr    = p.parse(input);
    List<CSSNode> c = tr.children;
    t(() -> c.size() == 3 && "foo".equals(c.get(0).name) && c.get(0).children == null, "unknown @foo: statement at-rule");
    t(() -> "layer".equals(c.get(1).name) && "rule".equals(c.get(1).children.get(0).kind), "unknown @layer: block of rules");
    t(() -> "unknown".equals(c.get(2).name) && "".equals(c.get(2).prelude.raw) && "declaration".equals(c.get(2).children.get(0).kind),
      "unknown @unknown: empty prelude, block of declarations");
    t(() -> errorsIn(tr).isEmpty(), "unknown at-rules: no errors");
    spansMatch(input, tr, "generic at-rules");
  }

  protected void testDeclarations() {
    CSSParser p = new CSSParser();
    String  input = "^ { color: red !important; margin: 0 auto }";
    CSSNode tr    = p.parse(input);
    List<CSSNode> d = tr.children.get(0).children;
    t(() -> { List<CSSNode> comps = d.get(0).valueNode().components;
      return d.size() == 2 && d.get(0).important && "important".equals(comps.get(comps.size() - 1).kind); },
      "!important: flag set and last component is important");
    t(() -> "color: red !important;".equals(d.get(0).raw), "declaration span includes its ;");
    t(() -> "margin".equals(d.get(1).property.name) && "margin: 0 auto".equals(d.get(1).raw) && ! d.get(1).important,
      "last declaration without ; ends before }");
    spansMatch(input, tr, "declarations");

    CSSNode t2 = p.parse("color: red; background: $primary");
    t(() -> kinds(t2.children).equals("declaration declaration"), "inline style: declarations at top level");
  }

  protected void testCustomProperty() {
    CSSParser p = new CSSParser();
    String  input = "^ { --gap: calc( 2 * $space-4 ) ; --blob: { a: b; c: \\"}\\" }; --empty:; color: var(--gap) }";
    CSSNode tr    = p.parse(input);
    List<CSSNode> d = tr.children.get(0).children;
    t(() -> d.size() == 4 && d.get(0).custom && "calc( 2 * $space-4 )".equals(d.get(0).valueNode().raw) && d.get(0).valueNode().components == null,
      "custom property: raw value kept, trimmed, no components");
    t(() -> d.get(0).valueNode().tokens.size() == 1 && "space-4".equals(d.get(0).valueNode().tokens.get(0).name),
      "custom property: $space-4 noted in its raw value");
    t(() -> d.get(1).custom && "{ a: b; c: \\"}\\" }".equals(d.get(1).valueNode().raw), "custom property: a braced value with ; and a quoted } stays whole");
    t(() -> d.get(2).custom && "".equals(d.get(2).valueNode().raw), "custom property: empty value allowed");
    t(() -> ! d.get(3).custom && "var".equals(d.get(3).valueNode().components.get(0).name), "var(--gap) in a normal declaration is a function");
    t(() -> errorsIn(tr).isEmpty(), "custom properties: no errors");
    spansMatch(input, tr, "custom property");
  }

  protected void testQuotedAndUrlInRules() {
    CSSParser p = new CSSParser();
    String  input = "^ { content: \\"a;b}c \\\\\\"q\\\\\\"\\"; background: url(data:image/svg+xml;base64,AAA=) no-repeat; } ^next { x: y }";
    CSSNode tr    = p.parse(input);
    t(() -> tr.children.size() == 2 && tr.children.get(0).children.size() == 2, "quoted ; } and unquoted url ; do not end the declaration or rule");
    t(() -> "a;b}c \\"q\\"".equals(tr.children.get(0).children.get(0).valueNode().components.get(0).value), "string value with ; } and escaped quotes");
    t(() -> "url".equals(tr.children.get(0).children.get(1).valueNode().components.get(0).kind), "url(data:...;...) is one url component");
    t(() -> errorsIn(tr).isEmpty(), "quoted and url: no errors");
    spansMatch(input, tr, "quoted and url");
  }

  protected void testRecovery() {
    CSSParser p = new CSSParser();
    String  input = "^a { color: #zz;; background red } ^b { color: blue; }";
    CSSNode tr    = p.parse(input);
    List<CSSNode> errs = errorsIn(tr);
    t(() -> errs.size() == 1, "recovery: exactly one error node, got " + errs.size());
    t(() -> "background red".equals(errs.get(0).raw), "recovery: the error spans \\"background red\\"");
    t(() -> { CSSNode a = tr.children.get(0);
      return "declaration".equals(a.children.get(0).kind) && ! a.children.get(0).valueNode().components.get(0).isHexColor; },
      "recovery: \\"color: #zz\\" is kept as a declaration (a hash, not a colour)");
    t(() -> { CSSNode b = tr.children.get(1);
      return "rule".equals(b.kind) && "^b".equals(b.selectors.get(0).raw) && "blue".equals(b.children.get(0).valueNode().raw); },
      "recovery: the following rule still parses");
    spansMatch(input, tr, "recovery");

    CSSNode t2 = p.parse("^ { a: (b; c: d } ^n { e: f }");
    t(() -> t2.children.size() == 2 && "e".equals(t2.children.get(1).children.get(0).property.name),
      "recovery: an unbalanced ( does not swallow the closing } of its block");

    CSSNode t3 = p.parse("} ^ { a: b }");
    t(() -> "error".equals(t3.children.get(0).kind) && "Unexpected }".equals(t3.children.get(0).message) && "rule".equals(t3.children.get(1).kind),
      "recovery: stray } at top level is one error, parsing continues");

    String  i4 = "^ { color: ; margin: 0; @@@ ; padding: 1px }";
    CSSNode t4 = p.parse(i4);
    t(() -> {
      List<String> props = new ArrayList<>();
      for ( CSSNode c : ofKind(t4.children.get(0).children, "declaration") ) props.add(c.property.name);
      return errorsIn(t4).size() == 2 && String.join(",", props).equals("margin,padding");
    }, "recovery: empty value and junk are errors, the good declarations survive");
    spansMatch(i4, t4, "recovery 2");
  }

  protected void testUnclosedBlock() {
    CSSParser p = new CSSParser();
    String  input = "^a { color: red; ^b { margin: 0";
    CSSNode tr    = p.parse(input);
    List<CSSNode> errs = errorsIn(tr);
    t(() -> { CSSNode a = tr.children.get(0);
      return Boolean.FALSE.equals(a.closed) && "error".equals(a.children.get(0).kind) && "{".equals(a.children.get(0).raw); },
      "unclosed block: closed false and an error spanning its {");
    t(() -> {
      if ( errs.size() != 2 ) return false;
      for ( CSSNode e : errs ) if ( ! "Unclosed block: missing }".equals(e.message) ) return false;
      return true;
    }, "unclosed block: both open blocks report an error");
    t(() -> { CSSNode a = tr.children.get(0);
      return "rule".equals(a.children.get(2).kind) && "margin".equals(a.children.get(2).children.get(1).property.name); },
      "unclosed block: content up to end of input is still parsed");
    t(() -> tr.end == input.length(), "unclosed block: the tree covers the whole input");
    spansMatch(input, tr, "unclosed");
  }

  // The same glyph the JS test reads through foam.u2.theme.ThemeGlyphs,
  // taken from the source file under project.home; the shortened copy is
  // the JS test's fallback, used when the file cannot be read.
  protected static String minimizeGlyph() {
    char   bt = (char) 96;
    String home = System.getProperty("project.home");
    try {
      String src = new String(Files.readAllBytes(Paths.get(home, "src", "foam", "u2", "theme", "ThemeGlyphs.js")), StandardCharsets.UTF_8);
      int at    = src.indexOf("name: 'minimize'");
      int open  = src.indexOf("template: " + bt, at);
      int close = src.indexOf(bt, open + 11);
      if ( at >= 0 && open >= 0 && close > open ) return src.substring(open + 11, close).trim();
    } catch (Throwable e) {
      // fall through to the shortened copy
    }
    return "<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"20\\" height=\\"10\\" viewBox=\\"0 0 20 10\\" fill=\\"none\\"><path d=\\"" +
      repeat("M15.2002 0C15.4834 3.94863e-05 15.7171 0.0920968 15.9004 0.275391L14.5 0.275391C14.6833 0.0920573 14.9169 0 15.2002 0Z", 12) +
      "\\" fill=\\"currentColor\\"/></svg>";
  }

  protected void testLongLine() {
    CSSParser p   = new CSSParser();
    String    svg = minimizeGlyph();
    List<String> decls = new ArrayList<>();
    for ( int i = 0 ; i < 20 ; i++ ) decls.add("--c" + i + ": $primary" + i + "; margin-" + i + ": calc(" + i + "px + $space-" + i + ")");
    String input = "^icon { background-image: url('data:image/svg+xml;utf8," + svg + "'); " + String.join("; ", decls) +
      "; mask: url(data:image/svg+xml;base64," + repeat("QUFB", 100) + ") no-repeat center / 1rem 1rem !important }";
    test(input.length() > 1500, "long line: input is " + input.length() + " characters on one line");

    long    t0 = System.nanoTime();
    CSSNode tr = p.parse(input);
    double  ms = ms(t0);
    test(ms < 500, "long line: parsed in " + String.format("%.1f", ms) + " ms (< 500 ms)");
    t(() -> { CSSNode r = tr.children.get(0); return tr.children.size() == 1 && "rule".equals(r.kind) && r.closed && r.children.size() == 42; },
      "long line: one closed rule with 42 declarations, got " + s(() -> "" + tr.children.get(0).children.size()));
    t(() -> errorsIn(tr).isEmpty(), "long line: no errors");
    t(() -> { CSSNode u = tr.children.get(0).children.get(0).valueNode().components.get(0);
      return "url".equals(u.kind) && ((String) u.value).startsWith("data:image/svg+xml;utf8,<svg"); },
      "long line: the SVG data URL is one url node");
    spansMatch(input, tr, "long line");
  }

  protected void testNeverThrows() {
    CSSParser p = new CSSParser();
    List<String> cases = new ArrayList<>(Arrays.asList(
      repeat("(", 300), repeat("{", 300), repeat("}", 50), repeat("\\"", 51), repeat("/*", 40), repeat("[(", 150),
      "^ { a: " + repeat("f(", 200) + " }", repeat("@", 30), ";;;", "\\\\\\\\", "a{b:c(d:e{f;g}h)i}j", "url(" + repeat("x", 500)));
    // The same generator as the JS test, with JS number semantics (a double
    // product, then ToInt32), so both tests see the same 200 strings.
    int    seed     = 42;
    String alphabet = "ab-_$^%#@!;:{}()[]\\"'/*,.0123456789 \\t\\n\\\\u(";
    for ( int i = 0 ; i < 200 ; i++ ) {
      seed = ( (int) (long) ( seed * 1103515245.0 + 12345 ) ) & 0x7fffffff;
      int len = 1 + seed % 60;
      StringBuilder sb = new StringBuilder();
      for ( int j = 0 ; j < len ; j++ ) {
        seed = ( (int) (long) ( seed * 1103515245.0 + 12345 ) ) & 0x7fffffff;
        sb.append(alphabet.charAt(seed % alphabet.length()));
      }
      cases.add(sb.toString());
    }
    int threw = 0, uncovered = 0, badSpan = 0, slow = 0;
    for ( String c : cases ) {
      try {
        long    t0 = System.nanoTime();
        CSSNode tr = p.parse(c);
        if ( ms(t0) > 200 ) slow++;
        if ( ! "stylesheet".equals(tr.kind) || tr.start != 0 || tr.end != c.length() ) uncovered++;
        for ( CSSNode n : allNodes(tr) ) {
          if ( n.start < 0 || n.end > c.length() || n.start > n.end || ! c.substring(n.start, n.end).equals(n.raw) ) { badSpan++; break; }
        }
      } catch (Throwable e) {
        threw++;
      }
    }
    test(threw == 0, "never throws: " + cases.size() + " pathological and random inputs, " + threw + " threw");
    test(uncovered == 0, "never throws: every tree spans its whole input (" + uncovered + " did not)");
    test(badSpan == 0, "never throws: every node span matches its raw text (" + badSpan + " did not)");
    test(slow == 0, "never throws: no input took over 200 ms (" + slow + " did)");
  }

  // ---- API helpers ------------------------------------------------------------------

  protected void testWalk() {
    CSSParser p = new CSSParser();
    String  input = "/*c*/ @media x { ^a, ^b { color: rgb(1, $t, 3) } }";
    CSSNode tr    = p.parse(input);
    List<CSSNode> seen = new ArrayList<>();
    CSSParser.walk(tr, (n, a) -> { seen.add(n); return true; });
    List<CSSNode> mine = allNodes(tr);
    Set<CSSNode>  seenSet = Collections.newSetFromMap(new IdentityHashMap<>());
    seenSet.addAll(seen);
    test(seen.size() == mine.size() && seenSet.containsAll(mine), "walk: visits every node (" + seen.size() + " of " + mine.size() + ")");
    boolean ordered = true;
    int     last    = -1;
    for ( CSSNode n : seen ) {
      if ( "stylesheet".equals(n.kind) ) continue;
      if ( n.start < last ) ordered = false;
      last = n.start;
    }
    test(ordered, "walk: nodes arrive in input order");

    String[] depthOfT = { "-1" };
    CSSParser.walk(tr, (n, ancestors) -> {
      if ( "token".equals(n.kind) ) depthOfT[0] = kinds(ancestors).replace(' ', '>');
      return true;
    });
    test(depthOfT[0].equals("stylesheet>atrule>rule>declaration>value>function"),
      "walk: ancestors of $t are stylesheet>atrule>rule>declaration>value>function, got " + depthOfT[0]);

    int[] count = { 0 };
    CSSParser.walk(tr, (n, a) -> { count[0]++; return ! "atrule".equals(n.kind); });
    test(count[0] == 3, "walk: returning false skips children (stylesheet, comment, atrule = 3), got " + count[0]);
  }

  protected void testDeclarationsHelper() {
    CSSParser p = new CSSParser();
    String input = "top: 0; ^title, ^x { color: red } @media (max-width: 600px) { ^ { margin: 0 !important; --gap: 4px } }";
    List<CSSParser.Declaration> d = CSSParser.declarations(p.parse(input));
    t(() -> {
      List<String> props = new ArrayList<>();
      for ( CSSParser.Declaration e : d ) props.add(e.property);
      return String.join(",", props).equals("top,color,margin,--gap");
    }, "declarations: all four in input order");
    t(() -> d.get(0).path.isEmpty(), "declarations: a top-level declaration has an empty path");
    t(() -> String.join("|", d.get(1).path).equals("^title, ^x") && "red".equals(d.get(1).value), "declarations: rule path is its selector list");
    t(() -> String.join("|", d.get(2).path).equals("@media (max-width: 600px)|^") && d.get(2).important,
      "declarations: nested path is at-rule then rule, important carried");
    t(() -> d.get(3).custom && "4px".equals(d.get(3).value) && d.get(3).ancestors.size() == 2 && "declaration".equals(d.get(3).node.kind),
      "declarations: custom property entry, ancestors and node");
  }

  protected void testTokensHelper() {
    CSSParser p = new CSSParser();
    String input = "^$sel { width: calc(100% - 2 * $space-4); color: $primary$hover; margin: min(calc($a + 1px), $b); --g: calc(1px + $c) $d; content: \\"$notToken\\" }";
    List<CSSNode> tk = CSSParser.tokens(p.parse(input));
    List<String>  sm = new ArrayList<>();
    for ( CSSNode n : tk ) sm.add(n.name + ( n.inMath ? "*" : "" ));
    String summary = String.join(" ", sm);
    test(summary.equals("sel space-4* primary$hover a* b* c* d"),
      "tokens: names in order, * = inside calc/min/max/clamp: got \\"" + summary + "\\"");
    t(() -> {
      for ( CSSNode n : tk ) if ( ! input.substring(n.start, n.end).equals("$" + n.name) ) return false;
      return true;
    }, "tokens: every span slices to $name");
    t(() -> "primary".equals(tk.get(2).base) && "hover".equals(tk.get(2).variants.get(0)), "tokens: $primary$hover base and variant");

    CSSNode v = p.parseValue("calc(100% - 2 * $space-4)");
    t(() -> CSSParser.tokens(v).get(0).inMath, "tokens: parseValue marks calc() tokens too");
    CSSNode v2 = p.parseValue("clamp(1px, $a, max(2px, $b)) $c");
    t(() -> {
      List<String> m = new ArrayList<>();
      for ( CSSNode n : CSSParser.tokens(v2) ) m.add("" + n.inMath);
      return String.join(",", m).equals("true,true,false");
    }, "tokens: clamp() and max() count as math, a bare token does not");
  }

  protected void testErrorsHelper() {
    CSSParser p = new CSSParser();
    List<CSSNode> e = CSSParser.errors(p.parse("^a { color: #zz;; background red } ^b { content: \\"open"));
    t(() -> kinds(e).replace(' ', ',').equals("error,error,string"),
      "errors: malformed declaration, unclosed block and unterminated string, got " + kinds(e).replace(' ', ','));
    t(() -> CSSParser.errors(p.parse("^ { a: b }")).isEmpty(), "errors: clean input has none");
  }

  // Java only: the JS side's autocomplete checks have no Java counterpart;
  // this covers the pluggable token-name source both sides offer.
  protected void testTokenNames() {
    CSSParser p = new CSSParser();
    t(() -> p.getTokenNames().contains("inputHeight") && p.getTokenNames().size() > 50,
      "tokenNames: defaults to the foam.u2.CSSTokens constants (" + s(() -> "" + p.getTokenNames().size()) + ")");
    p.setTokenNames(() -> Arrays.asList("brandInk", "brandInkMuted"));
    t(() -> p.getTokenNames().equals(Arrays.asList("brandInk", "brandInkMuted")), "tokenNames: a plugged supplier replaces the list");
    p.setTokenNames(null);
    t(() -> p.getTokenNames().contains("inputHeight"), "tokenNames: null restores the default");
  }

  // ---- review round 1 ---------------------------------------------------------------

  protected void testMissingSemicolon() {
    CSSParser p = new CSSParser();
    String  input = "^ {\\n  color: red\\n  margin: 0;\\n}";
    CSSNode tr    = p.parse(input);
    List<CSSNode> e = CSSParser.errors(tr);
    t(() -> { List<CSSNode> d = tr.children.get(0).children;
      return d.size() == 1 && "declaration".equals(d.get(0).kind) && e.size() == 1 && ":".equals(e.get(0).raw) &&
             e.get(0).message.contains("';' missing"); },
      "missing ;: the merged declaration reports one error on the stray :, got " + s(() -> {
        List<String> r = new ArrayList<>();
        for ( CSSNode n : e ) r.add("\\"" + n.raw + "\\"");
        return String.join(",", r);
      }));
    spansMatch(input, tr, "missing ;");

    CSSNode t2 = p.parse("@media (min-width: 600px) and (a: b) { ^ { background: f(x: y) [a:b]; } }");
    t(() -> CSSParser.errors(t2).isEmpty(), "missing ;: a : inside @media ( ), a function or [ ] is not an error");
  }

  protected void testImportantPosition() {
    CSSParser p = new CSSParser();
    CSSNode v = p.parseValue("red !important blue");
    t(() -> { List<CSSNode> e = CSSParser.errors(v); return ! v.important && e.size() == 1 && "!important".equals(e.get(0).raw); },
      "!important followed by more value: an error node and important false");
    CSSNode v2 = p.parseValue("c !important!important");
    t(() -> { List<CSSNode> e = CSSParser.errors(v2); return v2.important && e.size() == 1 && e.get(0).start == 2; },
      "doubled !important: the first is an error, the last still counts");
    CSSNode v3 = p.parseValue("c !important /* note */");
    t(() -> v3.important && CSSParser.errors(v3).isEmpty(), "!important followed only by a comment is still last");
  }

  protected void testHazards() {
    CSSParser p = new CSSParser();
    String  input = "a{b:$x;} ^$y{c:\\"$z\\"} /*$w*/ d{e:url($u)} [class^=q]{f:g} h{--v: \\"$s\\"}";
    CSSNode tr    = p.parse(input);
    t(() -> names(CSSParser.tokens(tr)).equals("x,y"), "hazards: tokens() keeps only the meaningful x and y");
    List<String> hs = new ArrayList<>();
    for ( CSSNode n : CSSParser.hazards(tr) ) hs.add("token".equals(n.kind) ? n.name + ":" + n.context : "caret:" + n.inAttr);
    String h = String.join(" ", hs);
    test(h.equals("z:string w:comment u:url caret:true s:string"), "hazards: string, comment, url tokens and the ^= caret, got \\"" + h + "\\"");
    t(() -> {
      for ( CSSNode n : CSSParser.hazards(tr) ) if ( ! input.substring(n.start, n.end).equals(n.raw) ) return false;
      return true;
    }, "hazards: every hazard span slices back");
    t(() -> CSSParser.errors(tr).isEmpty(), "hazards: none of them is a parse error");
    t(() -> { CSSNode c = tr.children.get(2); return "comment".equals(c.kind) && "$w".equals(c.token) && "comment".equals(c.tokens.get(0).context); },
      "hazards: /*$w*/ keeps its token field and lists the token");
    spansMatch(input, tr, "hazards");
  }

  protected void testDeepAndLargeInput() {
    CSSParser p = new CSSParser();

    // Unclosed url( in minified CSS used to rescan to end of input for each
    // one: quadratic, 2.5 s at 40 KB.
    String  i1 = repeat("a{b:url(x}", 4000);
    long    t0 = System.nanoTime();
    CSSNode r1 = p.parse(i1);
    double  m1 = ms(t0);
    test(m1 < 500 && r1.end == i1.length() && r1.children.size() == 4000,
      "unclosed url(: 40 KB of a{b:url(x} parses to 4000 rules in " + Math.round(m1) + " ms (< 500 ms)");

    String  i2 = repeat("url(", 2000);
    t0 = System.nanoTime();
    CSSNode r2 = p.parse(i2);
    double  m2 = ms(t0);
    test(m2 < 500 && r2.end == i2.length() && ! anyInternalFailure(r2),
      "url( x 2000: parsed without losing the tree, " + Math.round(m2) + " ms");
    spansMatch(i2, r2, "url( x 2000");

    String  i3 = repeat("a{", 2000);
    t0 = System.nanoTime();
    CSSNode r3 = p.parse(i3);
    double  m3 = ms(t0);
    int     deep = 0;
    for ( CSSNode e : CSSParser.errors(r3) ) if ( e.message != null && e.message.startsWith("Nested deeper") ) deep++;
    test(m3 < 500 && deep == 1 && ! anyInternalFailure(r3),
      "2000 nested blocks: one \\"nested deeper\\" error, no internal failure, " + Math.round(m3) + " ms");

    String  i4 = repeat("a{", 200) + "b:c" + repeat("}", 200);
    CSSNode r4 = p.parse(i4);
    List<CSSNode> e4 = CSSParser.errors(r4);
    t(() -> r4.end == i4.length() && kinds(e4).equals("error") && e4.get(0).message.startsWith("Nested deeper"),
      "200 balanced nested blocks: the skip balances the closers, one depth error, got " + kinds(e4));
    spansMatch(i4, r4, "200 nested blocks");

    CSSNode r5 = p.parse("a{b:" + repeat("(", 200) + "}");
    List<CSSNode> e5 = CSSParser.errors(r5);
    t(() -> kinds(e5).equals("paren error"),
      "200 unclosed parens: errors() lists the outermost open paren and the depth error inside it, got " + kinds(e5));

    String  i6 = "a{b:" + repeat("(", 5000) + repeat(")", 5000) + "}";
    t0 = System.nanoTime();
    CSSNode r6 = p.parse(i6);
    double  m6 = ms(t0);
    test(m6 < 500 && r6.end == i6.length() && ! anyInternalFailure(r6), "5000 nested parens: no stack overflow, " + Math.round(m6) + " ms");

    String  i7 = repeat("[(", 5000);
    t0 = System.nanoTime();
    CSSNode r7 = p.parse(i7);
    double  m7 = ms(t0);
    test(m7 < 500 && r7.end == i7.length(), "[( x 5000: parsed in " + Math.round(m7) + " ms");
  }

  // ---- review round 2 ---------------------------------------------------------------

  protected void testAtRuleClosedByBrace() {
    CSSParser p = new CSSParser();
    String  input = "^ { @apply x }";
    CSSNode tr    = p.parse(input);
    t(() -> { CSSNode a = tr.children.get(0).children.get(0);
      return "atrule".equals(a.kind) && "apply".equals(a.name) && a.children == null && "x".equals(a.prelude.raw) &&
             CSSParser.errors(tr).isEmpty(); },
      "at-rule closed by }: \\"@apply x\\" before } is a statement at-rule, no errors");
    spansMatch(input, tr, "at-rule closed by }");

    String  i2 = "a{@x}b{c:d}";
    CSSNode t2 = p.parse(i2);
    t(() -> kinds(t2.children).equals("rule rule") && "c".equals(t2.children.get(1).children.get(0).property.name) &&
            CSSParser.errors(t2).isEmpty(),
      "at-rule closed by }: the next rule still parses");
    spansMatch(i2, t2, "at-rule closed by } 2");
  }

  // ---- review round 3 ---------------------------------------------------------------

  protected void testDeepSkipBalances() {
    CSSParser p = new CSSParser();
    String  input = repeat("a{", 70) + repeat("}", 70) + " z{q:r}";
    CSSNode tr    = p.parse(input);
    List<CSSNode> e = CSSParser.errors(tr);
    t(() -> kinds(e).equals("error") && e.get(0).message.startsWith("Nested deeper"),
      "depth skip: 70 nested blocks give one depth error and no stray }, got " + kinds(e));
    t(() -> { CSSNode last = tr.children.get(tr.children.size() - 1);
      return kinds(tr.children).equals("rule rule") && "z".equals(last.selectors.get(0).raw) && "q".equals(last.children.get(0).property.name); },
      "depth skip: the rule after the nested blocks parses at top level");
    spansMatch(input, tr, "depth skip blocks");

    String  i2 = "a{b:" + repeat("f(", 100) + repeat(")", 100) + "}";
    CSSNode t2 = p.parse(i2);
    List<CSSNode> e2 = CSSParser.errors(t2);
    t(() -> kinds(e2).equals("error") && e2.get(0).message.startsWith("Nested deeper"),
      "depth skip: 100 balanced f( report the depth error, not an unclosed function, got " + kinds(e2));
    spansMatch(i2, t2, "depth skip functions");
  }

  protected void testCaretHazards() {
    CSSParser p = new CSSParser();
    String  input = "a{content:\\"^x\\"} /* ^y */ /*^\\n*/ b{c:\\"^\\"}";
    CSSNode tr    = p.parse(input);
    List<String> hs = new ArrayList<>();
    for ( CSSNode n : CSSParser.hazards(tr) ) hs.add(n.kind + ":" + n.context);
    String h = String.join(" ", hs);
    test(h.equals("caret:string caret:comment caret:string"),
      "caret hazards: a ^ in a string or comment is a hazard, one before a line break is not, got \\"" + h + "\\"");
    t(() -> tr.children.get(0).children.get(0).valueNode().components.get(0).carets.size() == 1 &&
            tr.children.get(1).carets.get(0).start == input.indexOf("^y"),
      "caret hazards: the string and comment list their carets");
    t(() -> CSSParser.errors(tr).isEmpty(), "caret hazards: none of them is a parse error");
    spansMatch(input, tr, "caret hazards");
  }

  protected void testCaseAndWhitespace() {
    CSSParser p = new CSSParser();
    CSSNode v = p.parseValue("c !\\u0131mportant");
    t(() -> ! v.important && kinds(v.components).equals("ident delim ident"),
      "case: ! + dotless i (U+0131) + mportant is not !important");
    CSSNode a = p.parse("@MEDIA x;");
    t(() -> "media".equals(a.children.get(0).name), "case: @MEDIA has the name media");

    CSSNode c1 = p.parse("/*\\u00a0%NAME%\\u00a0*/");
    t(() -> "NAME".equals(c1.children.get(0).placeholder), "whitespace: no-break spaces around %NAME% still make a placeholder");
    String[] spaced = { "/*\\u3000$x\\u3000*/", "/*\\ufeff$x*/", "/*\\u2028$x*/" };
    t(() -> {
      for ( String s : spaced ) if ( ! "$x".equals(p.parse(s).children.get(0).token) ) return false;
      return true;
    }, "whitespace: Unicode spaces around $x still make a token comment");
    CSSNode c2 = p.parse("/*$x\\u0001*/");
    t(() -> c2.children.get(0).token == null, "whitespace: a control character after $x is not whitespace");
    CSSNode c3 = p.parse("a{b:/*$x\\u0001*/ c}");
    t(() -> c3.children.get(0).children.get(0).valueNode().components.get(0).token == null,
      "whitespace: the same inside a value");
  }

  // Java only: the JS side has no JVM locale. Under a Turkish default locale
  // String.toUpperCase/toLowerCase map i and I differently; the grammar must
  // not depend on it.
  protected void testJvmLocale() {
    Locale saved = Locale.getDefault();
    try {
      // The default locale is JVM-wide; the finally below restores it.
      Locale.setDefault(Locale.forLanguageTag("tr-TR"));
      CSSParser p = new CSSParser();
      CSSNode v = p.parseValue("c !important");
      t(() -> v.important, "locale: !important matches under a Turkish JVM locale");
      CSSNode v2 = p.parseValue("c !IMPORTANT");
      t(() -> v2.important, "locale: !IMPORTANT matches under a Turkish JVM locale");
      CSSNode a = p.parse("@MEDIA x;");
      t(() -> "media".equals(a.children.get(0).name), "locale: @MEDIA is media under a Turkish JVM locale");
    } finally {
      Locale.setDefault(saved);
    }
  }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        runAll();
      `
    }
  ]
});
