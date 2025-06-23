/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ws;

import foam.box.RawWebSocketBox;
import foam.lang.ContextAwareSupport;
import foam.lang.FObject;
import foam.lang.X;
import foam.dao.DAO;
import foam.lib.json.JSONParser;
import foam.core.boot.CSpec;
import foam.core.box.COREServiceRouter;
import foam.core.logger.Logger;
import org.eclipse.jetty.websocket.api.RemoteEndpoint;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.UpgradeRequest;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketError;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;
import java.io.IOException;

@WebSocket
public class NanoWebSocket
  extends ContextAwareSupport
{
  protected Session           session_ = null;
  protected COREServiceRouter router_  = null;
  protected Logger            logger_  = null;

  public NanoWebSocket(X x) {
    setX(x);
  }

  public COREServiceRouter getRouter() {
    if ( router_ == null ) {
      router_ = getX().create(COREServiceRouter.class);
    }
    return router_;
  }

  public Logger getLogger() {
    if ( logger_ == null ) {
      logger_ = (Logger) getX().get("logger");
    }
    return logger_;
  }

  @OnWebSocketConnect
  public void onWebSocketConnect(Session session) {
    session_ = session;
    getLogger().info("WebSocket session connected.");
  }

  @OnWebSocketClose
  public void onWebSocketClose(int code, String reason) {
    session_ = null;
    getLogger().info("WebSocket session closed.");
  }

  @OnWebSocketError
  public void onWebSocketError(Throwable t) {
    getLogger().error("Web socket error", t.getMessage());
  }

  @OnWebSocketMessage
  public void onWebSocketMessage(String message) {
    try {
      if ( session_ != null && session_.isOpen() ) {
        RemoteEndpoint          remote     = session_.getRemote();
        UpgradeRequest          upgrade    = session_.getUpgradeRequest();
        String                  path       = upgrade.getRequestURI().getPath();
        String                  serviceKey = path.split("/")[2];
        DAO                     cSpecDAO   = (DAO) getX().get("cSpecDAO");
        CSpec                   spec       = (CSpec) cSpecDAO.find(serviceKey);
        foam.util.UIDGenerator  uids       = new foam.util.AUIDGenerator(getX(), "websockets");

        if ( spec == null ) {
          getLogger().warning("Request for non-existent service.", serviceKey);
          return;
        }

        if ( ! spec.getServe() ) {
          getLogger().warning("Request for service that is not being served.", serviceKey);
          return;
        }

        RawWebSocketBox returnBox = getX().create(RawWebSocketBox.class);
        returnBox.setSocket(new foam.net.WebSocket() {
          @Override
          public void send(String message) throws IOException {
            remote.sendString(message);
          }
        });

        // put return box into context
        X context = getX().put("returnBox", returnBox);

        // parse incoming message
        FObject request = context.create(JSONParser.class).parseString(message);
        if ( request == null ) {
          getLogger().warning("Failed to parse request.", message);
          return;
        }

        if ( ! ( request instanceof foam.box.Envelope ) ) {
          getLogger().warning("Request was not a box envelope.", message);
          return;
        }

        // set context
        foam.lang.XLocator.set(context);
        
        // pass message to service via NanoRouter
        getRouter().service(serviceKey, (foam.box.Envelope)request);
      } else {
        getLogger().warning("WebSocket session not connected.");
      }
    } catch ( Throwable t ) {
      getLogger().error("Error handling WebSocket request.", t, message);
    }
  }
}
