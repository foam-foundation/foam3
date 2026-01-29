package foam.core.oauth;

import foam.core.boot.Boot;
import foam.core.auth.AuthenticationException;
import foam.core.session.Session;
import foam.lang.X;
import foam.core.http.WebAgent;
import foam.util.SafetyUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import foam.core.logger.Logger;

import javax.json.Json;
import javax.json.JsonObject;
import javax.json.JsonReader;

// Generic OAuth Web Agent for handling oauth redirects
// can be used for login and for storing oauth credentials for users
// can be subclassed to customize behaviour
public class OAuthWebAgent implements WebAgent {
    protected JsonObject parseIdTokenBody(String idToken) {
        if ( SafetyUtil.isEmpty(idToken) ) return null;
        try {
            String parts[] = idToken.split("\\.");
            if ( parts.length < 2 ) return null;
            String bodyb64 = parts[1];

            byte[] bodyBytes = java.util.Base64.getUrlDecoder().decode(bodyb64);
            String body = new String(bodyBytes, java.nio.charset.StandardCharsets.UTF_8);

            javax.json.JsonReader reader = javax.json.Json.createReader(new java.io.StringReader(body));
            javax.json.JsonObject bodyObject = reader.readObject();
            reader.close();
            return bodyObject;
        } catch ( Exception e ) {
            return null;
        }
    }

    @Override
    public void execute(X x) {
        Logger logger = (Logger) x.get("logger");
        HttpServletRequest req = x.get(HttpServletRequest.class);
        HttpServletResponse resp = x.get(HttpServletResponse.class);

        try {
            String code = req.getParameter("code");
            if (code == null || code.isEmpty()) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("Missing authorization code");
                return;
            }

            // Parse state parameter as JSON
            String stateParam = req.getParameter("state");
            JsonObject state;
            if (stateParam == null || stateParam.isEmpty()) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("Missing state parameter");
                return;
            }

            JsonReader stateReader = Json.createReader(new java.io.StringReader(stateParam));
            state = stateReader.readObject();
            stateReader.close();

            var sessionID = state.getString("session_id", null);
            var sessionDAO = ((foam.dao.DAO)x.get("sessionDAO"));
            var session = (foam.core.session.Session)sessionDAO.find(sessionID);
            if ( session == null ) {
                session = new Session((X) x.get(Boot.ROOT));
                session.setId(sessionID == null ? "anonymous" : sessionID);
                session = (foam.core.session.Session) sessionDAO.put(session);
            }

            String clientId = state.getString("provider");
            foam.dao.DAO oAuthProviderDAO = (foam.dao.DAO) x.get("oAuthProviderDAO");
            var provider = (OAuthProvider) oAuthProviderDAO.find(clientId);

            // Exchange authorization code for access/refresh tokens
            String response = provider.getTokenForCode(x, code, req.getRequestURL().toString());
            if (response == null) {
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                resp.getWriter().write("Failed to obtain tokens");
                return;
            }

            JsonReader jsonReader = Json.createReader(new java.io.StringReader(response));
            JsonObject tokenResponse = jsonReader.readObject();
            jsonReader.close();

            String[] scopes = tokenResponse.getString("scope", "").split(" ");
            String accessToken = tokenResponse.getString("access_token");
            String refreshToken = tokenResponse.getString("refresh_token", null);
            String idToken = tokenResponse.getString("id_token", null);

            String flow = state.getString("flow", "login");

            // if an idToken was returned, we can identify the remote account
            foam.core.auth.User user;
            javax.json.JsonObject idTokenBody = parseIdTokenBody(idToken);
            String remoteSubject = idTokenBody != null && idTokenBody.containsKey("sub") ? idTokenBody.getString("sub") : null;
            String remoteEmail   = idTokenBody != null && idTokenBody.containsKey("email") ? idTokenBody.getString("email") : null;

            if ( "connect".equals(flow) ) {
                // Connect external account to the currently logged-in user. Do NOT login/switch user.
                if ( idTokenBody == null || SafetyUtil.isEmpty(remoteSubject) ) {
                    sendErrorResponse(x, "Missing id_token/sub for connect flow", state, resp);
                    return;
                }
                user = session.findUserId(x);
                if ( user == null ) {
                    sendErrorResponse(x, "Not logged in", state, resp);
                    return;
                }
            } else {
                // Login flow (default)
                if ( idToken != null ) {
                    try {
                        user = loginWithIdToken(x, state, provider, idToken);
                    } catch (AuthenticationException e) {
                        sendErrorResponse(x, e.getMessage(), state, resp);
                        return;
                    }
                } else {
                    user = session.findUserId(x);
                }
            }

            var userX = session.getContext();

            var oAuthCredentialsDAO = (foam.dao.DAO)x.get("oAuthCredentialDAO");
            if ( remoteSubject == null ) remoteSubject = "";
            foam.lang.FObject existingCredential = (foam.lang.FObject) oAuthCredentialsDAO.find(new foam.core.oauth.OAuthCredentialId(provider.getId(), user.getId(), remoteSubject));
            var credential = new foam.core.oauth.OAuthCredential();
            if (existingCredential != null) {
                credential.copyFrom(existingCredential);
            }
            credential.setUser(user.getId());
            credential.setProvider(provider.getId());
            credential.setRemoteSubject(remoteSubject);
            credential.setRemoteEmail(remoteEmail);
            credential.setAccessToken(accessToken);
            if (refreshToken != null) {
                credential.setRefreshToken(refreshToken);
            }
            foam.core.oauth.OAuthCredential oldCred = existingCredential instanceof foam.core.oauth.OAuthCredential ? (foam.core.oauth.OAuthCredential) existingCredential : null;
            if ( oldCred != null && oldCred.getScopes() != null && scopes != null ) {
                java.util.LinkedHashSet<String> merged = new java.util.LinkedHashSet<>();
                for ( String s : oldCred.getScopes() ) {
                    if ( ! SafetyUtil.isEmpty(s) ) merged.add(s);
                }
                for ( String s : scopes ) {
                    if ( ! SafetyUtil.isEmpty(s) ) merged.add(s);
                }
                credential.setScopes(merged.toArray(new String[0]));
            } else {
                credential.setScopes(scopes);
            }

            oAuthCredentialsDAO.put(credential);

            handleOAuthCredential(x, userX, credential);

            String redirectUrl = state.getString("redirect_url", null); // Extract redirect URL from state
            if (!SafetyUtil.isEmpty(redirectUrl)) {
                // Redirect back to the application
                resp.sendRedirect(redirectUrl);
                return;
            }

            sendResponse(x, state, resp);
        } catch (Exception e) {
            e.printStackTrace();
            try {
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                resp.getWriter().write("Server error: " + e.getMessage());
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
    }

    protected void handleOAuthCredential(X x, X userX, foam.core.oauth.OAuthCredential credential) {
        // template method
    }

    protected void sendResponse(X x, JsonObject state, HttpServletResponse resp) throws java.io.IOException {
        if (state.getBoolean("return_to_app", false)) {
            resp.sendRedirect(state.getString("return_to_url"));
        } else {
            // emit a mini HTML that calls postMessage to the opener, then closes
            java.io.PrintWriter out = resp.getWriter();
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.setContentType("text/html");
            out.println("<!DOCTYPE html>");
            out.println("<html><body>");
            out.println("<h1>Success</h1>");
            out.println("<input type=\"hidden\" id=\"sessionId\" value=\"" + state.getString("session_id", "") + "\">");
            out.print("<script language=\"javascript\">");
            out.print("window.opener && window.opener.postMessage({ msg: \"success\", sessionID: document.getElementById(\"sessionId\").value }, location.origin);");
            out.print("window.close();");
            out.print("</script>");
            out.println("</body></html>");
            out.close();
        }
    }

    protected void sendErrorResponse(X x, String errorMessage, JsonObject state, HttpServletResponse resp) throws java.io.IOException {
        if (state.getBoolean("return_to_app", false)) {
            resp.sendRedirect("/?oauth_exception=" + errorMessage);
        } else {
            // emit a mini HTML that calls postMessage to the opener, then closes
            java.io.PrintWriter out = resp.getWriter();
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.setContentType("text/html");
            out.println("<!DOCTYPE html>");
            out.println("<html><body>");
            out.println("<h1>Something went wrong!</h1>");
            out.println("<input type=\"hidden\" id=\"errorMessage\" value=\"" + errorMessage + "\">");
            out.println("<input type=\"hidden\" id=\"sessionId\" value=\"" + state.getString("session_id", "") + "\">");
            out.print("<script language=\"javascript\">");
            out.print("window.opener && window.opener.postMessage({ error: { message: document.getElementById(\"errorMessage\").value }, sessionID: document.getElementById(\"sessionId\").value }, location.origin);");
            out.print("window.close();");
            out.print("</script>");
            out.println("</body></html>");
            out.close();
        }
    }

    protected foam.core.auth.User loginWithIdToken(foam.lang.X x, javax.json.JsonObject state, foam.core.oauth.OAuthProvider provider, String idToken) {
        Logger logger = (Logger) x.get("logger");
        javax.json.JsonObject bodyObject = parseIdTokenBody(idToken);
        if ( bodyObject == null ) {
            throw new AuthenticationException("Invalid id_token");
        }

        if (!bodyObject.getBoolean("email_verified")) {
            throw new AuthenticationException("Email is not verified");
        }

        if (bodyObject.getInt("exp", Integer.MIN_VALUE) < java.time.Instant.now().getEpochSecond()) {
            throw new AuthenticationException("Expired token");
        }

        if (!bodyObject.getString("aud").equals(provider.getClientId())) {
            throw new AuthenticationException("Incorrect audience");
        }

        String email = bodyObject.getString("email");

        foam.core.auth.User user = ((foam.core.auth.UniqueUserService)x.get("uniqueUserService")).getUser(x, email);

        if ( user == null ) {
            String givenName = bodyObject.containsKey("given_name") ? bodyObject.getString("given_name") : null;
            String familyName = bodyObject.containsKey("family_name") ? bodyObject.getString("family_name") : null;
            String userName = state.containsKey("sign_up_username") ? state.getString("sign_up_username") : null;

            if ( SafetyUtil.isEmpty(userName) ) {
                userName = email;
            }

            // always default the username to the verified email address
            foam.core.auth.User.Builder builder = new foam.core.auth.User.Builder(x)
                    .setUserName(userName)
                    .setEmail(email)
                    .setEmailVerified(true);

            if ( ! SafetyUtil.isEmpty(givenName) ) {
                builder.setFirstName(givenName);
            }

            if ( ! SafetyUtil.isEmpty(familyName) ) {
                builder.setLastName(familyName);
            }

            foam.dao.DAO userRegistrationDAO = (foam.dao.DAO) x.get("userRegistrationDAO");
            if ( userRegistrationDAO == null ) {
                throw new AuthenticationException("userRegistrationDAO not available");
            }

            try {
                userRegistrationDAO.inX(x).put(builder.build());
            } catch ( RuntimeException e ) {
                logger.error("Unable to register user", e);
                throw new AuthenticationException("Unable to register user");
            }
            user = ((foam.core.auth.UniqueUserService)x.get("uniqueUserService")).getUser(x, email);
        }

        if ( user == null ) {
            throw new AuthenticationException("User not found");
        }

        foam.core.session.Session session = (foam.core.session.Session)((foam.dao.DAO)x.get("sessionDAO")).find(state.getString("session_id"));
        if ( session == null ) {
            throw new AuthenticationException("Session not found");
        }

        foam.core.auth.LoginService login = (foam.core.auth.LoginService)x.get("loginService");
        return login.login(session.getContext(), user);
    }
}
