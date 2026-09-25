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

    List<MarkdownChunkParser.Section> sections = MarkdownChunkParser.getInstance().parseString(source);
    List<String> result = new ArrayList<>();

    for ( MarkdownChunkParser.Section section : sections ) {
      String body = section.body;
      if ( body.isBlank() ) continue;

      if ( body.length() <= getMaxChunkChars() ) {
        result.add(body);
      } else {
        // section exceeds limit — split on paragraph breaks
        String[]      paras = body.split("\n\n");
        StringBuilder buf   = new StringBuilder();
        for ( String para : paras ) {
          para = para.strip();
          if ( para.isEmpty() ) continue;
          if ( buf.length() > 0 && buf.length() + para.length() + 2 > getMaxChunkChars() ) {
            result.add(buf.toString());
            buf.setLength(0);
            buf.append(para);
          } else {
            if ( buf.length() > 0 ) buf.append("\n\n");
            buf.append(para);
          }
        }
        if ( buf.length() > 0 ) result.add(buf.toString());
      }
    }

    return result.toArray(new String[0]);
  }
}
