/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ai.dataset;

import foam.lang.X;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

public class FileCrawler extends AbstractFileCrawler {

  public FileCrawler() {}
  public FileCrawler(X x) { super(x); }

  @Override public foam.lang.ClassInfo getClassInfo()    { return foam.lang.ClassInfoImpl.forClass(getClass()); }
  public static foam.lang.ClassInfo    getOwnClassInfo() { return foam.lang.ClassInfoImpl.forClass(FileCrawler.class); }

  @Override
  public foam.lang.FObject fclone() {
    FileCrawler clone = new FileCrawler(getX());
    clone.copyFrom(this);
    return clone;
  }

  @Override
  public List collect(X x) {
    List<Path> paths = new ArrayList<>();
    for ( String rootPath : getSourcePaths() ) {
      Path root = Paths.get(rootPath);
      if ( ! Files.isDirectory(root) ) {
        System.err.println("[FileCrawler] Not a directory, skipping: " + rootPath);
        continue;
      }
      try ( Stream<Path> walk = Files.walk(root) ) {
        walk.filter(Files::isRegularFile)
            .filter(p -> hasExtension_(p))
            .filter(p -> withinSizeLimit_(p))
            .forEach(paths::add);
      } catch ( IOException e ) {
        System.err.println("[FileCrawler] Walk failed for " + rootPath + ": " + e.getMessage());
      }
    }

    List<String> items   = new ArrayList<>();
    List<Path>   limited = ( getMaxFiles() > 0 && paths.size() > getMaxFiles() )
      ? paths.subList(0, getMaxFiles())
      : paths;
    for ( Path p : limited ) items.add(p.toString());
    return items;
  }

  @Override
  public String fetch(X x, String item) {
    try {
      return Files.readString(Paths.get(item), StandardCharsets.UTF_8);
    } catch ( IOException e ) {
      System.err.println("[FileCrawler] Cannot read " + item + ": " + e.getMessage());
      return null;
    }
  }

  protected boolean hasExtension_(Path p) {
    String name = p.getFileName().toString();
    for ( String ext : getFileExtensions() ) {
      if ( name.endsWith(ext) ) return true;
    }
    return false;
  }

  protected boolean withinSizeLimit_(Path p) {
    long limit = getMaxFileSize();
    if ( limit <= 0 ) return true;
    try {
      return Files.size(p) <= limit;
    } catch ( IOException e ) {
      return true;
    }
  }
}
