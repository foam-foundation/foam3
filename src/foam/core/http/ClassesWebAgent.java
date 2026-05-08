/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.lang.*;
import java.io.PrintWriter;

public class ClassesWebAgent
  implements WebAgent
{
  public ClassesWebAgent() {}

  public void execute(X x) {
    final PrintWriter out = x.get(PrintWriter.class);
    out.println("<pre>");
    String classpath = System.getProperty("java.class.path");
    for ( String entry : classpath.split(System.getProperty("path.separator")) ) {
      out.println(entry);
    }
    out.println("</pre>");
  }
}
