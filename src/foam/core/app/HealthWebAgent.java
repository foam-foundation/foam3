/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.app;

import foam.lang.X;
import foam.dao.DAO;
import foam.core.http.WebAgent;
import foam.core.http.Format;
import foam.core.http.HttpParameters;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import foam.lib.json.OutputterMode;
import foam.lib.formatter.FObjectFormatter;
import foam.lib.formatter.JSONFObjectFormatter;
import foam.lib.xml.Outputter;

/**
   Report most current Health
 */
public class HealthWebAgent
  implements WebAgent
{
  @Override
  public void execute(X x) {
    PrintWriter         out      = x.get(PrintWriter.class);
    HttpServletResponse response = x.get(HttpServletResponse.class);
    HttpParameters      p        = x.get(HttpParameters.class);
    Format              format   = (Format) p.get(Format.class);

    Health health = (Health) x.get("Health");
    health.setHeartbeatTime(System.currentTimeMillis());

    Health lastHealth = (Health) ((DAO) x.get("healthDAO")).find(health);

    if ( lastHealth != null ) {
      health.setAddress(lastHealth.getAddress());
    }

    if ( health.getStatus() == HealthStatus.UP ) {
      response.setStatus(HttpServletResponse.SC_OK);
    } else {
      response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
    }

    if ( format == Format.JSON ) {
      JSONFObjectFormatter formatter = new JSONFObjectFormatter();
      formatter.setOutputDefaultValues(true);
      formatter.setOutputClassNames(false);
      formatter.setOutputDefaultClassNames(false);
      formatter.setMultiLine(true);
      formatter.setQuoteKeys(true);
      formatter.setPropertyPredicate(
        new foam.lib.AndPropertyPredicate(x,
        new foam.lib.PropertyPredicate[] {
        new foam.lib.ExternalPropertyPredicate(),
        new foam.lib.PermissionedPropertyPredicate()}));

      formatter.output(health);

      response.setContentType("application/json");
      out.println(formatter.builder().toString());
    } else if( format == Format.XML ) {
      response.setContentType("application/xml");
      Outputter outputter = new Outputter(out, OutputterMode.NETWORK);
      outputter.setOutputDefaultValues(true);
      out.println(outputter.stringify(health));
    } else {
      response.setContentType("text/plain");
      out.println(health.getStatus().getLabel());
    }
  }
}
