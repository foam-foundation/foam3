/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.app;

import foam.lang.X;
import foam.core.http.WebAgent;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;

/**
 *  Report application version.
 */
public class VersionWebAgent
  implements WebAgent
{
  @Override
  public void execute(X x) {
    PrintWriter          out     = x.get(PrintWriter.class);
    HttpServletResponse response = x.get(HttpServletResponse.class);

    response.setContentType("text/plain");
    response.setStatus(HttpServletResponse.SC_OK);

    String version  = foam.core.app.AppConfig.class.getPackage().getImplementationVersion();
    String revision = foam.core.app.AppConfig.class.getPackage().getSpecificationVersion();

    out.print(version);
    if ( ! foam.util.SafetyUtil.isEmpty(revision) && revision.length() > 2 ) {
      out.print("-"+revision.substring(0, 3));
    }
    out.println("\n");
  }
}
