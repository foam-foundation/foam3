/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.lang.*;
import java.io.PrintWriter;

/** WebAgent that displays JVM memory usage statistics. */
public class MemoryWebAgent
  implements WebAgent
{
  static final long MB = 1024 * 1024;

  public MemoryWebAgent() {}

  @Override
  public void execute(X x) {
    PrintWriter out     = x.get(PrintWriter.class);
    Runtime     runtime = Runtime.getRuntime();

    // Two GC calls to improve accuracy of free memory reading
    runtime.gc();
    runtime.gc();

    long total = runtime.totalMemory();
    long free  = runtime.freeMemory();
    long max   = runtime.maxMemory();
    long used  = total - free;
    int  cores = runtime.availableProcessors();

    out.println("""
      <html>
      <head>
        <title>Memory Usage (JVM)</title>
        <style>
          body  { font-family: monospace; background: #eef2f7; padding: 20px; }
          h1    { text-align: center; color: #1a3a5c; margin-bottom: 20px; }
          table { border-collapse: collapse; width: 100%%; max-width: 500px;
                  margin: 0 auto 20px auto; }
          th    { background: #2a6496; color: #fff; padding: 6px 10px;
                  text-align: left; border: 1px solid #1e4f78; }
          td    { padding: 4px 10px; border: 1px solid #c2d3e4; }
          td:first-child  { width: 220px; color: #1a3a5c; font-weight: bold; }
          tr:nth-child(even) { background: #dce8f3; }
          tr:nth-child(odd)  { background: #f0f5fb; }
        </style>
      </head>
      <body>
      <h1>Memory Usage (JVM)</h1>
      <table>
        <tr><th>Metric</th><th>MB</th><th>Bytes</th></tr>
        <tr><td>Total</td><td>%d</td><td>%,d</td></tr>
        <tr><td>Used</td><td>%d</td><td>%,d</td></tr>
        <tr><td>Free</td><td>%d</td><td>%,d</td></tr>
        <tr><td>Max</td><td>%d</td><td>%,d</td></tr>
        <tr><td>Available Processors</td><td colspan="2">%d</td></tr>
      </table>
      </body></html>
      """.formatted(
        total / MB, total,
        used  / MB, used,
        free  / MB, free,
        max   / MB, max,
        cores
      ));
  }
}
