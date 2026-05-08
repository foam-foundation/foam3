/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.dig;

import foam.lang.*;
import foam.dao.DAO;
import foam.core.dig.drivers.*;
import foam.core.dig.format.*;
import foam.core.dig.exception.*;
import foam.core.http.*;
import foam.core.logger.Logger;
import foam.core.logger.Loggers;
import foam.core.pm.PM;
import foam.util.SafetyUtil;
import java.io.PrintWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class DigWebAgent extends ContextAwareSupport
  implements WebAgent, SendErrorHandler
{
  public DigWebAgent() {}

  public void execute(X x) {
    HttpServletResponse resp    = x.get(HttpServletResponse.class);
    HttpParameters      p       = x.get(HttpParameters.class);
    Command             command = (Command) p.get(Command.class);
    String              format  = p.getParameter("format");
    Logger              logger  = Loggers.logger(x, this);
    String              daoName = p.getParameter("dao");
    PM                  pm      = PM.create(x, true, getClass().getSimpleName(), p.getParameter("dao"), command.getName(), format);

    logger.debug("command", command, "daoName", daoName, "data", p.get("data"));
    try {
      // Find the operation
      DAO digFormatDAO = (DAO) x.get("digFormatDAO");
      DigFormat digFormat = (DigFormat) digFormatDAO.find(format != null ? format.toUpperCase() : null);
      if ( digFormat == null ) {
        DigErrorMessage error = new ParsingErrorException("UnsupportedFormat");
        DigUtil.outputException(x, error, format);
        return;
      }
      
      DigFormatDriver driver = (DigFormatDriver) x.get(digFormat.getDriverCSpec());
      if ( driver == null ) {
        DigErrorMessage error = new ParsingErrorException("FormatDriverNotFound");
        DigUtil.outputException(x, error, format);
        return;
      }
      logger.debug("driver", digFormat.getDriverCSpec());

      if ( SafetyUtil.isEmpty(daoName) ) {
        DigErrorMessage error = new DAORequiredException();
        DigUtil.outputException(x, error, format);
        logger.error(error);
        return;
      }

      // Execute the command
      switch ( command ) {
        case PUT:
          driver.put(x);
          break;
        case SELECT:
          driver.select(x);
          break;
        case REMOVE:
          driver.remove(x);
          break;
      }
    } catch (DigErrorMessage dem) {
      logger.error(dem);
      DigUtil.outputException(x, dem, format);
      pm.error(x, dem.getMessage());
    } catch (FOAMException fe) {
      logger.error(fe);
      DigUtil.outputFOAMException(x, fe, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, format);
      pm.error(x, fe.getMessage());
    } catch (Throwable t) {
      logger.error(t);
      DigErrorMessage error = new GeneralException(t.getMessage());
      error.setStatus(String.valueOf(HttpServletResponse.SC_INTERNAL_SERVER_ERROR));
      error.setMoreInfo(t.getClass().getName());
      DigUtil.outputException(x, error, format);
      pm.error(x, t.getMessage());
    } finally {
      pm.log(x);
    }
  }

  public void sendError(X x, int status, String message) {
    String defaultMsg;
    switch ( status ) {
      case HttpServletResponse.SC_UNAUTHORIZED:
        defaultMsg = "Unauthorized: login required or session expired.";
        break;
      case HttpServletResponse.SC_FORBIDDEN:
        defaultMsg = "Forbidden: you don’t have permission to access this resource.";
        break;
      case HttpServletResponse.SC_NOT_FOUND:
        defaultMsg = "Not found: the requested resource does not exist.";
        break;
      default:
        defaultMsg = "Request failed with status " + status + ".";
    }
    DigErrorMessage error = new GeneralException(
      foam.util.SafetyUtil.isEmpty(message) ? defaultMsg : message);
    error.setMoreInfo(defaultMsg);
    error.setStatus(String.valueOf(status));
    DigUtil.outputException(x, error, Format.JSON);
  }
}
