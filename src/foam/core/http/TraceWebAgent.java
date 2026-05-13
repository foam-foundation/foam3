/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.lang.*;
import foam.lib.json.Outputter;
import foam.core.http.HttpParameters;
import foam.core.logger.Logger;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** WebAgent for debugging — renders all request headers, parameters, and cookies as HTML. */
public class TraceWebAgent
  implements WebAgent
{
  // Parameter names whose values should never be echoed back
  private static final java.util.Set<String> REDACTED_PARAMS = java.util.Set.of(
    "password", "sessionid"
  );

  public TraceWebAgent() {}

  @Override
  public void execute(X x) {
    Logger              logger = (Logger) x.get("logger");
    PrintWriter         out    = x.get(PrintWriter.class);
    HttpServletRequest  req    = x.get(HttpServletRequest.class);
    HttpServletResponse resp   = x.get(HttpServletResponse.class);
    HttpParameters      params = x.get(HttpParameters.class);
    Map<String, Object> kv     = new HashMap<>();

    try {
      resp.setContentType("text/html");

      out.println("""
        <html>
        <head>
          <title>Trace</title>
          <style>
            body { font-family: monospace; background: #eef2f7; padding: 20px; }
            h1   { text-align: center; margin-bottom: 4px; color: #1a3a5c; }
            .meta { text-align: center; margin-bottom: 20px; color: #4a6a8a; }
            table { border-collapse: collapse; width: 100%; max-width: 900px;
                    margin: 0 auto 20px auto; }
            th   { background: #2a6496; color: #fff; padding: 6px 10px;
                   text-align: left; border: 1px solid #1e4f78; }
            td   { padding: 4px 10px; border: 1px solid #c2d3e4; vertical-align: top;
                   word-break: break-word; }
            td:first-child { width: 220px; min-width: 220px; color: #1a3a5c; font-weight: bold; }
            tr:nth-child(even) { background: #dce8f3; }
            tr:nth-child(odd)  { background: #f0f5fb; }
            .section-title { max-width: 900px; margin: 0 auto 4px auto;
                             font-weight: bold; color: #2a6496; }
            .no-cookies { max-width: 900px; margin: 0 auto; color: #888; }
          </style>
        </head>
        <body>
        <h1>Trace</h1>
        """);

      out.println("<div class=\"meta\">"
        + req.getMethod() + " &nbsp;|&nbsp; "
        + req.getRequestURI() + " &nbsp;|&nbsp; "
        + req.getProtocol()
        + "</div>");

      printSectionTitle(out, "Headers");
      printHeaders(out, req, kv);
      printSectionTitle(out, "Parameters");
      printParameters(out, req, kv);
      printSectionTitle(out, "WebAgent Parameters");
      printWebAgentParameters(out, params, kv);
      printSectionTitle(out, "Cookies");
      printCookies(out, req);

      out.println("</body></html>");

      logKeyValues(x, logger, kv);

    } catch ( Throwable t ) {
      logger.error(t);
    }
  }

  // ─── Section Renderers ────────────────────────────────────────────────────────

  void printHeaders(PrintWriter out, HttpServletRequest req, Map<String, Object> kv) {
    openTable(out, "Header Name", "Header Value");
    for ( String name : java.util.Collections.list(req.getHeaderNames()) ) {
      String value = req.getHeader(name);
      out.println("<tr><td>" + name + "<td>" + value);
      kv.put(name, value);
    }
    closeTable(out);
  }

  void printParameters(PrintWriter out, HttpServletRequest req, Map<String, Object> kv) {
    openTable(out, "Parameter Name", "Parameter Value");
    for ( String name : java.util.Collections.list(req.getParameterNames()) ) {
      String value = resolveParamValue(name, req.getParameterValues(name));
      out.println("<tr><td>" + name + "<td>" + value);
      kv.put(name, value);
    }
    closeTable(out);
  }

  void printWebAgentParameters(PrintWriter out, HttpParameters params, Map<String, Object> kv) {
    openTable(out, "Parameter Name", "Parameter Value");
    if ( params != null ) {
      String value = params.toString();
      out.println("<tr><td>WebAgent Parameters<td>" + value);
      kv.put("_WebAgentParameters_", value);
    }
    closeTable(out);
  }

  void printCookies(PrintWriter out, HttpServletRequest req) {
    Cookie[] cookies = req.getCookies();
    if ( cookies == null ) {
      out.println("<p class=\"no-cookies\">No cookies present.</p>");
      return;
    }
    openTable(out, "Cookie Name", "Cookie Value");
    for ( Cookie cookie : cookies ) {
      out.println("<tr><td>" + cookie.getName() + "<td>" + cookie.getValue());
    }
    closeTable(out);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  /** Returns the display value for a parameter, redacting sensitive names. */
  String resolveParamValue(String name, String[] values) {
    if ( REDACTED_PARAMS.contains(name.toLowerCase()) ) return "********";
    if ( values == null || values.length == 0 )         return "";
    return values.length == 1 ? values[0] : String.join(" | ", values);
  }

  /** Serializes the collected key/value map to the logger as JSON. */
  void logKeyValues(X x, Logger logger, Map<String, Object> kv) {
    StringWriter sw = new StringWriter();
    new Outputter(x, new PrintWriter(sw)).output(kv);
    logger.info("TraceWebAgent", sw);
  }

  void openTable(PrintWriter out, String col1, String col2) {
    out.println("""
      <table>
      <tr><th>%s</th><th>%s</th></tr>
      """.formatted(col1, col2));
  }

  void closeTable(PrintWriter out) {
    out.println("</table>");
  }

  void printSectionTitle(PrintWriter out, String title) {
    out.println("<div class=\"section-title\">" + title + "</div>");
  }
}
