/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.lang.ClassInfo;
import foam.lang.ProxyX;
import foam.lang.EmptyX;
import foam.lang.X;
import foam.lib.parse.ErrorReportingPStream;
import foam.lib.parse.PStream;
import foam.lib.parse.Parser;
import foam.lib.parse.ParserContext;
import foam.lib.parse.ParserContextImpl;
import foam.lib.parse.StringPStream;
import foam.parse.QueryParser;
import foam.mlang.predicate.Predicate;
import foam.mlang.predicate.Nary;
import foam.mlang.MLang;
import foam.core.logger.Logger;
import foam.core.logger.PrefixLogger;
import foam.util.SafetyUtil;

//
// Wrap the common WebAgent use case of QueryParser
// to extract and compile the 'q' (mql) URL query.
// TODO: better error logging and return status, switch to AQL
//
public class WebAgentQueryParser {
  protected QueryParser parser_;

  public WebAgentQueryParser(ClassInfo classInfo) {
    parser_ = new QueryParser(classInfo);
  }

  public Predicate parse(X x, String q)
    throws IllegalArgumentException {

    if ( ! SafetyUtil.isEmpty(q) ) {
      Logger        logger = (Logger) x.get("logger");
      StringPStream sps    = new StringPStream();
      PStream       ps     = sps;
      ParserContext px     = new ParserContextImpl();

      px.set("logger", logger);

      sps.setString(q);
      try {
        ps = parser_.parse(ps, px);
      } catch (RuntimeException e) {
        logger.error(this.getClass().getSimpleName(), "failed to parse q", q, e);
        throw new IllegalArgumentException("failed to parse [" + q + "]: " + e.getMessage(), e);
      }
      if ( ps == null ) {
        String message = getParsingError(x, q);
        logger.error(this.getClass().getSimpleName(), "failed to parse q", q, message);
        throw new IllegalArgumentException("failed to parse [" + q + "]: " + message);
      }

      Predicate pred = (Predicate) ps.value();
      // logger.debug(this.getClass().getSimpleName(), "pred pre", q, pred.getClass(), pred.toString());
      pred = pred.partialEval();

      logger.debug(this.getClass().getSimpleName(), "pred", pred.getClass(), pred.toString());
      return pred;
    }

    return MLang.TRUE;
  }

  /**
   * Gets the result of a failing parsing of a buffer
   * @param buffer the buffer that failed to be parsed
   * @return the error message
   */
  protected String getParsingError(X x, String buffer) {
    PStream       ps  = new StringPStream();
    ParserContext psx = new ParserContextImpl();

    ((StringPStream) ps).setString(buffer);
    psx.set("X", x == null ? new ProxyX() : x);

    ErrorReportingPStream eps = new ErrorReportingPStream(ps);
    ps = parser_.parse(eps, psx);
    return eps.getMessage();
  }
}
