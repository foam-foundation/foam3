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

    List<MarkdownChunkParser.Section> sections =
      new MarkdownChunkParser(getMaxDepth(), getSourceType() == SourceType.CODE)
        .parseString(source);
    List<String> result = new ArrayList<>();

    for ( MarkdownChunkParser.Section section : sections ) {
      String body = section.payload;
      if ( body.isBlank() ) continue;

      if ( body.length() <= getMaxChunkChars() ) {
        result.add(body);
      } else {
        // section exceeds limit — split on paragraph breaks. Every piece starts with
        // the section's heading: a piece without it ("| Trap | What happens |" under
        // "8. Known traps") is not found by a question that names the section.
        String heading = section.heading;
        if ( ! heading.isEmpty() && body.startsWith(heading) ) body = body.substring(heading.length()).strip();
        String        prefix = heading.isEmpty() ? "" : heading + "\n\n";
        int           room   = getMaxChunkChars() - prefix.length();
        String[]      paras  = body.split("\n\n");
        StringBuilder buf    = new StringBuilder();
        for ( String para : paras ) {
          para = para.strip();
          if ( para.isEmpty() ) continue;
          if ( buf.length() > 0 && buf.length() + para.length() + 2 > room ) {
            result.add(prefix + buf);
            buf.setLength(0);
            buf.append(para);
          } else {
            if ( buf.length() > 0 ) buf.append("\n\n");
            buf.append(para);
          }
        }
        if ( buf.length() > 0 ) result.add(prefix + buf);
      }
    }

    return result.toArray(new String[0]);
  }
}
