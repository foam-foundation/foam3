/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.dig;

import foam.lang.FOAMException;
import foam.lang.FObject;
import foam.lang.X;
import foam.dao.DAO;
import foam.lib.*;
import foam.lib.csv.CSVOutputter;
import foam.lib.json.JSONParser;
import foam.lib.json.Outputter;
import foam.lib.json.OutputterMode;
import foam.core.dig.exception.DigErrorMessage;
import foam.core.dig.format.*;
import foam.core.http.Format;
import java.io.PrintWriter;
import jakarta.servlet.http.HttpServletResponse;

/**
 * DigUtil contains static utility methods for working with Dig and Sugar.
 */
public class DigUtil {
  /**
   * Output DigErrorMessage object to HTTP response.
   *
   * @param x The context.
   * @param error The error to output.
   * @param format The format of the output.
   */
  public static void outputException(X x, DigErrorMessage error, String format) {
    outputFObject(x, error, Integer.parseInt(error.getStatus()), lookupFormat(x, format));
  }

  public static void outputException(X x, DigErrorMessage error, Format format) {
    outputFObject(x, error, Integer.parseInt(error.getStatus()), format);
  }

  public static void outputFOAMException(X x, FOAMException foamException, int status, String format) {
    outputFObject(x, foamException, status, lookupFormat(x, format));
  }

  public static void outputFOAMException(X x, FOAMException foamException, int status, Format format) {
    outputFObject(x, foamException, status, format);
  }

  public static void outputFObject(X x, FOAMException error, int status, String format) {
    outputFObject(x, error, status, lookupFormat(x, format));
  }

  public static void outputFObject(X x, FOAMException error, int status, Format format) {
    HttpServletResponse resp = x.get(HttpServletResponse.class);
    PrintWriter         out  = x.get(PrintWriter.class);

    resp.setStatus(status);

    error.setExceptionMessage(error.getTranslation());
    outputFObject(x, error, format);
  }

  public static void outputFObject(X x, FObject object, String format) {
    outputFObject(x, object, lookupFormat(x, format));
  }

  private static Format lookupFormat(X x, String id) {
    DAO dao = (DAO) x.get("digFormatDAO");
    DigFormat digFormat = (DigFormat) dao.find(id != null ? id.toUpperCase() : null);
    if ( digFormat == null ) {
      throw new RuntimeException("Invalid format: " + id);
    }
    return digFormat.getFormat();
  }

  public static void outputFObject(X x, FObject object, Format format) {
    HttpServletResponse resp = x.get(HttpServletResponse.class);
    PrintWriter         out  = x.get(PrintWriter.class);

    if ( format == Format.JSON ) {
      //output object in json format
      resp.setContentType("application/json");

      JSONParser jsonParser = new JSONParser();
      jsonParser.setX(x);
      foam.lib.json.Outputter outputterJson = new foam.lib.json.Outputter(x)
        .setPropertyPredicate(
          new foam.lib.AndPropertyPredicate(x,
            new foam.lib.PropertyPredicate[] {
              new foam.lib.ExternalPropertyPredicate(),
              new foam.lib.NetworkPropertyPredicate(),
              new foam.lib.PermissionedPropertyPredicate()}));

      outputterJson.setOutputDefaultValues(true);
      outputterJson.setOutputClassNames(true);
      outputterJson.setMultiLine(true);
      outputterJson.output(object);
      out.println(outputterJson.toString());

    } else if ( format == Format.XML )  {
      //output object in xml format
      resp.setContentType("application/xml");

      foam.lib.xml.Outputter outputterXml = new foam.lib.xml.Outputter(x, OutputterMode.NETWORK);
      outputterXml.output(object);
      out.println(outputterXml.toString());

    } else if ( format == Format.CSV )  {
      //output object in csv format
      resp.setContentType("text/csv");

      CSVOutputter outputterCsv = new foam.lib.csv.CSVOutputterImpl.Builder(x).build();
      outputterCsv.outputFObject(x, object);
      out.println(outputterCsv.toString());

    } else if ( format == Format.HTML ) {
      //output object in html format
      resp.setContentType("text/html");

      foam.lib.html.Outputter outputterHtml = new foam.lib.html.Outputter(OutputterMode.NETWORK);
      outputterHtml.outputStartHtml();
      outputterHtml.outputStartTable();
      outputterHtml.outputHead(object);
      outputterHtml.put(object, null);
      outputterHtml.outputEndTable();
      outputterHtml.outputEndHtml();
      out.println(outputterHtml.toString());
    } else if ( format == Format.JSONJ ) {
      //output object in jsonJ format
      resp.setContentType("application/json");

      JSONParser jsonParser = new JSONParser();
      jsonParser.setX(x);
      foam.lib.json.Outputter outputterJsonJ = new foam.lib.json.Outputter(x)
        .setPropertyPredicate(
          new foam.lib.AndPropertyPredicate(x,
            new foam.lib.PropertyPredicate[] {
              new foam.lib.ExternalPropertyPredicate(),
              new foam.lib.NetworkPropertyPredicate(),
              new foam.lib.PermissionedPropertyPredicate()}));
      outputterJsonJ.setOutputDefaultValues(true);
      outputterJsonJ.setOutputClassNames(true);
      outputterJsonJ.setMultiLine(true);
      outputterJsonJ.outputJSONJFObject(object);
      out.println(outputterJsonJ.toString());
    } else {
      throw new UnsupportedOperationException(
        String.format("Output FObject in %s format is not supported.", format.getName()));
    }
  }
}
