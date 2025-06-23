/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.box.socket;

import foam.box.Box;
import foam.box.Envelope;
import foam.box.SessionServerBox;
import foam.box.Skeleton;
import foam.box.socket.SocketWebAgent;
import foam.lang.ContextAware;
import foam.lang.FObject;
import foam.lang.Detachable;
import foam.lang.X;
import foam.lang.ContextAware;
import foam.dao.AbstractSink;
import foam.dao.DAO;
import foam.dao.SessionDAOSkeleton;
import foam.lib.json.JSONParser;
import foam.core.boot.CSpec;
import foam.core.boot.CSpecAware;
import foam.core.http.NanoRouter;
import foam.core.http.WebAgent;
import foam.core.logger.PrefixLogger;
import foam.core.logger.Logger;
import foam.core.om.OMLogger;
import foam.core.pm.PM;
import foam.core.pm.PMWebAgent;
import foam.core.COREService;
import java.io.IOException;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Handle socket receive events.
 * Determine the appropriate SocketWebAgent and route them
 * through the SessionServerBox
 */
public class SocketRouter
  extends NanoRouter
{
  protected Logger logger_;

  public SocketRouter(X x) {
    setX(x);
    cSpecDAO_ = (DAO) getX().get("cSpecDAO");
    cSpecDAO_.listen( new AbstractSink() {
      @Override
      public void put(Object obj, Detachable sub) {
        CSpec sp = (CSpec) obj;
        handlerMap_.remove(sp.getName());
      }
    }, null);

    logger_ = new PrefixLogger(new Object[] {
        this.getClass().getSimpleName(),
      }, (Logger) getX().get("logger"));
  }

  @Override
  public X getX() {
    return x_;
  }

  @Override
  public void setX(X x) {
    x_ = x;
  }

  public void service(Envelope envelope)
    throws IOException {
    PM pm = null;
    String serviceKey = null;
    Object message = envelope.getMessage();
    
    if ( envelope.getMessage() instanceof foam.box.SubBoxMessage subBoxMessage ) {
      serviceKey = subBoxMessage.getName();
      message = subBoxMessage.getMessage();
    }
    
    if ( ! serviceKey.equals("static") ) {
      pm = PM.create(getX(), this.getClass().getSimpleName(), serviceKey);
    }

    try {
      CSpec spec = (CSpec) cSpecDAO_.find(serviceKey);
      if ( spec == null ) {
        logger_.error("Service not found", serviceKey);
        throw new IOException("Service not found: " + serviceKey);
      }

      X requestContext = getX()
        .put("logger", new PrefixLogger(new Object[] {
              this.getClass().getSimpleName(),
              spec.getName()
            }, (Logger) getX().get("logger")))
        .put(CSpec.class, spec);
      SocketWebAgent agent = (SocketWebAgent) getWebAgent(spec);
      if ( agent == null ) {
        logger_.error("Agent not found", serviceKey);
        throw new IOException("Service not found: "+serviceKey);
      }
      try {
        SessionServerBox.send(requestContext, agent.getSkeletonBox(), agent.getAuthenticate(), new foam.box.Envelope(message, envelope.getReplyBox()));
      } catch (Exception e) {
        logger_.error("Error serving", serviceKey, e);
        if ( pm != null ) pm.error(getX(), e);
        throw e;
      }
    } finally {
      if ( pm != null ) pm.log(getX());
    }
  }

  protected WebAgent getAgent(Skeleton skeleton, CSpec spec) {
    ((OMLogger) getX().get("OMLogger")).log("socket.router.agent");
    WebAgent agent = new SocketWebAgent(skeleton, spec.getAuthenticate());
//    informService(agent, spec);
    return agent;
  }
}
