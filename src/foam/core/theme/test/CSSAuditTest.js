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

  Java Regex Testing
https://www.regexplanet.com/advanced/java/index.html

  Colour converters
https://www.myfixguide.com/color-converter/ - hex,rgb,hsl, rgba, argb
https://web-toolbox.dev/en/tools/color-converter - hsla

  FOAM Color picker - run from console to open
a = foam.u2.view.ColorEditView.create(); ctrl.stack.set(a);

  TODO: replace regex with CSSParser
  `,

  javaImports: [
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.Logger',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.FileReader',
    'java.io.IOException',
    'java.nio.file.Files',
    'java.nio.file.FileSystem',
    'java.nio.file.FileSystems',
    'java.nio.file.FileVisitOption',
    'java.nio.file.FileVisitor',
    'java.nio.file.FileVisitResult',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.nio.file.SimpleFileVisitor',
    'java.nio.file.attribute.BasicFileAttributes',
    'java.util.ArrayList',
    'java.util.List',
    'java.util.concurrent.atomic.AtomicInteger',
    'java.util.regex.Matcher',
    'java.util.regex.Pattern',
    'java.util.stream.Stream'
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
      list.add("src/foam/core/servlet"); // VirtualHostRoutingServlet

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

  methods: [
    {
      name: 'runTest',
      javaCode: `
    Logger logger = new PrefixLogger(new Object[] { "CSSAuditTest"}, (Logger) x.get("logger"));
    // Group 1: CSS property name.
    // Group 2: optional opening quote (' or ") — empty means the value is unquoted.
    // Group 3: value content (stops at the closing quote / comma / semicolon / etc.).
    // The previously-captured "embedded" group ([;']?) was removed: a quoted
    // property key like 'color': should NOT cause the line to be skipped.
    Pattern pattern = Pattern.compile(".*?(color|font|border|font-weight):\\s*(['\\\"]?)([a-zA-Z0-9#\\s.($_-]*)");
    String projectHome = System.getProperty("project.home");
    if ( SafetyUtil.isEmpty(projectHome) ) {
      test ( false, "project.home found "+projectHome );
      throw new RuntimeException("project.home not found");
    }

    final AtomicInteger processed = new AtomicInteger();

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
    // logger.info("preVisit,relative", parent, name);
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

    try (BufferedReader br = new BufferedReader(new FileReader(path.toFile()))) {
      String line;
      int lineNum = 0;
      while ( (line = br.readLine()) != null ) {
        lineNum += 1;
        Matcher matcher = pattern.matcher(line);
        if ( matcher.find() ) {
          if ( line.contains("foam.CSS") ) {
            logger.info("ignoring", line);
            continue;
          }
          String property  = matcher.group(1);
          String openQuote = matcher.group(2);
          String value     = matcher.group(3);
          boolean isStringLiteral = ! SafetyUtil.isEmpty(openQuote);

          // For unquoted values, distinguish a CSS rule from a JS object entry.
          // A CSS rule terminates with ';' (audit it). A JS object entry
          // terminates with ',', '}' or ')' and the value is therefore a JS
          // variable / expression (skip — not a hardcoded literal).
          if ( ! isStringLiteral ) {
            int valueEnd = matcher.end(3);
            boolean isCssRule = false;
            for ( int i = valueEnd ; i < line.length() ; i++ ) {
              char c = line.charAt(i);
              if ( c == ';' ) { isCssRule = true; break; }
              if ( c == ',' || c == '}' || c == ')' ) break;
            }
            if ( ! isCssRule ) {
              logger.info("ignoring JS variable", line);
              continue;
            }
          }

          if ( SafetyUtil.isEmpty(value) ) {
            // no value content captured (e.g. empty string or interpolation) - skip
            continue;
          }
          // FOAM theme tokens (e.g. '$primary', '$blue500') are valid - skip.
          if ( value.startsWith("$") ) {
            logger.info("ignoring theme token", property, value);
            continue;
          }
          if ( "color".equals(property) ) {
            if ( value.contains("currentColor") ||
                 value.contains("inherit") ||
                 value.contains("none") ||
                 value.contains("transparent") ||
                 value.contains("unset") ||
                 value.contains("var(") ) {
              logger.info("ignoring", property, value);
              continue;
            }
            if ( value.contains(".") ) {
              // enum
              logger.info("ignoring", property, value);
              continue;
            }
          } else if ( "font".equals(property) ) {
            if ( value.contains("inherit") ) {
              logger.info("ignoring", property, value);
              continue;
            }
            if ( value.contains(".") ) {
              // enum
              logger.info("ignoring", property, value);
              continue;
            }
          } else if ( "font-weight".equals(property) ) {
            if ( value.contains("bold") ||
                 value.contains("normal") ||
                 value.contains("px") ||
                 value.contains("unset") ) {
              logger.info("ignoring", property, value);
              continue;
            }
            if ( value.contains(".") ) {
              // enum
              logger.info("ignoring", property, value);
              continue;
            }
          } else if ( "background".equals(property) ) {
            if ( value.contains("none") ||
                 value.contains("transparent") ||
                 value.contains("linear-gradient") ||
                 value.contains("unset") ||
                 value.contains("url(") ) {
              logger.info("ignoring", property, value);
              continue;
            }
            if ( value.contains(".") ) {
              // enum
              logger.info("ignoring", property, value);
              continue;
            }
          } else if ( "border".equals(property) ) {
            if ( value.contains("none") ||
                 value.contains("dashed") ||
                 value.contains("inherit") ||
                 value.contains("pt") ||
                 value.contains("px") ||
                 value.contains("solid") ||
                 value.contains("transparent") ) {
              logger.info("ignoring", property, value);
              continue;
            }
            if ( value.contains(".") ) {
              // enum
              logger.info("ignoring", property, value);
              continue;
            }
          }

          test ( false, relativePath+":"+lineNum+" - "+line);
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
        test(true, "procesed "+processed.intValue()+ " .js files");
      }
    }
    `
    }
  ]
});
