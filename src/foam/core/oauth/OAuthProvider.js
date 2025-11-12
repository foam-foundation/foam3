foam.CLASS({
  package: "foam.core.oauth",
  name: "OAuthProvider",
  ids: [
    "clientId"
  ],
  properties: [
    {
      class: 'String',
      name: 'description'
    },
    {
      class: 'String',
      name: 'icon'
    },
    {
      class: 'String',
      name: 'clientId',
      documentation: 'oauth client id of this provider'
    },
    {
      class: 'String',
      name: 'clientSecret',
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'URL',
      name: 'authURL',
      documentation: 'URL to open the browser to do complete sign in'
    },
    {
      class: 'URL',
      name: 'tokenURL',
      documentation: 'URL to fetch JWTs from using authorization code'
    },
    {
      class: 'StringArray',
      name: 'domains',
      documentation: 'List of hostnames that should offer this OAuth provider.',
      factory: function() { return []; },
      javaFactory: 'return new String[] {};'
    },
  ],
  methods: [
    {
      name: 'getTokenForCode',
      type: 'String',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'code', type: 'String' },
        { name: 'redirectURI', type: 'String' }
      ],
      javaCode: `
            foam.core.logger.Logger logger = (foam.core.logger.Logger) x.get("logger");
            try {
                java.net.URL url = new java.net.URL(getTokenURL());
                javax.net.ssl.HttpsURLConnection conn = (javax.net.ssl.HttpsURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
    
                String params = "code=" + java.net.URLEncoder.encode(code, "UTF-8") +
                        "&client_id=" + java.net.URLEncoder.encode(getClientId(), "UTF-8") +
                        "&client_secret=" + java.net.URLEncoder.encode(getClientSecret(), "UTF-8") +
                        "&redirect_uri=" + java.net.URLEncoder.encode(redirectURI, "UTF-8") +
                        "&grant_type=authorization_code";
    
                try (java.io.OutputStream os = conn.getOutputStream()) {
                    os.write(params.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
    
                if (conn.getResponseCode() != 200) {
                    logger.error("Failed to obtain tokens, HTTP response code: " + conn.getResponseCode());
                    return null;
                }
    
                try (java.io.BufferedReader in = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()))) {
                    return org.apache.commons.io.IOUtils.toString(in);
                }
            } catch (Exception e) {
                logger.error("Exception occurred while obtaining tokens", e);
                return null;
            }
        `
    },
    {
      name: 'refreshAccessToken',
      args: [
        { name: 'x', type: "Context" },
        { name: 'refreshToken', type: 'String' },
      ],
      type: 'String',
      throws: [ 'java.io.IOException' ],
      javaCode: `
try {
java.net.URL url = new java.net.URL(getTokenURL());
java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
connection.setRequestMethod("POST");
connection.setDoOutput(true);
connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

// Prepare the request body
String requestBody = String.join("&",
    "client_id=" + java.net.URLEncoder.encode(getClientId(), "UTF-8"),
    "client_secret=" + java.net.URLEncoder.encode(getClientSecret(), "UTF-8"),
    "refresh_token=" + java.net.URLEncoder.encode(refreshToken, "UTF-8"),
    "grant_type=refresh_token");

// Send the request
java.io.OutputStream os = connection.getOutputStream();
os.write(requestBody.getBytes("UTF-8"));

// Read the response
int responseCode = connection.getResponseCode();
if (responseCode != 200) {
  throw new RuntimeException("Failed to refresh token, response code: " + responseCode);
}

// Read the response body into a JsonObject
java.io.InputStream is = connection.getInputStream();
javax.json.JsonReader jsonReader = javax.json.Json.createReader(is);
javax.json.JsonObject responseJson = jsonReader.readObject(); 
return responseJson.getString("access_token");
} catch (Exception e) {
    throw new RuntimeException("Failed to refresh token", e);
}
        `
    }
  ]
});
