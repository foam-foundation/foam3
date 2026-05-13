/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.core.session.Session;
import foam.lang.VirtualThreadAgency;
import foam.lang.X;
import jakarta.servlet.http.HttpServletRequest;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** WebAgent that displays platform and virtual thread information. */
public class ThreadsWebAgent
  implements WebAgent
{
  public ThreadsWebAgent() {}

  @Override
  public void execute(X x) {
    PrintWriter        out     = x.get(PrintWriter.class);
    HttpServletRequest req     = x.get(HttpServletRequest.class);
    Session            session = x.get(Session.class);
    boolean            showAll = req == null || "y".equals(req.getParameter("showAll"));
    String             id      = req != null ? req.getParameter("id") : null;

    Thread[] threads = collectThreads();

    printPageHeader(out, session, showAll);
    Thread selected = printThreadTable(out, threads, session, showAll, id);
    printSummary(out, threads);
    if ( selected != null ) printStackTrace(out, selected);
    printPageFooter(out);
  }

  // ─── Thread Collection ────────────────────────────────────────────────────────

  /** Combines platform and virtual threads into a single array. */
  Thread[] collectThreads() {
    Set<Thread> platform = Thread.getAllStackTraces().keySet();
    Set<Thread> virtual  = VirtualThreadAgency.getRunningThreads();
    Thread[]    threads  = new Thread[platform.size() + virtual.size() + 10 /* fluctuating */];
    int i = 0;
    for ( Thread t : platform ) threads[i++] = t;
    for ( Thread t : virtual  ) threads[i++] = t;
    return threads;
  }

  // ─── Page Structure ───────────────────────────────────────────────────────────

  void printPageHeader(PrintWriter out, Session session, boolean showAll) {
    out.println("""
      <html>
      <head>
        <title>Threads</title>
        <style>
          body  { font-family: monospace; background: #eef2f7; padding: 6px; }
          h1, h2 { color: #1a3a5c; margin: 4px 0; }
          h1    { text-align: center; }
          a     { color: #2a6496; }
          .meta { text-align: center; margin-bottom: 8px; }
          table { border-collapse: collapse; width: 100%;
                  margin: 0 auto 10px auto; }
          th    { background: #2a6496; color: #fff; padding: 4px 6px;
                  text-align: left; border: 1px solid #1e4f78; }
          td    { padding: 2px 6px; border: 1px solid #c2d3e4;
                  vertical-align: top; word-break: break-word; }
          tr:nth-child(even) { background: #dce8f3; }
          tr:nth-child(odd)  { background: #f0f5fb; }
          tr.selected        { background: #cce0f5 !important; font-weight: bold; }
          tr:hover           { background: #b8d4ee !important; }
          .summary { margin: 0; }
          pre   { background: #f0f5fb; border: 1px solid #c2d3e4; padding: 6px; }
        </style>
      </head>
      <body>
      <h1>Threads</h1>
      """);

    if ( session != null ) {
      boolean next = !showAll;
      out.println("<div class=\"meta\"><a href=\"?" + showAllParam(next) + "sessionId=" + session.getId() + "\">"
        + (showAll ? "Hide parked threads" : "Show parked threads") + "</a></div>");
    }
  }

  void printPageFooter(PrintWriter out) {
    out.println("</body></html>");
  }

  // ─── Thread Table ─────────────────────────────────────────────────────────────

  /**
   * Renders the thread table. Returns the selected thread (if any) so its
   * stack trace can be printed after the summary.
   */
  Thread printThreadTable(PrintWriter out, Thread[] threads, Session session, boolean showAll, String id) {
    Map<Thread.State, Integer> stateCounts  = new HashMap<>();
    Thread                     selected     = null;

    out.println("<table>");
    out.println("<tr><th>Thread Name</th><th style=\"width:10%\">State</th><th>Virtual</th><th>Last Method</th></tr>");

    for ( Thread thread : threads ) {
      if ( thread == null || !thread.isAlive() ) continue;

      boolean isSelected = String.valueOf(thread.threadId()).equals(id);
      if ( isSelected ) selected = thread;

      StackTraceElement[] elements   = thread.getStackTrace();
      String              methodName = resolveMethodName(elements, showAll, isSelected);
      if ( methodName == null ) continue; // parked thread, hidden

      incrementStateCount(stateCounts, thread.getState());

      out.println(isSelected ? "<tr class=\"selected\">" : "<tr>");
      printThreadNameCell(out, thread, session, showAll, isSelected);
      out.println("<td>" + thread.getState() + "</td>");
      out.println("<td>" + (thread.isVirtual() ? "yes" : "no") + "</td>");
      out.println("<td>" + methodName + "</td>");
      out.println("</tr>");
    }

    out.println("</table>");
    return selected;
  }

  void printThreadNameCell(PrintWriter out, Thread thread, Session session, boolean showAll, boolean isSelected) {
    String sessionPart = session != null ? "&sessionId=" + session.getId() : "";
    String href = "threads?" + showAllParam(showAll) + "id=" + thread.threadId() + sessionPart;
    out.println("<td>");
    if ( isSelected ) out.print("<b>&gt;&gt; ");
    out.print("<a href=\"" + href + "\">" + thread + "</a>");
    if ( isSelected ) out.print("</b>");
    out.println("</td>");
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────

  void printSummary(PrintWriter out, Thread[] threads) {
    int total   = (int) java.util.Arrays.stream(threads).filter(t -> t != null && t.isAlive()).count();
    int parked  = (int) java.util.Arrays.stream(threads).filter(t -> t != null && t.isAlive() && isParked(t)).count();
    int sleeping = (int) java.util.Arrays.stream(threads).filter(t -> t != null && t.isAlive() && isSleeping(t)).count();
    int other   = total - parked - sleeping;

    Map<Thread.State, Long> stateCounts = java.util.Arrays.stream(threads)
      .filter(t -> t != null && t.isAlive())
      .collect(Collectors.groupingBy(Thread::getState, Collectors.counting()));

    out.println("<div class=\"summary\">");
    out.println("<h2>Summary</h2>");
    out.printf("<p>Total: %d &nbsp;|&nbsp; Parked: %d &nbsp;|&nbsp; Sleeping: %d &nbsp;|&nbsp; Other: %d</p>%n",
               total, parked, sleeping, other);
    out.println("<p>" + stateCounts.entrySet().stream()
      .map(e -> e.getKey() + ": " + e.getValue())
      .collect(Collectors.joining(" &nbsp;|&nbsp; ")) + "</p>");
    out.println("</div>");
  }

  // ─── Stack Trace ─────────────────────────────────────────────────────────────

  void printStackTrace(PrintWriter out, Thread thread) {
    out.println("<div class=\"summary\"><h2>Stack Trace</h2>");
    out.println("<b>Thread: " + thread.getName() + "</b></div>");

    StackTraceElement[] elements = thread.getStackTrace();
    out.println("<pre>");
    if ( elements.length > 0 ) {
      for ( StackTraceElement el : elements ) out.println(el);
    } else {
      out.println("Thread has not started, is not yet scheduled, or has terminated.");
    }
    out.println("</pre>");
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  /**
   * Determines the display method name for a thread.
   * Returns null if the thread is parked and should be hidden.
   */
  String resolveMethodName(StackTraceElement[] elements, boolean showAll, boolean isSelected) {
    if ( elements.length == 0 ) return "Unscheduled";
    String top = elements[0].getMethodName();
    if ( "park".equals(top) ) {
      return (showAll || isSelected) ? "park" : null;
    }
    return getMethodName(elements);
  }

  /**
   * Returns the first foam.* stack frame, appended with the top non-foam
   * frame for context, or just the top frame if no foam frame is found.
   */
  String getMethodName(StackTraceElement[] elements) {
    if ( elements.length == 0 ) return "Unscheduled";
    String top = stripModule(elements[0].toString());
    for ( StackTraceElement el : elements ) {
      String name = stripModule(el.toString());
      if ( name.startsWith("foam") ) {
        return top.startsWith("foam") ? name : name + "..." + top;
      }
    }
    return top;
  }

  /** Strips the Java module prefix (e.g. "java.base/") from a stack frame string. */
  String stripModule(String s) {
    return s.substring(s.lastIndexOf('/') + 1);
  }

  void incrementStateCount(Map<Thread.State, Integer> map, Thread.State state) {
    map.merge(state, 1, Integer::sum);
  }

  boolean isParked(Thread t) {
    StackTraceElement[] els = t.getStackTrace();
    return els.length > 0 && "park".equals(els[0].getMethodName());
  }

  boolean isSleeping(Thread t) {
    StackTraceElement[] els = t.getStackTrace();
    return els.length > 0 && "sleep".equals(els[0].getMethodName());
  }

  String showAllParam(boolean value) {
    return value ? "showAll=y&" : "";
  }
}
