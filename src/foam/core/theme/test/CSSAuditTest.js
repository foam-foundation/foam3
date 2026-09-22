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
  Test for hard coded CSS color and font values.
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

  foam.u2.parse.CSSParser is the CSS grammar the GUI style editor uses. It is a
  js-flagged class and this audit runs on the server (it walks the filesystem),
  so the grammar below is read from the same shapes but implemented in Java.

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
    'java.util.HashSet',
    'java.util.List',
    'java.util.Set',
    'java.util.concurrent.atomic.AtomicInteger'
  ],

  properties: [
    {
      name: 'skipFoamPaths',
      class: 'List',
      javaFactory: `
      List list = new ArrayList();
      list.add("/build");
      list.add("/demos");
      list.add("/doc");
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

  protected static final String[] COLOUR_FUNCTIONS = {
    "rgb(", "rgba(", "hsl(", "hsla(", "hwb(", "lab(", "lch(", "oklab(", "oklch("
  };

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

  protected static boolean isHexDigit(char c) {
    return ( c >= '0' && c <= '9' ) || ( c >= 'a' && c <= 'f' ) || ( c >= 'A' && c <= 'F' );
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

  // Parses CSS into its declarations, each { property, value, offsetInCSS }.
  // Only a property and value inside a block is a declaration: a selector, an
  // @media condition and a /* comment */ are read and dropped, which is what
  // keeps a colour written in a comment or a JS key named after a CSS property
  // out of the audit.
  protected static List<Object[]> declarations(String css) {
    List<Object[]> out       = new ArrayList();
    int            n         = css.length();
    int            depth     = 0;
    int            paren     = 0;
    int            declStart = -1;
    String         property  = null;
    StringBuilder  buf       = new StringBuilder();
    int            i         = 0;

    while ( i < n ) {
      char c = css.charAt(i);
      if ( c == '/' && i + 1 < n && css.charAt(i + 1) == '*' ) {
        int j = css.indexOf("*/", i + 2);
        i = j < 0 ? n : j + 2;
        continue;
      }
      if ( c == '"' || c == '\\'' ) {
        int j = i + 1;
        while ( j < n && css.charAt(j) != c ) j++;
        buf.append(css, i, Math.min(j + 1, n));
        i = j + 1;
        continue;
      }
      // A value's parentheses hide ':' and ';' - url(data:...;base64,...) and
      // an @media condition both rely on this.
      if ( c == '(' ) { paren++; buf.append(c); i++; continue; }
      if ( c == ')' ) { if ( paren > 0 ) paren--; buf.append(c); i++; continue; }
      if ( paren > 0 ) { buf.append(c); i++; continue; }

      if ( c == '{' ) {
        depth++;
        property  = null;
        declStart = -1;
        buf.setLength(0);
        i++;
        continue;
      }
      if ( c == '}' || c == ';' ) {
        if ( property != null && depth > 0 ) {
          out.add(new Object[] { property, buf.toString(), Integer.valueOf(declStart) });
        }
        if ( c == '}' && depth > 0 ) depth--;
        property  = null;
        declStart = -1;
        buf.setLength(0);
        i++;
        continue;
      }
      if ( c == ':' && property == null ) {
        property = buf.toString().trim();
        buf.setLength(0);
        i++;
        continue;
      }
      if ( property == null && declStart < 0 && ! Character.isWhitespace(c) ) declStart = i;
      buf.append(c);
      i++;
    }
    return out;
  }

  // Removes the parts of a value that carry no hard coded colour: a $token
  // (having one is the point of the audit), a legacy %THEME% placeholder, a
  // var() reference, a url() and !important.
  protected static String strip(String value) {
    StringBuilder sb = new StringBuilder();
    int           n  = value.length();
    int           i  = 0;

    while ( i < n ) {
      char c = value.charAt(i);
      if ( c == '$' ) {
        i++;
        while ( i < n && ( isIdentifierChar(value.charAt(i)) || value.charAt(i) == '-' || value.charAt(i) == '.' ) ) i++;
        sb.append(' ');
        continue;
      }
      if ( c == '%' ) {
        int j = i + 1;
        while ( j < n && ( Character.isLetterOrDigit(value.charAt(j)) || value.charAt(j) == '_' ) ) j++;
        if ( j > i + 1 && j < n && value.charAt(j) == '%' ) {
          i = j + 1;
          sb.append(' ');
          continue;
        }
      }
      if ( c == '!' ) {
        int j = i + 1;
        while ( j < n && Character.isWhitespace(value.charAt(j)) ) j++;
        if ( value.regionMatches(true, j, "important", 0, 9) ) {
          i = j + 9;
          sb.append(' ');
          continue;
        }
      }
      if ( value.regionMatches(true, i, "var(", 0, 4) || value.regionMatches(true, i, "url(", 0, 4) ) {
        int j = i + 4;
        int d = 1;
        while ( j < n && d > 0 ) {
          char e = value.charAt(j);
          if ( e == '(' ) d++;
          else if ( e == ')' ) d--;
          j++;
        }
        i = j;
        sb.append(' ');
        continue;
      }
      sb.append(c);
      i++;
    }
    return sb.toString().trim();
  }

  protected static boolean hasHexColour(String value) {
    for ( int i = 0 ; i < value.length() ; i++ ) {
      if ( value.charAt(i) != '#' ) continue;
      int j = i + 1;
      while ( j < value.length() && isHexDigit(value.charAt(j)) ) j++;
      int len = j - i - 1;
      if ( len == 3 || len == 4 || len == 6 || len == 8 ) return true;
    }
    return false;
  }

  protected static boolean hasColourLiteral(String value) {
    if ( hasHexColour(value) ) return true;
    String lower = value.toLowerCase();
    for ( String fn : COLOUR_FUNCTIONS ) {
      if ( lower.contains(fn) ) return true;
    }
    int i = 0;
    int n = lower.length();
    while ( i < n ) {
      if ( ! Character.isLetter(lower.charAt(i)) ) { i++; continue; }
      int j = i;
      while ( j < n && Character.isLetter(lower.charAt(j)) ) j++;
      if ( NAMED_COLOURS.contains(lower.substring(i, j)) ) return true;
      i = j;
    }
    return false;
  }

  // Returns what is wrong with a declaration, or null when it is clean.
  protected static String violation(String property, String value) {
    String p = property.trim().toLowerCase();
    String v = strip(value);
    if ( SafetyUtil.isEmpty(v) ) return null;
    // A --custom-property is the app's own name for a value, not a CSS colour.
    if ( p.startsWith("--") ) return null;

    boolean colour = p.equals("color") || p.endsWith("-color") ||
                     p.equals("border") || p.startsWith("border-") ||
                     p.equals("background") || p.equals("background-image");
    if ( colour ) {
      return hasColourLiteral(v) ? "hard coded colour" : null;
    }
    if ( p.equals("font") || p.equals("font-weight") ) {
      return FONT_KEYWORDS.contains(v.toLowerCase()) ? null : "hard coded font value";
    }
    return null;
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
    boolean skip = false;
    for ( String p : (List<String>) getSkipFoamPaths() ) {
      if ( parent.contains(p) ) {
        skip = true;
        break;
      }
    }
    if ( ! skip ) {
      for ( String p : (List<String>) getSkipAppPaths() ) {
        if ( parent.contains(p) ) {
          skip = true;
          break;
        }
      }
    }
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

    if ( ! path.toString().endsWith(".js") )
      return FileVisitResult.CONTINUE;
    processed.incrementAndGet();
    String relativePath = path.toString().substring(projectHome.length()+1);
    logger.info("processing", relativePath);

    try {
      String src = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
      for ( Object[] block : extractCSS(src) ) {
        blocks.incrementAndGet();
        String css  = (String) block[0];
        int    base = ((Integer) block[1]).intValue();
        for ( Object[] decl : declarations(css) ) {
          String property = (String) decl[0];
          String value    = ((String) decl[1]).trim();
          String problem  = violation(property, value);
          if ( problem == null ) {
            logger.info("ok", property, value);
            continue;
          }
          int line = lineOf(src, base + ((Integer) decl[2]).intValue());
          test ( false, relativePath+":"+line+" - "+problem+" "+property+": "+value );
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
    } catch ( IOException e ) {
      logger.error(e);
    } finally {
      if ( getFailed() == 0 ) {
        test(true, "procesed "+processed.intValue()+ " .js files, "+blocks.intValue()+" css blocks");
      }
    }
    `
    }
  ]
});
