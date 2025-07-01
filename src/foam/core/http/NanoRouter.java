/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.box.Box;
import foam.box.Skeleton;
import foam.lang.*;
import foam.dao.AbstractSink;
import foam.dao.DAO;
import foam.dao.ProxyDAO;
import foam.dao.SessionDAOSkeleton;
import foam.core.COREService;
import foam.core.boot.CSpec;
import foam.core.boot.CSpecAware;
import foam.core.logger.Logger;
import foam.core.logger.StdoutLogger;
import foam.core.logger.PrefixLogger;
import foam.core.pm.PM;
import foam.core.pm.PMWebAgent;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Top-Level Router Servlet.
 * Routes servlet requests based on CSpecDAO configuration.
 * Services can be exported as either Box Skeletons or as WebAgents/Servlets.
 * WebAgents require the service.run.<nspecname> permission.
 */
public class NanoRouter
  extends    HttpServlet
  implements COREService, ContextAware
{
  protected X x_;

  protected Map<String, WebAgent> handlerMap_ = new ConcurrentHashMap<>();
  protected DAO cSpecDAO_;

  @Override
  public void init(jakarta.servlet.ServletConfig config) throws jakarta.servlet.ServletException {
    Object x = config.getServletContext().getAttribute("X");
    if ( x != null && x instanceof foam.lang.X ) x_ = (foam.lang.X) x;

    cSpecDAO_ = (DAO) x_.get("cSpecDAO");
    cSpecDAO_.listen(new AbstractSink() {
      @Override
      public void put(Object obj, Detachable sub) {
        CSpec sp = (CSpec) obj;
        handlerMap_.remove(sp.getName());
      }
    }, null);

    super.init(config);
  }

  @Override
  protected void service(final HttpServletRequest req, final HttpServletResponse resp)
    throws ServletException, IOException
  {
    String   path       = req.getRequestURI();
    String[] urlParams  = path.split("/");
    String   serviceKey = urlParams[2];
    CSpec    spec       = (CSpec) cSpecDAO_.find(serviceKey);
    Logger   logger     = StdoutLogger.instance();
    PM       pm         = PM.create(getX(), "NanoRouter", serviceKey);

    resp.setContentType("text/html");

    // prevent browsers from changing content-type in response
    resp.setHeader("X-Content-Type-Options", "nosniff");
    // do not allow browser to cache response data
    resp.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    // same as cache-control, used for backwards compatibility with HTTP/1.0
    resp.setHeader("Pragma", "no-cache");
    // enable xss filtering to allow browser to sanitize page if xss attack is detected
    resp.setHeader("X-XSS-Protection", "1");
    // protect against clickjacking attacks
    // replaced by CSP frame-ancestors
    // resp.setHeader("X-Frame-Options", "SAMEORIGIN");

    try {
      if ( spec == null ) {
        logger.warning("Service not found", serviceKey);
        resp.sendError(resp.SC_NOT_FOUND, "No service found for: " + serviceKey);
        return;
      }
      if ( ! spec.getEnabled() ) {
        logger.info("Service disabled", serviceKey);
        resp.sendError(resp.SC_NOT_FOUND, "No service found for: " + serviceKey);
        return;
      }

      // XLocator could be used by the factory of transient properties during
      // replay of DAO services.
      XLocator.set(getX());
      WebAgent agent = getWebAgent(spec);
      if ( agent == null ) {
        logger.warning("Service not found", serviceKey);
        resp.sendError(resp.SC_NOT_FOUND, "No service found for: " + serviceKey);
      } else {
        X requestContext = getX()
          .put(HttpServletRequest.class, req)
          .put(HttpServletResponse.class, resp)
          .putFactory(PrintWriter.class, new XFactory() {
            @Override
            public Object create(X x) {
              try {
                return resp.getWriter();
              } catch (IOException e) {
                return null;
              }
            }
          })
          .put("logger", new PrefixLogger(new Object[] { "[Service]", spec.getName() }, (Logger) getX().get("logger")))
          .put(CSpec.class, spec);
        agent.execute(requestContext);
      }
    } catch (Throwable t) {
      logger.error("Service", serviceKey, path, t);
      throw t;
    } finally {
      XLocator.set(null);
      if ( ! serviceKey.equals("static") ) pm.log(x_);
    }
  }

  protected WebAgent getWebAgent(CSpec spec) {
    if ( spec == null ) return null;

    synchronized ( spec.getName().intern() ) {
      if ( ! handlerMap_.containsKey(spec.getName()) ) {
        handlerMap_.put(spec.getName(), createWebAgent(spec));
      }
    }
    return handlerMap_.get(spec.getName());
  }

  protected WebAgent createWebAgent(CSpec spec) {
    Logger logger = (Logger) getX().get("logger");
    logger.debug(this.getClass().getSimpleName(), "createWebAgent", spec.getName());
    if ( spec.getServe() ) {
      try {
        Class cls = spec.getBoxClass() != null && spec.getBoxClass().length() > 0 ?
          Class.forName(spec.getBoxClass()) :
          SessionDAOSkeleton.class ;
        Skeleton skeleton = (Skeleton) cls.newInstance();

        // TODO: create using Context, which should do this automatically
        if ( skeleton instanceof ContextAware ) ((ContextAware) skeleton).setX(getX());

        skeleton.setDelegateFactory(getX().getFactory(getX(), spec.getName()));

        WebAgent agent = getAgent(new foam.box.KeepAliveServerBox((Box)skeleton), spec);

        logger.debug(this.getClass().getSimpleName(), "createWebAgent.serve", spec.getName(), "service");

        return agent;
      } catch (IllegalAccessException | InstantiationException | ClassNotFoundException ex) {
        ex.printStackTrace();
        ((Logger) getX().get("logger")).error("Unable to create NSPec servlet: " + spec.getName());
      }
    } else {
      Object service = getX().get(spec.getName());

      if ( service instanceof WebAgent ) {
        WebAgent agent = (WebAgent) service;

        SendErrorHandler sendErrorHandler = null;
        if ( service instanceof SendErrorHandler )
          sendErrorHandler = (SendErrorHandler) service;

        if ( spec.getParameters() ) {
          agent = new HttpParametersWebAgent(agent);
        }

        if ( spec.getPm() ) {
          agent = new PMWebAgent(agent.getClass(), spec.getName(), agent);
        }

        //
        // NOTE: Authentication must be last as HttpParametersWebAgent will consume the authentication parameters.
        //
        if ( spec.getAuthenticate() ) {
          agent = new AuthWebAgent("service.run." + spec.getName(), agent, sendErrorHandler);
        }

        logger.debug(this.getClass().getSimpleName(), "createWebAgent.WebAgent", spec.getName(), "webAgent");

        return agent;
      } else {
        logger.error(this.getClass(), spec.getName() + " does not have a WebAgent.");
      }
    }

    return null;
  }

  protected WebAgent getAgent(Box skeleton, CSpec spec) {
    return new ServiceWebAgent(skeleton, spec.getAuthenticate());
  }

  @Override
  public void start() {
  }

  @Override
  public X getX() {
    return x_;
  }

  @Override
  public void setX(X x) {
    x_ = x;
  }
}
