/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.box;

import foam.lang.SubX;
import foam.lang.X;
import foam.lang.XLocator;
import foam.dao.DAO;
import foam.core.app.AppConfig;
import foam.core.app.Mode;
import foam.core.auth.AuthenticationException;
import foam.core.auth.AuthorizationException;
import foam.core.auth.Group;
import foam.core.auth.User;
import foam.core.boot.Boot;
import foam.core.boot.CSpec;
import foam.core.logger.Logger;
import foam.core.logger.Loggers;
import foam.core.om.OMLogger;
import foam.core.pm.PM;
import foam.core.session.Session;
import foam.util.SafetyUtil;
import org.eclipse.jetty.server.Request;

import java.util.StringTokenizer;
import jakarta.servlet.http.HttpServletRequest;

/**
 * This Box decorator adds session support to boxes.
 *
 * Its core purpose is to create a new context using parts of the context it was
 * created with and parts of a user's session context to pass on to its delegate
 * box. This class also enforces authorization and authentication controls for
 * the CSpec in the context.
 */
public class SessionServerBox
  extends ProxyBox
{
  protected boolean authenticate_;

  public SessionServerBox() {
  }

  public SessionServerBox(X x, Box delegate, boolean authenticate) {
    super(x, delegate);
    authenticate_ = authenticate;
  }

  public void send(Envelope envelope) {
    send(getX(), getDelegate(), authenticate_, envelope);
  }

  public static void send(X x, Box delegate, boolean authenticate, Envelope envelope) {
    Object  message    = envelope.getMessage();
    Box     replyBox   = envelope.getReplyBox();
    CSpec   spec       = x.get(CSpec.class);
    Logger  logger     = Loggers.logger(x, null, "SessionServerBox", spec.getName());
    DAO     sessionDAO = (DAO) x.get("localSessionDAO");
    Session session    = null;
    String  sessionID  = null;
    PM      pm         = PM.create(x, "SessionServerBox", spec.getName());

    try {
      if ( sessionID == null && message instanceof SessionedMessage sessionedMessage) {
        sessionID = sessionedMessage.getSessionId();
        message = sessionedMessage.getMessage();
      }

      if ( sessionID == null && authenticate ) {
        envelope.replyWithException(new IllegalArgumentException("sessionId required for authenticated services"));
        return;
      }

      // test and use non-clustered sessions
      DAO internalSessionDAO = (DAO) x.get("localInternalSessionDAO");
      if ( internalSessionDAO != null ) {
        session = (Session) internalSessionDAO.find(sessionID);
        if ( session != null ) {
          session.setClusterable(false);
        }
      }

      if ( session == null ) {
        session = (Session) sessionDAO.find(sessionID);
      }

      if ( session == null ) {
        session = new Session((X) x.get(Boot.ROOT));
        session.setId(sessionID == null ? "anonymous" : sessionID);
        session = (Session) sessionDAO.put(session);
      }

      // TODO: This should probably just live in a box decorator
      HttpServletRequest req = x.get(HttpServletRequest.class);
      if ( req != null ) {
        // if req == null it means that we're being accessed via webSockets
        try {
          session.validateRemoteHost(x);
          String remoteIp = foam.net.IPSupport.instance().getRemoteIp(x);
          if ( SafetyUtil.isEmpty(session.getRemoteHost()) ||
               ! SafetyUtil.equals(session.getRemoteHost(), remoteIp) ) {
            session.setRemoteHost(remoteIp);
            session = (Session) sessionDAO.put(session);
          }
        } catch (foam.lang.ValidationException e) {
          sessionDAO.remove(session);
          // Session.validateRemoteHost tests for both a change in IP and
          // restricted IPs.
          if ( e.getMessage().equals("Restricted IP") ) {
            logger.warning(e.getMessage(), foam.net.IPSupport.instance().getRemoteIp(x));
            envelope.replyWithException(new AuthenticationException("Access denied"));
          } else {
            // If an existing session is reused with a different remote host then
            // delete the session and force a re-login.
            // This is done as a security measure to reduce the likelihood of
            // session hijacking. If an attacker were to get ahold of another
            // user's session id, they could start using that session id in the
            // requests they send to the server and gain access to the real user's
            // session and therefore their privileges and data. By forcing users
            // to sign back in when the remote host changes, we reduce the attack
            // surface for session hijacking. Session hijacking is still possible,
            // but only if the user is on the same remote host.
            logger.warning("Remote host for session ", sessionID, " changed from ", session.getRemoteHost(), " to ", foam.net.IPSupport.instance().getRemoteIp(x), ". Deleting session and forcing the user to sign in again.");
            envelope.replyWithException(new AuthenticationException("IP address changed. Your session was deleted to keep your account secure. Please sign in again to verify your identity."));
          }
          return;
        }
      }

      // If this service has been configured to require authentication, then
      // throw an error if there's no user in the context.
      if ( authenticate && session.getUserId() == 0 ) {
        envelope.replyWithException(new AuthenticationException());
        return;
      }

      if ( session.getContext().get("localLocalSettingDAO") == null && session.getUserId() != 0 ) {
        DAO localLocalSettingDAO = new foam.dao.MDAO(foam.core.session.LocalSetting.getOwnClassInfo());
        session.setContext(session.getContext().put("localLocalSettingDAO", localLocalSettingDAO));
      }

      X effectiveContext = session.applyTo(x);

      // Make context available to thread-local XLocator
      XLocator.set(effectiveContext);
      session.setContext(effectiveContext);
      session.touch();

      try {
        spec.checkAuthorization(effectiveContext);
      } catch (AuthorizationException e) {
        Group group = (Group) effectiveContext.get("group");
        logger.warning("Missing permission", group != null ? group.getId() : "NO GROUP");
        envelope.replyWithException(e);
        return;
      }

      pm.log(x);
      delegate.send(new foam.box.Envelope(effectiveContext, message, replyBox));
    } catch (Throwable t) {
      logger.warning(t.getMessage());
      // logger.warning(t.getMessage(), t); // Uncomment to debug server-side exceptions
      if ( t instanceof NullPointerException) {
        logger.error(t);
      }
      if ( t instanceof foam.core.auth.UserNotFoundException) {
        sessionDAO.remove(session);
      }
      envelope.replyWithException(t);
      pm.error(x, t);
      AppConfig appConfig = (AppConfig) x.get("appConfig");
      if ( Mode.TEST == appConfig.getMode() )
        throw new RuntimeException(t);
    } finally {
      XLocator.set(null);
    }
  }
}
