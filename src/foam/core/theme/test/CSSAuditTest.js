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
    'java.util.regex.Matcher',
    'java.util.regex.Pattern',
    'java.util.stream.Stream'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
    Logger logger = new PrefixLogger(new Object[] { "CSSAuditTest"}, (Logger) x.get("logger"));
    Pattern pattern = Pattern.compile(".*?(color|font):\\s([a-z#][^\\s]*)");

    String projectHome = System.getProperty("project.home");
    test ( ! SafetyUtil.isEmpty(projectHome), "project.home found "+projectHome );

    try {
      Path start = Paths.get(projectHome);
      Files.walkFileTree(start,
        new FileVisitor<Path>() {
  @Override
  public FileVisitResult preVisitDirectory(Path path, BasicFileAttributes attrs)
    throws IOException {

    File file = path.toFile();
    String name = file.getName();
    if ( name.equals("documents") ||
         name.equals("tools") ||
         name.equals("build") ||
         name.equals("node_modules") ||
         name.startsWith("iso") ||
         name.startsWith(".") ) {
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

    String relativePath = path.toString().substring(projectHome.length()+1);
    logger.info("processing", relativePath);

    try (BufferedReader br = new BufferedReader(new FileReader(path.toFile()))) {
      String line;
      int lineNum = 0;
      while ( (line = br.readLine()) != null ) {
        lineNum += 1;
        Matcher matcher = pattern.matcher(line);
        if ( matcher.find() ) {
          if ( line.contains("style") ) {
            logger.info("ignoring", line);
            continue;
          }
          if ( line.contains("foam.CSS") ) {
            logger.info("ignoring", line);
            continue;
          }

          String property = matcher.group(1);
          String value = matcher.group(2);
          if ( "color".equals(property) ) {
            if ( value.contains("currentColor") ||
                 value.contains("current-color") ||
                 value.contains("important") ||
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
    }
    `
    }
  ]
});
