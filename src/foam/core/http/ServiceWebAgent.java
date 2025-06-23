/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.core.app.Mode;
import foam.box.Box;
import foam.box.SessionServerBox;
import foam.lang.FObject;
import foam.lang.ProxyX;
import foam.lang.X;
import foam.lib.json.ExprParser;
import foam.lib.json.JSONParser;
import foam.lib.parse.*;
import foam.core.app.AppConfig;
import foam.core.jetty.HttpServer;
import foam.core.jetty.HttpServer;
import foam.core.logger.Logger;
import foam.core.servlet.VirtualHostRoutingServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.net.URL;

@SuppressWarnings("serial")
/**
 * A WebAgent which receives HTTP requests and converts them into box messages
 * which can be send to a supplied Skeleton Box to be demarshalled and converted
 * into method calls for that Skeleton's service.
 **/
public class ServiceWebAgent
  implements WebAgent
{
  public static final int BUFFER_SIZE = 4096;

  protected static ThreadLocal<StringBuilder> sb = new ThreadLocal<StringBuilder>() {
    @Override
    protected StringBuilder initialValue() {
      return new StringBuilder();
    }

    @Override
    public StringBuilder get() {
      StringBuilder b = super.get();
      b.setLength(0);
      return b;
    }
  };

  protected Box     skeleton_;
  protected boolean authenticate_;

  public ServiceWebAgent(Box skeleton, boolean authenticate) {
    skeleton_     = skeleton;
    authenticate_ = authenticate;
  }

  public Box getSkeletonBox() {
    return skeleton_;
  }

  public Boolean getAuthenticate() {
    return authenticate_;
  }

  public void execute(X x) {
    try {
      HttpServletRequest  req            = x.get(HttpServletRequest.class);
      HttpServletResponse resp           = x.get(HttpServletResponse.class);
      PrintWriter         out            = x.get(PrintWriter.class);
      BufferedReader      reader         = req.getReader();
      X                   requestContext = x.put("httpRequest", req).put("httpResponse", resp);
      Logger              logger         = (Logger) x.get("logger");
      HttpServer          http           = (HttpServer) x.get("http");

      if ( ((AppConfig) x.get("appConfig")).getMode() != Mode.PRODUCTION ) {
        resp.setHeader("Access-Control-Allow-Origin", "*");
      } else if ( ! foam.util.SafetyUtil.isEmpty(req.getHeader("Origin")) && ! "null".equals(req.getHeader("Origin")) ) {
        URL url = new URL(req.getHeader("Origin"));
        if ( http.containsHostDomain(url.getHost()) )
          resp.setHeader("Access-Control-Allow-Origin", req.getHeader("Origin"));
      }

      if ( req.getMethod() == "OPTIONS" ) {
        resp.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, POST, PUT");
        resp.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Cache-Control, Origin, Pragma");
        resp.setStatus(resp.SC_OK);
        out.flush();
        return;
      }

      int read   = 0;
      int count  = 0;
      int length = req.getContentLength();

      StringBuilder builder = sb.get();
      char[] cbuffer = new char[BUFFER_SIZE];
      while ( ( read = reader.read(cbuffer, 0, BUFFER_SIZE)) != -1 && count < length ) {
        builder.append(cbuffer, 0, read);
        count += read;
      }

      String str = builder.toString();

      FObject result;
      try {
        // logger.debug("parseString", builder.toString());
        result = requestContext.create(JSONParser.class).parseString(str);
      } catch (RuntimeException t) {
        try {
          String message = getParsingError(x, builder.toString());
          logger.error("Unable to parse", message, "input", str);
        } catch (RuntimeException r) {
          // noop
          logger.error("Unable to parse", t.getMessage(), "input", str, t);
        }
        resp.setStatus(resp.SC_BAD_REQUEST);
        out.flush();
        return;
      }

      if ( result == null ) {
        resp.setStatus(resp.SC_BAD_REQUEST);
        String message = getParsingError(x, builder.toString());
        logger.error("Unable to parse", message, "input", str);
        out.flush();
        return;
      }

      if ( ! ( result instanceof foam.box.Envelope ) ) {
        resp.setStatus(resp.SC_BAD_REQUEST);
        logger.error("Expected instance of foam.box.Envelope");
        out.print("Expected instance of foam.box.Envelope");
        out.flush();
        return;
      }

      str = null; // free memory

      SessionServerBox.send(x, skeleton_, authenticate_, (foam.box.Envelope)result);
    } catch (java.io.IOException t) {
      throw new foam.lang.FOAMException(t.getMessage(), t);
    }
  }

  /**
   * Gets the result of a failing parsing of a buffer
   * @param buffer the buffer that failed to be parsed
   * @return the error message
   */
  protected String getParsingError(X x, String buffer) {
    Parser        parser = ExprParser.instance();
    PStream       ps     = new StringPStream();
    ParserContext psx    = new ParserContextImpl();

    ((StringPStream) ps).setString(buffer);
    psx.set("X", x == null ? new ProxyX() : x);

    ErrorReportingPStream eps = new ErrorReportingPStream(ps);
    ps = eps.apply(parser, psx);
    return eps.getMessage();
  }
}
