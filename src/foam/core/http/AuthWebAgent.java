/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.http;

import foam.box.HTTPAuthorizationType;
import foam.lang.X;
import foam.lang.XFactory;
import foam.lang.XLocator;
import foam.dao.DAO;
import foam.core.auth.*;
import foam.core.boot.Boot;
import foam.core.logger.Logger;
import foam.core.session.Session;
import foam.util.SafetyUtil;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.util.StringTokenizer;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.bouncycastle.util.encoders.Base64;

/**
 * A WebAgent decorator that adds session and authentication support.
 *
 * Authentication is attempted in the following order:
 *   1. Authorization header (Bearer token or Basic credentials)
 *   2. sessionId query parameter (or session cookie as fallback)
 *   3. user/password query parameters (form-based login)
 *
 * If authentication succeeds and the required permission is present,
 * the delegate is executed in a per-request sub-context derived from
 * the session context.
 */
public class AuthWebAgent
  extends ProxyWebAgent
{
  public static final String SESSION_ID = "sessionId";

  protected String           permission_;
  protected SendErrorHandler sendErrorHandler_;

  public AuthWebAgent() {}

  public AuthWebAgent(String permission, WebAgent delegate, SendErrorHandler sendErrorHandler) {
    setDelegate(delegate);
    permission_       = permission;
    sendErrorHandler_ = sendErrorHandler;
  }

  // ─── Entry Point ─────────────────────────────────────────────────────────────

  @Override
  public void execute(X x) {
    Session session = authenticate(x);

    if ( session == null ) {
      withXLocator(x, () -> templateLogin(x));
      return;
    }

    AuthService auth = (AuthService) x.get("auth");
    if ( ! auth.check(session.getContext(), permission_) ) {
      denyAccess(x, permission_);
      return;
    }

    X requestX = buildRequestContext(x, session);
    withXLocator(requestX, () -> super.execute(requestX));
  }

  // ─── Authentication ───────────────────────────────────────────────────────────

  /**
   * Resolves or creates a session from the incoming request.
   * Returns null if authentication fails or is denied.
   */
  public Session authenticate(X x) {
    Logger              logger     = (Logger) x.get("logger");
    HttpServletRequest  req        = x.get(HttpServletRequest.class);
    HttpServletResponse resp       = x.get(HttpServletResponse.class);
    DAO                 sessionDAO = (DAO) x.get("localSessionDAO");

    try {
      // 1. Try Authorization header (Bearer or Basic)
      String authHeader = req.getHeader("Authorization");
      if ( ! SafetyUtil.isEmpty(authHeader) ) {
        return authenticateFromHeader(x, authHeader, req, resp, sessionDAO, logger);
      }

      // 2. Try sessionId query parameter (or session cookie as fallback), then form login
      return authenticateFromSession(x, req, resp, sessionDAO, logger);

    } catch ( IOException | IllegalStateException e ) {
      logger.error(e);
      return null;
    }
  }

  /**
   * Handles Bearer and Basic Authorization header authentication.
   * Returns null and sends an error response on any failure.
   */
  Session authenticateFromHeader(
    X x, String authHeader,
    HttpServletRequest req, HttpServletResponse resp,
    DAO sessionDAO, Logger logger
  ) throws IOException {
    StringTokenizer st = new StringTokenizer(authHeader);
    if ( ! st.hasMoreTokens() ) return null;

    String authType = st.nextToken();

    if ( HTTPAuthorizationType.BEARER.getName().equalsIgnoreCase(authType) ) {
      return authenticateBearer(x, st.nextToken(), resp, sessionDAO, logger);
    }

    if ( HTTPAuthorizationType.BASIC.getName().equalsIgnoreCase(authType) ) {
      // Decode credentials and fall through to form-based login logic
      String[] credentials = decodeBasicCredentials(x, st.nextToken(), resp, logger);
      if ( credentials == null ) return null;
      return authenticateFromSession(x, req, resp, sessionDAO, logger,
                                     credentials[0], credentials[1]);
    }

    logger.warning("Unsupported authorization type '" + authType + "', expecting Basic or Bearer.");
    sendError(x, resp, HttpServletResponse.SC_NOT_ACCEPTABLE, "Supported Authorizations: Basic, Bearer");
    return null;
  }

  /**
   * Looks up a session by Bearer token, validates the remote host,
   * and refreshes the stored remote IP if needed.
   */
  Session authenticateBearer(
    X x, String token,
    HttpServletResponse resp, DAO sessionDAO, Logger logger
  ) throws IOException {
    Session session = findBearerSession(x, token, sessionDAO);

    if ( session == null ) {
      logger.debug("Invalid authentication token.", token);
      sendError(x, resp, HttpServletResponse.SC_UNAUTHORIZED, "Invalid authentication token.");
      return null;
    }

    try {
      session.validateRemoteHost(x);
    } catch ( foam.lang.ValidationException e ) {
      logger.debug(e.getMessage(), foam.net.IPSupport.instance().getRemoteIp(x));
      sendError(x, resp, HttpServletResponse.SC_UNAUTHORIZED, "Invalid Source Address.");
      return null;
    }

    session = refreshRemoteHost(x, session, sessionDAO);
    session.touch();

    X effectiveContext = session.applyTo(x);
    XLocator.set(effectiveContext);
    session.setContext(effectiveContext); // XXX: Looks very wrong — revisit
    return session;
  }

  /**
   * Checks the internal (non-clustered) session store first, then the
   * standard session DAO, returning the first match found.
   */
  Session findBearerSession(X x, String token, DAO sessionDAO) {
    DAO internalDAO = (DAO) x.get("localInternalSessionDAO");
    if ( internalDAO != null ) {
      Session session = (Session) internalDAO.find(token);
      if ( session != null ) {
        session.setClusterable(false);
        return session;
      }
    }
    return (Session) sessionDAO.find(token);
  }

  /**
   * Decodes a Base64-encoded "username:password" string.
   * Returns a two-element array [username, password], or null on failure.
   */
  String[] decodeBasicCredentials(
    X x, String encoded,
    HttpServletResponse resp, Logger logger
  ) throws IOException {
    try {
      String credentials = new String(Base64.decode(encoded), "UTF-8");
      int colon = credentials.indexOf(':');
      if ( colon <= 0 ) {
        logger.debug("Invalid Basic credentials — unable to parse username:password.");
        sendError(x, resp, HttpServletResponse.SC_UNAUTHORIZED, "Invalid authentication credentials.");
        return null;
      }
      return new String[] {
        credentials.substring(0, colon).trim(),
        credentials.substring(colon + 1).trim()
      };
    } catch ( UnsupportedEncodingException e ) {
      logger.warning(e, "Unsupported authentication encoding, expecting Base64.");
      sendError(x, resp, HttpServletResponse.SC_NOT_ACCEPTABLE, "Supported Authentication Encodings: Base64");
      return null;
    }
  }

  /** Convenience overload that reads email/password from query parameters. */
  Session authenticateFromSession(
    X x, HttpServletRequest req, HttpServletResponse resp,
    DAO sessionDAO, Logger logger
  ) throws IOException {
    return authenticateFromSession(
      x,
      req,
      resp,
      sessionDAO,
      logger,
      req.getParameter("user"),
      req.getParameter("password"));
  }

  /**
   * Finds or creates a session using the session cookie / sessionId
   * query parameter, then attempts a credential login if email is provided.
   */
  Session authenticateFromSession(
    X x, HttpServletRequest req, HttpServletResponse resp,
    DAO sessionDAO, Logger logger,
    String email, String password
  ) throws IOException {
    AuthService auth    = (AuthService) x.get("auth");
    Session     session = findOrCreateSession(x, req, sessionDAO);
    PrintWriter out     = x.get(PrintWriter.class);

    session.setContext(session.applyTo(x));
    session.touch();

    try {
      session.validateRemoteHost(x);
    } catch ( foam.lang.ValidationException e ) {
      logger.debug(e.getMessage(), foam.net.IPSupport.instance().getRemoteIp(x));
      if ( ! SafetyUtil.isEmpty(req.getHeader("Authorization")) ) {
        sendError(x, resp, HttpServletResponse.SC_UNAUTHORIZED, "Access denied");
      } else {
        out.println("Access denied");
      }
      return null;
    }

    session = refreshRemoteHost(x, session, sessionDAO);

    // Already authenticated — no credentials to (re-)verify
    User existingUser = ((Subject) session.getContext().get("subject")).getUser();
    if ( existingUser != null && SafetyUtil.isEmpty(email) ) {
      return session;
    }

    return loginWithCredentials(x, req, resp, session, sessionDAO, auth, logger, email, password);
  }

  /**
   * Looks up an existing session by cookie or query parameter;
   * creates and persists a new session if none is found.
   */
  Session findOrCreateSession(X x, HttpServletRequest req, DAO sessionDAO) {
    String sessionId = req.getParameter(SESSION_ID);
    if ( SafetyUtil.isEmpty(sessionId) ) {
      Cookie cookie = getCookie(req);
      if ( cookie != null ) sessionId = cookie.getValue();
    }

    Session session = null;
    if ( ! SafetyUtil.isEmpty(sessionId) ) {
      session = (Session) sessionDAO.find(sessionId);
    }

    if ( session == null ) {
      session = createSession(x);
      if ( ! SafetyUtil.isEmpty(sessionId) ) session.setId(sessionId);
      // NOTE: don't use returned session — clusterTransient context is null after put.
      Session saved = (Session) sessionDAO.put(session);
      if ( SafetyUtil.isEmpty(session.getId()) ) session.setId(saved.getId());
    }

    return session;
  }

  /**
   * Attempts to log in with email and password, updating the session on
   * success. Handles optional actAs impersonation.
   */
  Session loginWithCredentials(
    X x,
    HttpServletRequest req,
    HttpServletResponse resp,
    Session session,
    DAO sessionDAO,
    AuthService auth,
    Logger logger,
    String email,
    String password
  ) throws IOException {
    try {
      X loginX = session.getContext()
        .put(HttpServletRequest.class,  req)
        .put(HttpServletResponse.class, resp);

      User user = auth.login(loginX, email, password);

      if ( user == null ) {
        // login() should always throw rather than returning null
        logger.error("AuthService.login returned null without throwing AuthenticationException.");
        sendError(x, resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Authentication failure.");
        return null;
      }

      session.setUserId(user.getId());
      session.setContext(session.applyTo(session.getContext()));

      String actAs = req.getParameter("actAs");
      if ( ! SafetyUtil.isEmpty(actAs) ) {
        applyActAs(x, session, actAs, logger);
      }

      return session;

    } catch ( AuthenticationException e ) {
      if ( sendErrorHandler_ != null ) {
        sendError(x, resp, HttpServletResponse.SC_UNAUTHORIZED, e.getMessage());
      }
      return null;
    }
  }

  /**
   * Applies agent/impersonation context when an actAs user ID is specified.
   */
  void applyActAs(X x, Session session, String actAs, Logger logger) {
    try {
      AgentAuthService agentService = (AgentAuthService) x.get("agentAuth");
      DAO localUserDAO              = (DAO) x.get("localUserDAO");
      User entity = (User) localUserDAO.find(Long.parseLong(actAs));
      agentService.actAs(session.getContext(), entity);
    } catch ( NumberFormatException e ) {
      logger.error("actAs must be a numeric user ID: " + e);
    }
  }

  // ─── Context & Session Utilities ─────────────────────────────────────────────

  /**
   * Builds a per-request sub-context from the session context, forwarding
   * the Servlet request/response and lazily providing the PrintWriter.
   */
  X buildRequestContext(X x, Session session) {
    X x_ = x;
    return session.getContext()
      .put(HttpServletRequest.class,  x.get(HttpServletRequest.class))
      .put(HttpServletResponse.class, x.get(HttpServletResponse.class))
      // Lazily delegate PrintWriter to avoid conflicts with getOutputStream()
      .putFactory(PrintWriter.class, new XFactory() {
        @Override public Object create(X ctx) { return x_.get(PrintWriter.class); }
      });
  }

  /**
   * Updates the session's stored remote IP when it has changed.
   * Returns the refreshed session.
   */
  Session refreshRemoteHost(X x, Session session, DAO sessionDAO) {
    String remoteIp = foam.net.IPSupport.instance().getRemoteIp(x);
    if ( SafetyUtil.isEmpty(session.getRemoteHost()) ||
         ! SafetyUtil.equals(session.getRemoteHost(), remoteIp) ) {
      session.setRemoteHost(remoteIp);
      session = (Session) sessionDAO.put(session);
    }
    return session;
  }

  public Session createSession(X x) {
    HttpServletRequest req     = x.get(HttpServletRequest.class);
    Session            session = new Session((X) x.get(Boot.ROOT));
    session.setRemoteHost(req.getRemoteHost());
    session.setContext(session.applyTo(x));
    return session;
  }

  public Cookie getCookie(HttpServletRequest req) {
    Cookie[] cookies = req.getCookies();
    if ( cookies == null ) return null;
    for ( Cookie cookie : cookies ) {
      if ( SESSION_ID.equals(cookie.getName()) ) return cookie;
    }
    return null;
  }

  // ─── Access Control ───────────────────────────────────────────────────────────

  void denyAccess(X x, String permission) {
    Logger              logger = (Logger) x.get("logger");
    HttpServletResponse resp   = x.get(HttpServletResponse.class);
    PrintWriter         out    = x.get(PrintWriter.class);

    out.println("Access denied. Need permission: " + permission);
    logger.debug("Access denied, requires permission", permission, "subject", x.get("subject"));
    resp.setStatus(HttpServletResponse.SC_FORBIDDEN);
  }

  protected void sendError(X x, HttpServletResponse resp, int status, String message)
    throws IOException
  {
    if ( sendErrorHandler_ == null ) {
      resp.sendError(status, message);
    } else {
      sendErrorHandler_.sendError(x, status, message);
    }
  }

  // ─── Login Template ───────────────────────────────────────────────────────────

  /**
   * Renders a minimal HTML login form when no sendErrorHandler is configured.
   * When a handler is present, the handler is responsible for redirecting.
   */
  public void templateLogin(X x) {
    if ( sendErrorHandler_ != null ) return;

    PrintWriter out = x.get(PrintWriter.class);
    out.println("""
      <form method="post">
        <h1>Login</h1>
        <br>
        <label style="display:inline-block;width:70px;">Email:</label>
        <input name="user" id="user" type="text" size="30">
        <br>
        <label style="display:inline-block;width:70px;">Password:</label>
        <input name="password" id="password" type="password" size="30">
        <br>
        <button id="login" type="submit" style="display:inline-block;margin-top:10px;">Log In</button>
      </form>
      <script>
        document.getElementById('login').addEventListener('click', function() {
          if ( document.getElementById('user').value === '' ) {
            alert('Email Required');
          } else if ( document.getElementById('password').value === '' ) {
            alert('Password Required');
          }
        });
      </script>
    """);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Runs a block with an XLocator set, restoring null on exit. */
  void withXLocator(X x, Runnable block) {
    try {
      XLocator.set(x);
      block.run();
    } finally {
      XLocator.set(null);
    }
  }
}
