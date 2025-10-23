/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.csv;

import foam.lib.parse.*;

/**
 * The class parse the CSV normal string base on the CSV string rule
 * The string can not contain '"', '\r', '\n' and the delimiter character
 * eg:
 *  abc123    : legal
 *  ab"e123   : illegal
 *  ab\ne123  : illegal
 *  ab\re123  : illegal
 */
public class CSVNormalStringParser implements Parser {

  private static Parser newlineParser = new CSVNewlineParser();
  private char delimiter_;

  public CSVNormalStringParser() {
    this(',');
  }

  public CSVNormalStringParser(char delimiter) {
    this.delimiter_ = delimiter;
  }

  public PStream parse(PStream ps, ParserContext x) {
    if ( ps == null ) {
      return null;
    }

    // Check if delimiter is set in context, use it if available
    char activeDelimiter = delimiter_;
    if ( x != null && x.get("csvDelimiter") != null ) {
      activeDelimiter = (Character) x.get("csvDelimiter");
    }

    char head;
    StringBuilder sb = builders.get();

    while ( ps.valid() ) {
      head = ps.head();
      if ( head == '\"') {
        return null;
      }
      if ( head == '\\') {
        PStream ps1 = ps;
        if ( ps.apply(newlineParser, x) == null ) {
          sb.append("\\\\");
          ps = ps.tail();
          continue;
        } else {
          return null;
        }
      }
      if ( head == activeDelimiter ) {
        break;
      }
      sb.append(head);
      ps = ps.tail();
    }

    // Empty fields are valid in CSV (e.g., consecutive commas: ,,)
    return ps.setValue(sb.toString());
  }

  protected ThreadLocal<StringBuilder> builders = new ThreadLocal<StringBuilder>() {
    @Override
    protected StringBuilder initialValue() {
      return new StringBuilder();
    }
    @Override
    public StringBuilder get() {
      StringBuilder sb =  super.get();
      sb.setLength(0);
      return sb;
    }
  };
}