/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.theme.test',
  name: 'CSSAuditTest',
  extends: 'foam.core.test.Test',

  documentation: `
  Test for hard coded CSS color and font values, unknown $tokens and CSS
  syntax errors in css: blocks.
  Depends on System property project.home set by the build.

  run with --log-level:INFO to report what is being ignored/skipped.

  The audit reads CSS, not lines. Every .js file under project.home is scanned
  for the string literals that hold CSS - a class' css: template and the code:
  of a foam.u2.CSS axiom - and only those are parsed, into selectors, blocks
  and declarations. A declaration is a property and a value inside a block, so
  a JS object entry whose key happens to be a CSS property name, a comment, and
  a string in ordinary code are all outside what the audit reads and need no
  exemption. What remains to allow are CSS-level values that carry no hard
  coded colour: a $token, a legacy %THEME% placeholder, var(), url() and
  !important.

  A $token in a declaration is checked as well: a name that is declared
  neither in src/foam/u2/CSSTokens.js nor in the owning class' cssTokens: -
  including the cssTokens: it inherits through extends: and the ones a
  mixins: entry installs on it - never resolves, so the declaration ships
  whatever fallback the token machinery has, and a typo is invisible until
  someone looks at the rendered page. A derived $name$hover form is checked
  against what ColorToken actually installs; see tokenDeclared below.

  An application can also declare a token outside JS entirely, as a
  foam.core.theme.customisation.CSSTokenOverride row in a .jrl journal, which
  CSSTokenOverrideService.getTokenValue resolves before the axiom lookup, by
  bare name or as "<class id>.<name>" - so the audit reads every .jrl under
  project.home too and counts the source: of each such row as declared, a
  class-qualified one for that class only; see collectJournalTokens below.

  The CSS itself is read by foam.u2.parse.CSSParser, the server-side CSS
  grammar (src/foam/u2/parse/CSSParser.java), into rules, at-rules and
  declarations, and every check reads that tree: a colour is a hash node of
  3, 4, 6 or 8 hex digits, a colour function or a named colour ident, and a
  $token is a token node in a declaration's value (one inside a string or a
  comment is not a reference). What the grammar cannot read - a missing ';',
  a stray '}', a '//' line (CSS has no such comment) - fails as a CSS syntax
  error with the grammar's own message: the browser drops the declaration or
  the rule around it, so that style silently never applies.

  Failures are printed grouped by kind (syntax, colour, font, unknown token)
  after a summary line with the count of each; see report().

  Colour converters
https://www.myfixguide.com/color-converter/ - hex,rgb,hsl, rgba, argb
https://web-toolbox.dev/en/tools/color-converter - hsla

  FOAM Color picker - run from console to open
a = foam.u2.view.ColorEditView.create(); ctrl.stack.set(a);
  `,

  javaImports: [
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.Logger',
    'foam.lang.X',
    'foam.u2.parse.CSSNode',
    'foam.u2.parse.CSSParser',
    'foam.util.SafetyUtil',
    'java.io.File',
    'java.io.IOException',
    'java.nio.charset.StandardCharsets',
    'java.nio.file.Files',
    'java.nio.file.FileVisitor',
    'java.nio.file.FileVisitResult',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.nio.file.attribute.BasicFileAttributes',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.HashMap',
    'java.util.HashSet',
    'java.util.List',
    'java.util.Map',
    'java.util.Set',
    'java.util.concurrent.atomic.AtomicInteger'
  ],

  properties: [
    {
      documentation: `
        Each entry is matched against the directory path relative to
        project.home. A '^' prefix anchors the entry at the project root;
        without it the entry matches anywhere in the path. See pathSkipped.
      `,
      name: 'skipFoamPaths',
      class: 'List',
      javaFactory: `
      List list = new ArrayList();
      list.add("/build");
      list.add("/demos");
      // Anchored: an unanchored "/doc" also hid src/foam/doc, which holds 12
      // .js files with a css: block. The folder meant here is the project's
      // own doc/ at the root.
      list.add("^/doc");
      list.add("/node_modules");
      list.add("/tools");
      list.add("/webroot");

      // TODO: Lower priority
      list.add("src/foam/support");

      // TODO: TBD
      list.add("src/com/foamframework");
      list.add("src/com/google");
      list.add("src/foam/graphics");
      return list;
      `
    },
    {
      documentation: 'Refine this model in your application and add directories to skip/ignore.',
      name: 'skipAppPaths',
      class: 'List',
      javaFactory: `
      return new ArrayList();
      `
    }
  ],

  javaCode: `
  // The character a css: template is written with. Named so this file, which
  // is itself a template literal, does not have to escape it.
  protected static final char BACKTICK = (char) 96;

  // CSS' named colours. A theme cannot retune a name, so a name in a colour
  // declaration is as hard coded as a hex. 'transparent' and 'currentColor'
  // are deliberately absent: they take their colour from elsewhere.
  protected static final Set<String> NAMED_COLOURS = new HashSet(Arrays.asList((
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue " +
    "blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk " +
    "crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki " +
    "darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue " +
    "dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite " +
    "gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki " +
    "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen " +
    "lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen " +
    "magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
    "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum " +
    "powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen " +
    "steelblue tan teal thistle tomato turquoise violet wheat whitesmoke white yellow yellowgreen"
  ).split(" ")));

  protected static final Set<String> COLOUR_FUNCTIONS = new HashSet(Arrays.asList(
    "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch"
  ));

  // The only literals a font declaration may carry: everything else is a size,
  // a weight or a family that a token should own.
  protected static final Set<String> FONT_KEYWORDS = new HashSet(Arrays.asList(
    "inherit", "initial", "revert", "unset", "normal", "bold", "bolder", "lighter"
  ));

  protected static boolean isIdentifierChar(char c) {
    return Character.isLetterOrDigit(c) || c == '_' || c == '$';
  }

  protected static boolean isQuote(char c) {
    return c == '"' || c == '\\'' || c == BACKTICK;
  }

  // Reads the JS string or template literal whose opening quote is at i and
  // returns { text, indexAfterClosingQuote }, or null when it is not closed
  // (an apostrophe in prose). The text is the same length as the source it
  // came from, so an index into it still maps to a source line: escapes and
  // \${...} interpolations are blanked rather than dropped, which also keeps a
  // JS expression inside a css: template from being read as CSS.
  protected static Object[] readLiteral(String s, int i) {
    char          q  = s.charAt(i);
    int           n  = s.length();
    StringBuilder sb = new StringBuilder();
    int           j  = i + 1;

    while ( j < n ) {
      char c = s.charAt(j);
      if ( c == '\\\\' ) {
        sb.append("  ");
        j += 2;
        continue;
      }
      if ( q == BACKTICK && c == '$' && j + 1 < n && s.charAt(j + 1) == '{' ) {
        int k = j + 2;
        int d = 1;
        while ( k < n && d > 0 ) {
          char e = s.charAt(k);
          if ( e == '{' ) d++;
          else if ( e == '}' ) d--;
          k++;
        }
        for ( int m = j ; m < k ; m++ ) sb.append(s.charAt(m) == '\\n' ? '\\n' : ' ');
        j = k;
        continue;
      }
      if ( c == q ) return new Object[] { sb.toString(), Integer.valueOf(j + 1) };
      if ( q != BACKTICK && c == '\\n' ) return null;
      sb.append(c);
      j++;
    }
    return null;
  }

  protected static boolean keyAt(String s, int i, String key) {
    if ( ! s.startsWith(key, i) ) return false;
    return i == 0 || ! isIdentifierChar(s.charAt(i - 1));
  }

  // Collects the CSS held in a .js file: every css: literal, and the code: of
  // a foam.u2.CSS axiom. Each entry is { cssText, offsetOfFirstCharInFile }.
  // Comments and other string literals are walked past, so a css: written in
  // prose or inside another string is not collected.
  protected static List<Object[]> extractCSS(String src) {
    List<Object[]> out = new ArrayList();
    int            n   = src.length();
    int            i   = 0;

    while ( i < n ) {
      char c = src.charAt(i);
      if ( c == '/' && i + 1 < n && src.charAt(i + 1) == '/' ) {
        while ( i < n && src.charAt(i) != '\\n' ) i++;
        continue;
      }
      if ( c == '/' && i + 1 < n && src.charAt(i + 1) == '*' ) {
        int j = src.indexOf("*/", i + 2);
        i = j < 0 ? n : j + 2;
        continue;
      }
      if ( isQuote(c) ) {
        Object[] lit = readLiteral(src, i);
        i = lit == null ? i + 1 : ((Integer) lit[1]).intValue();
        continue;
      }

      String key = keyAt(src, i, "css") ? "css" : ( keyAt(src, i, "code") ? "code" : null );
      if ( key == null ) {
        i++;
        continue;
      }

      int j = i + key.length();
      while ( j < n && ( src.charAt(j) == ' ' || src.charAt(j) == '\\t' ) ) j++;
      if ( j < n && src.charAt(j) == ':' ) {
        j++;
        while ( j < n && Character.isWhitespace(src.charAt(j)) ) j++;
        // code: is only CSS when it is the foam.u2.CSS axiom's; every other
        // code: in the tree holds a script.
        boolean isCSS = key.equals("css") ||
          src.substring(Math.max(0, i - 80), i).contains("foam.u2.CSS.create");
        if ( j < n && isQuote(src.charAt(j)) && isCSS ) {
          Object[] lit = readLiteral(src, j);
          if ( lit != null ) {
            out.add(new Object[] { lit[0], Integer.valueOf(j + 1) });
            i = ((Integer) lit[1]).intValue();
            continue;
          }
        }
      }
      i += key.length();
    }
    return out;
  }

  // The grammar holds no per-parse state (see CSSParser.java), so one
  // instance serves every block.
  protected static final CSSParser GRAMMAR = new CSSParser();

  // One thing the audit read in a css: block: a declaration (clean or not)
  // or a CSS syntax error the grammar reported.
  protected static class Finding {
    protected String       kind;                     // "declaration" or "syntax"
    protected String       property;                 // declaration: as written
    protected String       value;                    // declaration: the value; syntax: the text the error covers
    protected int          offset;                   // into the css: text
    protected String       problem;                  // COLOUR_ADVICE, FONT_ADVICE, a syntax message, or null
    protected List<String> tokens = new ArrayList(); // declaration: its $tokens, without '$'
  }

  // How much of an error's text a failure line quotes: enough to find it on
  // the reported line, not a whole skipped rule.
  protected static final int SNIPPET = 60;

  // Parses one css: block and lists its declarations, then its syntax
  // errors. Only a property and value inside a block is a declaration: a
  // selector, an @media condition and a comment are not, which is what keeps
  // a colour written in a comment or a JS key named after a CSS property out
  // of the audit.
  protected static List<Finding> auditBlock(String css) {
    List<Finding> out  = new ArrayList();
    CSSNode       tree = GRAMMAR.parse(css);
    for ( CSSParser.Declaration d : CSSParser.declarations(tree) ) {
      final Finding f = new Finding();
      f.kind     = "declaration";
      f.property = d.property;
      // One line per failure: the test runner keeps only lines that start
      // with FAILURE, so a multi-line value (a gradient, a cut string) would
      // lose everything after its first line break.
      f.value    = d.value.replaceAll("\\\\s+", " ").trim();
      f.offset   = d.node.start;
      // context null: a $name inside a string, comment or url() is text,
      // not a reference the token machinery resolves.
      CSSParser.walk(d.node.valueNode(), (n, a) -> {
        if ( "token".equals(n.kind) && n.context == null ) f.tokens.add(n.raw.substring(1));
        return true;
      });
      f.problem  = violation(d);
      out.add(f);
    }
    // errors() also lists a string, function, paren or bracket left open,
    // which carries no message of its own.
    for ( CSSNode e : CSSParser.errors(tree) ) {
      Finding f = new Finding();
      String  s = e.raw.replaceAll("\\\\s+", " ").trim();
      f.kind     = "syntax";
      f.property = "";
      f.value    = s.length() > SNIPPET ? s.substring(0, SNIPPET) + "..." : s;
      f.offset   = e.start;
      f.problem  = e.message != null ? e.message : "Unclosed " + e.kind;
      out.add(f);
    }
    return out;
  }

  // Problem: Script.output keeps only its first MAX_OUTPUT_CHARS (20000)
  // characters, so one kind with hundreds of failures - a bulk colour
  // regression, say - would push every other kind, and the counts, out of
  // the report. Each kind prints at most REPORT_BUDGET characters, then one
  // line saying how many more there are; every failure still counts in
  // getFailed(), and the summary line printed first has the full counts.
  protected static final int REPORT_BUDGET = 4000;

  protected void report(List<String> failures, String kind) {
    int used = 0;
    for ( int i = 0 ; i < failures.size() ; i++ ) {
      String f = failures.get(i);
      used += f.length() + 10; // "FAILURE: " and the newline
      if ( used > REPORT_BUDGET ) {
        int more = failures.size() - i;
        setFailed(getFailed() + more);
        print("FAILURE: ... and " + more + " more " + kind + " failures, not shown");
        return;
      }
      test(false, f);
    }
  }

  // What a failing declaration says. The advice names the file to look in and
  // three tokens to look at, so the line is actionable without going and
  // reading this test first.
  protected static final String COLOUR_ADVICE =
    " is a hard coded colour; use a $token from src/foam/u2/CSSTokens.js " +
    "(e.g. $textDefault, $borderLight, $backgroundSecondary) or declare one " +
    "in the class' cssTokens:";

  protected static final String FONT_ADVICE =
    " is a hard coded font value; use a $token from src/foam/u2/CSSTokens.js " +
    "(e.g. $font1, $font-bold, $body-md) or declare one in the class' " +
    "cssTokens:";

  // Whether a value node carries no hard coded colour or font by its kind: a
  // $token (having one is the point of the audit), a legacy %THEME%
  // placeholder, a var() reference, a url(), a comment and !important.
  protected static boolean carriesNoLiteral(CSSNode n) {
    if ( n.kind.equals("token") || n.kind.equals("placeholder") || n.kind.equals("comment") ||
         n.kind.equals("important") || n.kind.equals("url") ) return true;
    return n.kind.equals("function") && "var".equalsIgnoreCase(n.name);
  }

  // Returns what is wrong with a declaration, or null when it is clean.
  protected static String violation(CSSParser.Declaration d) {
    // A --custom-property is the app's own name for a value, not a CSS colour.
    if ( d.custom ) return null;
    String  p      = d.property.trim().toLowerCase();
    boolean colour = p.equals("color") || p.endsWith("-color") ||
                     p.equals("border") || p.startsWith("border-") ||
                     p.equals("background") || p.equals("background-image");
    boolean font   = p.equals("font") || p.equals("font-weight");
    if ( ! colour && ! font ) return null;

    CSSNode       value = d.node.valueNode();
    List<CSSNode> rest  = new ArrayList();
    if ( value != null && value.components != null ) {
      for ( CSSNode c : value.components ) if ( ! carriesNoLiteral(c) ) rest.add(c);
    }
    if ( rest.isEmpty() ) return null;

    if ( colour ) {
      // Walks into functions and parens (a gradient's colour stops), but not
      // into what carriesNoLiteral lets through or a string, whose text is
      // not a colour.
      final boolean[] found = { false };
      for ( CSSNode c : rest ) {
        CSSParser.walk(c, (n, a) -> {
          if ( found[0] || carriesNoLiteral(n) || n.kind.equals("string") ) return false;
          if ( n.kind.equals("hash") && n.isHexColor ) found[0] = true;
          if ( n.kind.equals("function") && n.name != null &&
               COLOUR_FUNCTIONS.contains(n.name.toLowerCase()) ) found[0] = true;
          if ( n.kind.equals("ident") && n.value instanceof String &&
               NAMED_COLOURS.contains(((String) n.value).toLowerCase()) ) found[0] = true;
          return ! found[0];
        });
        if ( found[0] ) return COLOUR_ADVICE;
      }
      return null;
    }
    CSSNode only = rest.size() == 1 ? rest.get(0) : null;
    boolean ok   = only != null && only.kind.equals("ident") && only.value instanceof String &&
                   FONT_KEYWORDS.contains(((String) only.value).toLowerCase());
    return ok ? null : FONT_ADVICE;
  }

  // The states ColorToken derives a token for.
  protected static final Set<String> DERIVED_STATES = new HashSet(Arrays.asList(
    "hover", "active", "disabled"
  ));

  // Whether a derived form of a token name exists. ColorToken installs exactly
  // five shapes on the class the token is declared on
  // (src/foam/u2/ColorToken.js:51-68): $name$hover, $name$active,
  // $name$disabled, $name$foreground and $name$<state>$foreground. Nothing
  // else is installed, and a plain CSSToken gets none of them - $inputHeight
  // has no $hover, so $inputHeight$hover resolves to nothing at runtime.
  // tools/lsp/CSSTokenResolver.js:71-72 reads this same set off the class for
  // the editor's completions: the two have to accept the same names, or the
  // editor offers one this test then fails on.
  // parts is the name split on '$', so parts[0] is the declared token.
  protected static boolean derivedFormExists(String[] parts) {
    if ( parts.length == 2 ) {
      return DERIVED_STATES.contains(parts[1]) || "foreground".equals(parts[1]);
    }
    if ( parts.length == 3 ) {
      return DERIVED_STATES.contains(parts[1]) && "foreground".equals(parts[2]);
    }
    return false;
  }

  // A class literal the scan found: a foam.CLASS/ENUM/INTERFACE call, or an
  // object literal directly inside a classes: array. The second is a class in
  // its own right at runtime - foam.lang.InnerClass registers it under
  // outer.id + '.' + name and builds it from its own model, including its own
  // extends: (src/foam/lang/InnerClass.js:77) - so it resolves $tokens on its
  // own chain, not the outer class'.
  //
  // Named fields rather than an Object[] indexed by position: the walk below
  // fills eight of them and the audit reads them a hundred lines later.
  protected static class ModelInfo {
    protected ModelInfo            outer;                    // set for an inner class
    protected String               pkg;
    protected String               name;
    protected String               refines;
    protected String               extendsId;
    protected List<String>         mixinIds = new ArrayList();
    // Declared token name -> whether its entry is a ColorToken, which decides
    // which derived $suffix forms of it exist.
    protected Map<String, Boolean> tokens   = new HashMap();
    protected int                  start;                    // offset of the '{'
    protected int                  end;                      // offset of the '}'

    protected String  id_;
    protected boolean idResolved_;

    // Built after the walk, because an inner class' id needs the outer class'
    // package: and name:, which may be read after the inner class closes.
    protected String id() {
      if ( idResolved_ ) return id_;
      idResolved_ = true;
      if ( refines != null ) {
        id_ = refines;
      } else if ( name == null ) {
        id_ = null;
      } else if ( outer != null ) {
        String o = outer.id();
        id_ = o == null ? name : o + "." + name;
      } else {
        id_ = pkg == null ? name : pkg + "." + name;
      }
      return id_;
    }
  }

  // One '{' or '[' the walk is currently inside.
  protected static class Frame {
    protected int                  start;
    protected char                 open;         // '{' or '['
    protected ModelInfo            model;        // this '{' is a class literal
    protected boolean              classesArray; // this '[' is a classes: value
    protected boolean              mixinsArray;  // this '[' is a mixins: value
    protected Map<String, Boolean> tokens;       // this '[' holds cssTokens: entries
    protected String               tokenName;    // this '{' is a cssTokens: entry
    protected String               tokenClass;
  }

  // The class the walk is inside: the nearest enclosing class literal.
  protected static ModelInfo enclosingModel(List<Frame> stack) {
    for ( int i = stack.size() - 1 ; i >= 0 ; i-- ) {
      if ( stack.get(i).model != null ) return stack.get(i).model;
    }
    return null;
  }

  // Whether what follows a token array is a .map(...) that stamps a class onto
  // every entry in it, which is how src/foam/u2/CSSTokens.js:267 makes its
  // whole palette block ColorTokens: an entry there carries no class: of its
  // own, so without reading this the palette would look like plain CSSTokens
  // and every $primary400$hover in the tree would be reported unknown.
  protected static boolean mappedToColorToken(String src, int i) {
    int n = src.length();
    while ( i < n && Character.isWhitespace(src.charAt(i)) ) i++;
    if ( ! src.startsWith(".map(", i) ) return false;
    int j = i + 5;
    int d = 1;
    while ( j < n && d > 0 ) {
      char c = src.charAt(j);
      if ( c == '(' ) d++;
      else if ( c == ')' ) d--;
      j++;
    }
    return src.substring(i, j).contains("ColorToken");
  }

  // One brace walk over a .js file for every class it declares: the
  // foam.CLASS/ENUM/INTERFACE calls and the inner classes under a classes:
  // array. Each carries what a $token lookup needs - id, extends:, mixins: and
  // the cssTokens: it declares - and the span it covers, which is how a css:
  // block is matched to the class that owns it. Comments and strings are
  // walked past.
  protected static List<ModelInfo> scanStructure(String src) {
    List<ModelInfo> models       = new ArrayList();
    List<Frame>     stack        = new ArrayList();
    int             n            = src.length();
    int             i            = 0;
    boolean         opensModel   = false;  // the next '{' is a foam.CLASS body
    int             pendingArray = 0;      // 1 = a classes: value, 2 = a mixins: value
    ModelInfo       tokenOwner   = null;   // the class whose cssTokens: is being read
    int             tokenDepth   = -1;     // the stack depth that value sits at

    while ( i < n ) {
      char c = src.charAt(i);
      if ( c == '/' && i + 1 < n && src.charAt(i + 1) == '/' ) {
        while ( i < n && src.charAt(i) != '\\n' ) i++;
        continue;
      }
      if ( c == '/' && i + 1 < n && src.charAt(i + 1) == '*' ) {
        int j = src.indexOf("*/", i + 2);
        i = j < 0 ? n : j + 2;
        continue;
      }

      if ( c == 'f' ) {
        int len = keyAt(src, i, "foam.CLASS")     ? 10 :
                  keyAt(src, i, "foam.ENUM")      ?  9 :
                  keyAt(src, i, "foam.INTERFACE") ? 14 : 0;
        if ( len > 0 ) {
          int j = i + len;
          while ( j < n && Character.isWhitespace(src.charAt(j)) ) j++;
          if ( j < n && src.charAt(j) == '(' ) {
            j++;
            while ( j < n && Character.isWhitespace(src.charAt(j)) ) j++;
            if ( j < n && src.charAt(j) == '{' ) {
              opensModel = true;
              i = j;
              continue;
            }
          }
          i += len;
          continue;
        }
      }

      if ( c == '{' || c == '[' ) {
        Frame top   = stack.isEmpty() ? null : stack.get(stack.size() - 1);
        Frame frame = new Frame();
        frame.start = i;
        frame.open  = c;

        if ( c == '{' ) {
          if ( opensModel ) {
            frame.model = new ModelInfo();
            models.add(frame.model);
          } else if ( top != null && top.classesArray ) {
            frame.model       = new ModelInfo();
            frame.model.outer = enclosingModel(stack);
            models.add(frame.model);
          }
        } else {
          frame.classesArray = pendingArray == 1;
          frame.mixinsArray  = pendingArray == 2;
          // Every array at the cssTokens: value's own depth holds token
          // entries: CSSTokens.js writes the value as
          // [ ... ].map(...).concat([ ... ]), two sibling arrays.
          if ( tokenOwner != null && stack.size() == tokenDepth ) {
            frame.tokens = new HashMap();
          }
          // An array element that is itself an array is the [ name, value ]
          // form of a token.
          if ( top != null && top.tokens != null ) {
            int j = i + 1;
            while ( j < n && Character.isWhitespace(src.charAt(j)) ) j++;
            if ( j < n && isQuote(src.charAt(j)) ) {
              Object[] lit = readLiteral(src, j);
              if ( lit != null ) top.tokens.put((String) lit[0], Boolean.FALSE);
            }
          }
        }
        opensModel   = false;
        pendingArray = 0;
        stack.add(frame);
        i++;
        continue;
      }

      if ( c == '}' || c == ']' ) {
        if ( ! stack.isEmpty() ) {
          Frame frame = stack.remove(stack.size() - 1);
          Frame top   = stack.isEmpty() ? null : stack.get(stack.size() - 1);

          if ( frame.model != null ) {
            frame.model.start = frame.start;
            frame.model.end   = i;
          }
          if ( frame.tokenName != null ) {
            Boolean colour = Boolean.valueOf(frame.tokenClass != null &&
                                             frame.tokenClass.endsWith("ColorToken"));
            if ( top != null && top.tokens != null ) {
              top.tokens.put(frame.tokenName, colour);
            } else if ( tokenOwner != null ) {
              tokenOwner.tokens.put(frame.tokenName, colour);
            }
          }
          if ( frame.tokens != null && tokenOwner != null ) {
            if ( mappedToColorToken(src, i + 1) ) {
              for ( String name : new ArrayList<String>(frame.tokens.keySet()) ) {
                frame.tokens.put(name, Boolean.TRUE);
              }
            }
            tokenOwner.tokens.putAll(frame.tokens);
          }
          if ( tokenOwner != null && stack.size() < tokenDepth ) {
            tokenOwner = null;
            tokenDepth = -1;
          }
        }
        i++;
        continue;
      }

      if ( c == ',' && tokenOwner != null && stack.size() == tokenDepth ) {
        tokenOwner = null;
        tokenDepth = -1;
        i++;
        continue;
      }

      // A key: an identifier or a quoted name followed by ':'.
      Frame   top    = stack.isEmpty() ? null : stack.get(stack.size() - 1);
      int     keyEnd = -1;
      String  key    = null;
      boolean quoted = false;
      if ( Character.isLetter(c) || c == '_' ) {
        int j = i;
        while ( j < n && isIdentifierChar(src.charAt(j)) ) j++;
        key    = src.substring(i, j);
        keyEnd = j;
      } else if ( isQuote(c) ) {
        Object[] lit = readLiteral(src, i);
        if ( lit == null ) { i++; continue; }
        key    = (String) lit[0];
        keyEnd = ((Integer) lit[1]).intValue();
        quoted = true;
      }
      if ( key == null ) { i++; continue; }

      int j = keyEnd;
      while ( j < n && Character.isWhitespace(src.charAt(j)) ) j++;
      if ( j >= n || src.charAt(j) != ':' ) {
        // A string that is an element of a mixins: array is a mixin's path.
        if ( quoted && top != null && top.mixinsArray ) {
          ModelInfo m = enclosingModel(stack);
          if ( m != null ) m.mixinIds.add(key);
        }
        i = keyEnd;
        continue;
      }
      j++;
      while ( j < n && Character.isWhitespace(src.charAt(j)) ) j++;

      if ( top != null && top.model != null ) {
        if ( key.equals("cssTokens") ) {
          tokenOwner = top.model;
          tokenDepth = stack.size();
          i = j;
          continue;
        }
        if ( key.equals("classes") || key.equals("mixins") ) {
          if ( j < n && src.charAt(j) == '[' ) {
            pendingArray = key.equals("classes") ? 1 : 2;
          }
          i = j;
          continue;
        }
        if ( j < n && isQuote(src.charAt(j)) ) {
          boolean known = key.equals("package") || key.equals("name") ||
                          key.equals("extends") || key.equals("refines");
          if ( known ) {
            Object[] lit = readLiteral(src, j);
            if ( lit != null ) {
              String val = (String) lit[0];
              if ( key.equals("package") && top.model.pkg       == null ) top.model.pkg       = val;
              if ( key.equals("name")    && top.model.name      == null ) top.model.name      = val;
              if ( key.equals("extends") && top.model.extendsId == null ) top.model.extendsId = val;
              if ( key.equals("refines") && top.model.refines   == null ) top.model.refines   = val;
              i = ((Integer) lit[1]).intValue();
              continue;
            }
          }
        }
      }

      if ( top != null && top.model == null && top.open == '{' && j < n &&
           isQuote(src.charAt(j)) ) {
        // A cssTokens: entry's own name: and class:.
        if ( tokenOwner != null && stack.size() > tokenDepth &&
             ( key.equals("name") || key.equals("class") ) ) {
          Object[] lit = readLiteral(src, j);
          if ( lit != null ) {
            if ( key.equals("name")  && top.tokenName  == null ) top.tokenName  = (String) lit[0];
            if ( key.equals("class") && top.tokenClass == null ) top.tokenClass = (String) lit[0];
            i = ((Integer) lit[1]).intValue();
            continue;
          }
        }
        // A mixins: entry written as { path: '...' } rather than a bare string
        // (foam.lang.Mixin's adaptArrayElement takes either,
        // src/foam/lang/Mixin.js:46-50).
        if ( key.equals("path") && stack.size() > 1 &&
             stack.get(stack.size() - 2).mixinsArray ) {
          Object[] lit = readLiteral(src, j);
          if ( lit != null ) {
            ModelInfo m = enclosingModel(stack);
            if ( m != null ) m.mixinIds.add((String) lit[0]);
            i = ((Integer) lit[1]).intValue();
            continue;
          }
        }
      }
      i = j;
    }
    return models;
  }

  // Whether a class declares a token, walking the chain the runtime installs
  // axioms along: the class itself, then each mixin it lists - foam.lang.Mixin
  // installs the mixin model's own axioms onto the mixing class
  // (src/foam/lang/Mixin.js:30), so a token declared in a mixin's cssTokens:
  // resolves on every class that mixes it in - then what the class extends,
  // and so on. Returns TRUE or FALSE for the token's ColorToken-ness, or null
  // when nothing on the chain declares it.
  protected static Boolean declaredOn(String cls, String token,
                                      Map<String, String> extendsOf,
                                      Map<String, List<String>> mixinsOf,
                                      Map<String, Map<String, Boolean>> tokensOf,
                                      Set<String> seen) {
    while ( cls != null && seen.add(cls) ) {
      Map<String, Boolean> declared = tokensOf.get(cls);
      if ( declared != null && declared.containsKey(token) ) return declared.get(token);
      List<String> mixins = mixinsOf.get(cls);
      if ( mixins != null ) {
        for ( String mixin : mixins ) {
          Boolean found = declaredOn(mixin, token, extendsOf, mixinsOf, tokensOf, seen);
          if ( found != null ) return found;
        }
      }
      cls = extendsOf.get(cls);
    }
    return null;
  }

  // Resolves a $token the way the runtime does: the owning class, its mixins
  // and its ancestors, then the global foam.u2.CSSTokens. A $name$suffix form
  // has to be one ColorToken actually installs, on a token that is a
  // ColorToken - see derivedFormExists.
  protected static boolean tokenDeclared(String name, String classId,
                                         Map<String, String> extendsOf,
                                         Map<String, List<String>> mixinsOf,
                                         Map<String, Map<String, Boolean>> tokensOf,
                                         Map<String, Boolean> globals) {
    String   base  = name;
    String[] parts = null;
    if ( base.indexOf('$') > 0 ) {
      parts = base.split("\\\\$");
      base  = parts[0];
    }

    String owner = classId;
    String token = base;
    int    dot   = base.lastIndexOf('.');
    if ( dot > 0 ) {
      owner = base.substring(0, dot);
      token = base.substring(dot + 1);
    }

    Boolean colour = declaredOn(owner, token, extendsOf, mixinsOf, tokensOf, new HashSet());
    if ( colour == null ) colour = globals.get(token);
    if ( colour == null ) return false;
    if ( parts == null ) return true;
    return colour.booleanValue() && derivedFormExists(parts);
  }

  // The declared name closest to a misspelt one, so a typo reads as a typo.
  protected static String didYouMean(String name, Set<String> candidates) {
    String best     = null;
    int    bestCost = 3;
    for ( String c : candidates ) {
      if ( Math.abs(c.length() - name.length()) >= bestCost ) continue;
      int cost = editDistance(name, c, bestCost);
      if ( cost < bestCost ) {
        bestCost = cost;
        best     = c;
      }
    }
    return best;
  }

  protected static int editDistance(String a, String b, int limit) {
    int[] prev = new int[b.length() + 1];
    int[] cur  = new int[b.length() + 1];
    for ( int j = 0 ; j <= b.length() ; j++ ) prev[j] = j;
    for ( int i = 1 ; i <= a.length() ; i++ ) {
      cur[0] = i;
      int rowMin = cur[0];
      for ( int j = 1 ; j <= b.length() ; j++ ) {
        int sub = prev[j - 1] + ( a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1 );
        cur[j] = Math.min(sub, Math.min(prev[j] + 1, cur[j - 1] + 1));
        rowMin = Math.min(rowMin, cur[j]);
      }
      if ( rowMin >= limit ) return limit;
      int[] swap = prev;
      prev = cur;
      cur  = swap;
    }
    return prev[b.length()];
  }

  // The string value that follows an offset in a journal row: the ':' and any
  // whitespace are stepped over, then a double quoted value is read, with a
  // backslash taking the character after it as written.
  protected static String quotedValueAt(String row, int i) {
    int n = row.length();
    while ( i < n && ( Character.isWhitespace(row.charAt(i)) || row.charAt(i) == ':' ) ) i++;
    if ( i >= n || row.charAt(i) != '"' ) return null;
    StringBuilder sb = new StringBuilder();
    i++;
    while ( i < n ) {
      char c = row.charAt(i);
      if ( c == '\\\\' ) {
        if ( i + 1 < n ) sb.append(row.charAt(i + 1));
        i += 2;
        continue;
      }
      if ( c == '"' ) return sb.toString();
      sb.append(c);
      i++;
    }
    return null;
  }

  // Every string value a journal row holds under a key. A journal is written
  // in either of two forms: JSON style with the key quoted ("class":"x"), or
  // JS object style with it bare (class:"x", the form an application journal
  // commonly uses), with or without whitespace around the ':'. Matching only
  // the quoted form read zero CSSTokenOverride rows from a journal written
  // the second way, so every token it declares was reported unknown.
  // The key has to stand alone: 'source' inside sourceClass: or inside a
  // value such as "source" (no ':' after it) is not a match.
  protected static List<String> valuesOf(String row, String key) {
    List<String> out = new ArrayList();
    int          n   = row.length();
    for ( int k = row.indexOf(key) ; k >= 0 ; k = row.indexOf(key, k + 1) ) {
      int     before = k - 1;
      int     after  = k + key.length();
      boolean quoted = before >= 0 && row.charAt(before) == '"' && after < n && row.charAt(after) == '"';
      if ( quoted ) {
        before--;
        after++;
      }
      if ( before >= 0 && ( isIdentifierChar(row.charAt(before)) || row.charAt(before) == '"' ) ) continue;
      if ( after < n && isIdentifierChar(row.charAt(after)) ) continue;
      int j = after;
      while ( j < n && Character.isWhitespace(row.charAt(j)) ) j++;
      if ( j >= n || row.charAt(j) != ':' ) continue;
      String value = quotedValueAt(row, j);
      if ( value != null ) out.add(value);
    }
    return out;
  }

  // The tokens an application declares outside JS: every
  // foam.core.theme.customisation.CSSTokenOverride row in a journal
  // contributes its source: as a token name. At runtime
  // CSSTokenOverrideService.getTokenValue
  // (src/foam/core/theme/customisation/CSSTokenOverrideService.js:109-152)
  // looks a $name up in those rows - by the bare name as well as by
  // class-qualified name - before it falls back to the CSSTokens axiom
  // lookup, so a name only a journal declares still resolves on the page and
  // is not a typo.
  //
  // Those rows are theme scoped at runtime: a row carries the theme it
  // applies to, and getTokenValue only reads the rows of the current theme
  // (plus the theme-less '' ones). The audit asks a narrower question - does
  // this name exist anywhere in the application's vocabulary - so the theme
  // is ignored and a row under any theme counts.
  //
  // p( and r( rows count the same, for the same reason: a row someone removed
  // still proves the name was part of that vocabulary, and treating a removal
  // as an undeclaration would report a name the rest of the journal still
  // declares.
  //
  // A derived form may be written out literally in a journal
  // (buttonSecondaryColor$hover as its own row); a literal match is a match.
  // Nothing else about the token - whether it is a ColorToken, what it
  // resolves to - can be read off a journal row, so no derived form is
  // inferred from a journal declaration the way it is from a cssTokens:
  // entry.
  protected static void collectJournalTokens(String src, Set<String> out) {
    int n = src.length();
    // A journal entry starts at the beginning of a line, as a one letter
    // command - p(, r(, c(, u( - wrapped around the object it carries, and
    // runs until the next such line or the end of the file. Ending a row at
    // the next command rather than at a ')' is what lets a row be written
    // over several lines, and keeps triple quoted values - which the entry
    // above cssTokenOverrides in src/foam/core/theme/services.jrl uses - from
    // throwing off a quote counting walk.
    List<Integer> starts = new ArrayList();
    for ( int i = 0 ; i + 1 < n ; i++ ) {
      if ( ( i == 0 || src.charAt(i - 1) == '\\n' ) &&
           Character.isLetter(src.charAt(i)) && src.charAt(i + 1) == '(' ) {
        starts.add(Integer.valueOf(i));
      }
    }
    for ( int r = 0 ; r < starts.size() ; r++ ) {
      int    from = starts.get(r).intValue();
      int    to   = r + 1 < starts.size() ? starts.get(r + 1).intValue() : n;
      String row  = src.substring(from, to);
      // The row's own class:, not any class name that happens to appear in
      // it: the CSpec that serves the CSSTokenOverride DAO names the same
      // class under "of", and that entry declares no token.
      if ( ! valuesOf(row, "class").contains("foam.core.theme.customisation.CSSTokenOverride") ) continue;
      // source: may be written before or after class:, so the whole row is
      // searched rather than the text after the class name.
      for ( String name : valuesOf(row, "source") ) {
        if ( name.length() > 0 ) out.add(name);
      }
    }
  }

  // Whether the journal rows declare $token for a css: written in classId.
  // A bare-name row applies to every class, since getTokenValue reaches the
  // rows by bare name whatever class the $token was written in; a row whose
  // source: is class-qualified ("my.Cls.tok") is reached as
  // cls.id + '.' + name (CSSTokenOverrideService.getTokenValue), so it
  // declares the token for that class only.
  protected static boolean journalDeclares(Set<String> journalTokens, String token, String classId) {
    return journalTokens.contains(token) ||
      ( classId != null && journalTokens.contains(classId + "." + token) );
  }

  // Problem: collectJournalTokens once matched only a quoted "class": key, so
  // a journal written with bare keys (class:"...") contributed zero tokens
  // and nothing failed - the tokens it declared were simply reported as
  // unknown elsewhere. This reads one row of each form, plus a row of another
  // class and a CSpec naming the class under of:, and checks exactly the three
  // override names come back.
  protected void checkJournalReader() {
    String journal =
      "p({\\"class\\":\\"foam.core.theme.customisation.CSSTokenOverride\\",\\"source\\":\\"quotedKeyToken\\",\\"target\\":\\"#fff\\"})\\n" +
      "p({class:\\"foam.core.theme.customisation.CSSTokenOverride\\", source : \\"bareKeyToken\\", target:\\"#000\\"})\\n" +
      "p({\\n  class: \\"foam.core.theme.customisation.CSSTokenOverride\\",\\n  theme: \\"t\\",\\n  source: \\"multiLineToken\\"\\n})\\n" +
      "p({class:\\"foam.core.boot.CSpec\\", name:\\"cssTokenOverrideDAO\\", of:\\"foam.core.theme.customisation.CSSTokenOverride\\", source:\\"notAToken\\"})\\n" +
      "p({class:\\"foam.core.theme.Theme\\", sourceClass:\\"x\\", source:\\"alsoNotAToken\\"})\\n";
    Set<String> found = new HashSet();
    collectJournalTokens(journal, found);
    Set<String> expected = new HashSet(Arrays.asList("quotedKeyToken", "bareKeyToken", "multiLineToken"));
    test(found.equals(expected),
      "collectJournalTokens reads CSSTokenOverride rows with quoted and bare keys: expected " +
      expected + ", read " + found);

    Set<String> rows = new HashSet(Arrays.asList("bareToken", "my.Cls.scopedToken"));
    test(journalDeclares(rows, "bareToken", "other.Cls") && journalDeclares(rows, "bareToken", null),
      "journalDeclares: a bare-name row declares the token for every class");
    test(journalDeclares(rows, "scopedToken", "my.Cls") && ! journalDeclares(rows, "scopedToken", "other.Cls") &&
         ! journalDeclares(rows, "scopedToken", null),
      "journalDeclares: a class-qualified row declares the token for that class only");
  }

  // Whether a directory - given as its path relative to project.home, so it
  // always starts with '/' - matches one of the skip entries. A '^' prefix on
  // an entry anchors it at the project root; without one the entry matches
  // anywhere in the path, which is what "src/foam/support" relies on and what
  // made a plain "/doc" hide src/foam/doc as well as doc/.
  protected static boolean pathSkipped(String parent, List<String> paths) {
    for ( String p : paths ) {
      if ( p.startsWith("^") ) {
        String root = p.substring(1);
        if ( parent.equals(root) || parent.startsWith(root + "/") ) return true;
      } else if ( parent.contains(p) ) {
        return true;
      }
    }
    return false;
  }

  protected static int lineOf(String src, int offset) {
    int line = 1;
    for ( int i = 0 ; i < offset && i < src.length() ; i++ ) {
      if ( src.charAt(i) == '\\n' ) line++;
    }
    return line;
  }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
    Logger logger = new PrefixLogger(new Object[] { "CSSAuditTest"}, (Logger) x.get("logger"));
    String projectHome = System.getProperty("project.home");
    if ( SafetyUtil.isEmpty(projectHome) ) {
      test ( false, "project.home found "+projectHome );
      throw new RuntimeException("project.home not found");
    }

    final AtomicInteger processed = new AtomicInteger();
    final AtomicInteger blocks    = new AtomicInteger();

    // A $token may be declared in a class this file only extends, so the
    // declarations are collected first and resolved once the whole tree has
    // been read.
    final Map<String, String>               extendsOf = new HashMap();
    final Map<String, List<String>>         mixinsOf  = new HashMap();
    final Map<String, Map<String, Boolean>> tokensOf  = new HashMap();
    final List<Object[]>                    tokenUses = new ArrayList();

    // The source: of every CSSTokenOverride journal row: a bare token name,
    // or a class-qualified "my.Cls.name". Collected in the same walk as the
    // .js files and resolved with them, at the end, because a journal
    // anywhere under project.home declares the name - see
    // collectJournalTokens and journalDeclares.
    final Set<String>                       journalTokens = new HashSet();

    // Failures are collected by kind and printed at the end, grouped, after a
    // summary line - see report().
    final List<String>                      syntaxFailures = new ArrayList();
    final List<String>                      colourFailures = new ArrayList();
    final List<String>                      fontFailures   = new ArrayList();
    final List<String>                      tokenFailures  = new ArrayList();

    try {
      Path start = Paths.get(projectHome);
      Files.walkFileTree(start,
        new FileVisitor<Path>() {
  @Override
  public FileVisitResult preVisitDirectory(Path path, BasicFileAttributes attrs)
    throws IOException {

    File file = path.toFile();
    String parent = file.getParent();
    if ( file.isDirectory() ) {
      parent = path.toString();
    }
    parent = parent.substring(projectHome.length());
    String name = file.getName();
    boolean skip = pathSkipped(parent, (List<String>) getSkipFoamPaths()) ||
                   pathSkipped(parent, (List<String>) getSkipAppPaths());
    if ( skip ||
         name.startsWith("iso") ||
         name.startsWith(".") ) 
    {
      logger.info("skip", path.toString());
      return FileVisitResult.SKIP_SUBTREE;
    }
    return FileVisitResult.CONTINUE;
  }

  @Override
  public FileVisitResult visitFile(Path path, BasicFileAttributes attrs)
    throws IOException {

    if ( path.toString().endsWith(".jrl") ) {
      try {
        collectJournalTokens(new String(Files.readAllBytes(path), StandardCharsets.UTF_8),
                             journalTokens);
      } catch (IOException e) {
        logger.error("Error reading journal " + path.toString() + " " + e.getMessage());
      }
      return FileVisitResult.CONTINUE;
    }
    if ( ! path.toString().endsWith(".js") )
      return FileVisitResult.CONTINUE;
    processed.incrementAndGet();
    String relativePath = path.toString().substring(projectHome.length()+1);
    logger.info("processing", relativePath);

    try {
      String src = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);

      List<ModelInfo> models = scanStructure(src);
      for ( ModelInfo model : models ) {
        String id = model.id();
        if ( id == null ) continue;
        if ( model.extendsId != null && ! extendsOf.containsKey(id) ) {
          extendsOf.put(id, model.extendsId);
        }
        if ( ! model.mixinIds.isEmpty() ) {
          List<String> mixins = mixinsOf.get(id);
          if ( mixins == null ) {
            mixins = new ArrayList();
            mixinsOf.put(id, mixins);
          }
          mixins.addAll(model.mixinIds);
        }
        if ( ! model.tokens.isEmpty() ) {
          Map<String, Boolean> declared = tokensOf.get(id);
          if ( declared == null ) {
            declared = new HashMap();
            tokensOf.put(id, declared);
          }
          declared.putAll(model.tokens);
        }
      }

      for ( Object[] block : extractCSS(src) ) {
        blocks.incrementAndGet();
        String css  = (String) block[0];
        int    base = ((Integer) block[1]).intValue();

        // The class the css: belongs to: the innermost class literal whose
        // span contains it, so an inner class under classes: owns its own
        // css: rather than the class it is nested in.
        String owner   = null;
        int    nearest = -1;
        for ( ModelInfo model : models ) {
          if ( model.start <= base && base <= model.end && model.start > nearest &&
               model.id() != null ) {
            owner   = model.id();
            nearest = model.start;
          }
        }

        for ( Finding f : auditBlock(css) ) {
          int    line  = lineOf(src, base + f.offset);
          String where = relativePath+":"+line+" - ";

          if ( "syntax".equals(f.kind) ) {
            syntaxFailures.add(where+"CSS syntax error: "+f.problem+" at '"+f.value+"'");
            continue;
          }

          for ( String token : f.tokens ) {
            tokenUses.add(new Object[] { relativePath, Integer.valueOf(line), owner, token });
          }

          if ( f.problem == null ) {
            logger.info("ok", f.property, f.value);
            continue;
          }
          ( f.problem == COLOUR_ADVICE ? colourFailures : fontFailures )
            .add(where+f.property+": "+f.value+f.problem);
        }
      }
    } catch (IOException e) {
      test ( false, "Error processing file "+relativePath + " " + e.getMessage());
    }
    return FileVisitResult.CONTINUE;
  }

  @Override
  public FileVisitResult visitFileFailed(Path path, IOException e)
    throws IOException {

    logger.error(path.toString() + " " + e.getMessage());
    return FileVisitResult.CONTINUE;
  }

  @Override
  public FileVisitResult postVisitDirectory(Path path, IOException e)
    throws IOException {

    return FileVisitResult.CONTINUE;
  }
}
);
      Map<String, Boolean> globals = tokensOf.get("foam.u2.CSSTokens");
      if ( globals == null ) globals = new HashMap();
      for ( Object[] use : tokenUses ) {
        String token = (String) use[3];
        if ( tokenDeclared(token, (String) use[2], extendsOf, mixinsOf, tokensOf, globals) ) continue;
        // After the class chain and CSSTokens.js, because a journal row is
        // the weakest kind of declaration the audit knows: no ColorToken-ness,
        // only a name, and for a bare name no class either.
        if ( journalDeclares(journalTokens, token, (String) use[2]) ) continue;
        String near = didYouMean(token, globals.keySet());
        tokenFailures.add(use[0]+":"+use[1]+" - unknown CSS token '$"+token+"'"+
          ( use[2] == null ? "" : " in "+use[2] )+"."+
          ( near == null ? "" : " Did you mean '$"+near+"'?" )+
          " Tokens are declared in src/foam/u2/CSSTokens.js or in the class' cssTokens:" );
      }
    } catch ( IOException e ) {
      logger.error(e);
    } finally {
      String summary = "processed "+processed.intValue()+ " .js files, "+blocks.intValue()+" css blocks, "+
        tokenUses.size()+" token uses, "+journalTokens.size()+" journal tokens";
      int found = syntaxFailures.size() + colourFailures.size() + fontFailures.size() + tokenFailures.size();
      if ( found > 0 ) {
        // Printed before any failure line: Script.output keeps only the first
        // MAX_OUTPUT_CHARS, so the counts have to lead to survive a cut. The
        // FAILURE: prefix is what makes the test report show the line
        // (TestRunnerScript lists only SUCCESS:/FAILURE: lines); print() does
        // not add it to getFailed().
        print("FAILURE: summary - " + summary + "; failures: " +
          syntaxFailures.size() + " CSS syntax, " + colourFailures.size() + " colour, " +
          fontFailures.size() + " font, " + tokenFailures.size() + " unknown token");
      }
      report(syntaxFailures, "CSS syntax");
      report(colourFailures, "colour");
      report(fontFailures,   "font");
      report(tokenFailures,  "unknown token");

      checkJournalReader();

      if ( getFailed() == 0 ) {
        test(true, summary);
      }
    }
    `
    }
  ]
});
