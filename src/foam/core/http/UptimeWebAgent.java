/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.lang.X;
import foam.core.boot.Boot;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;

public class UptimeWebAgent
  implements WebAgent
{
  @Override
  public void execute(X x) {
    PrintWriter         out       = x.get(PrintWriter.class);
    HttpServletResponse response  = x.get(HttpServletResponse.class);
    Long                startTime = (Long) x.get(Boot.BOOT_TIME);
    long                gap       = System.currentTimeMillis()-startTime;

    response.setContentType("text/plain");

    out.println(
      gap + "\n\n" +
      "Uptime: \n" +
      "  Days: " + gap / (1000*60*60*24) + "\n" +
      "  Hours: " + (gap % (1000*60*60*24)) / (1000*60*60) + "\n" +
      "  Minutes: "+ (gap % (1000*60*60)) /(1000*60) + "\n" +
      "  Seconds: "+ (gap % (1000*60))/ 1000
    );
  }
}
