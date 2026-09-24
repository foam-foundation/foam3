/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ai.vector;

import foam.lang.X;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public class MarkdownChunkerServiceImpl extends MarkdownChunkerService {

  public MarkdownChunkerServiceImpl(X x) { setX(x); }

  @Override
  public String[] chunk(X x, String source) {
    if ( getSourceType() == SourceType.FILE ) {
      try {
        source = Files.readString(Paths.get(source));
      } catch ( IOException e ) {
        throw new RuntimeException("Failed to read file: " + source, e);
      }
    }
    List<String> result = new ArrayList<>();
    String[] lines  = source.split("\n", -1);
    String[] crumbs = new String[7];
    int      depth  = 0;
    var      buf    = new StringBuilder();

    for ( String line : lines ) {
      int level = 0;
      while ( level < line.length() && line.charAt(level) == '#' ) level++;
      boolean isHeading = level > 0 && level < line.length() && line.charAt(level) == ' ';

      if ( isHeading ) {
        flush(result, buf, crumbs, depth);
        buf.setLength(0);
        crumbs[level - 1] = line.substring(level + 1).trim();
        for ( int k = level; k < 7; k++ ) crumbs[k] = null;
        depth = level;
        continue;
      }

      buf.append(line).append('\n');

      if ( buf.length() > getMaxChunkChars() ) {
        String s     = buf.toString();
        int    split = s.lastIndexOf("\n\n", getMaxChunkChars());
        if ( split > 0 ) {
          addChunk(result, s.substring(0, split), crumbs, depth);
          buf.setLength(0);
          buf.append(s.substring(split));
        } else {
          flush(result, buf, crumbs, depth);
          buf.setLength(0);
        }
      }
    }
    flush(result, buf, crumbs, depth);
    return result.toArray(new String[0]);
  }

  private void flush(List<String> result, StringBuilder buf, String[] crumbs, int depth) {
    if ( buf.length() > 0 && !buf.toString().isBlank() )
      addChunk(result, buf.toString(), crumbs, depth);
  }

  private void addChunk(List<String> result, String text, String[] crumbs, int depth) {
    String clean = stripMarkdown(text).strip();
    if ( clean.isEmpty() ) return;
    String crumb = buildCrumb(crumbs, depth);
    result.add(crumb.isEmpty() ? clean : crumb + "\n\n" + clean);
  }

  private String buildCrumb(String[] crumbs, int depth) {
    var sb = new StringBuilder();
    for ( int i = 0; i < depth; i++ ) {
      if ( crumbs[i] != null ) {
        if ( sb.length() > 0 ) sb.append(" > ");
        sb.append(crumbs[i]);
      }
    }
    return sb.toString();
  }

  private String stripMarkdown(String text) {
    String s = text;
    s = s.replaceAll("(?m)^#+ ?",  "");
    s = s.replaceAll("(?m)^> ?",   "");
    s = s.replace("**", "").replace("__", "");
    s = s.replace("`", "");
    s = s.replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", "");
    s = s.replaceAll("\\[([^\\]]+)\\]\\([^)]*\\)", "$1");
    return s;
  }
}
