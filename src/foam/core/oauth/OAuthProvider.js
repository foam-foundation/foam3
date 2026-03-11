foam.CLASS({
  package: "foam.core.oauth",
  name: "OAuthProvider",

  javaImports: [
    'foam.util.SafetyUtil',
    'java.net.URL',
    'java.math.BigInteger',
    'javax.net.ssl.HttpsURLConnection',
    'jakarta.json.Json',
    'jakarta.json.JsonArray',
    'jakarta.json.JsonObject',
    'jakarta.json.JsonReader',
    'java.io.StringReader',
    'java.nio.charset.StandardCharsets',
    'java.security.KeyFactory',
    'java.security.PublicKey',
    'java.security.Signature',
    'java.security.spec.RSAPublicKeySpec',
    'java.time.Instant',
    'java.util.Base64',
    'java.util.Date',
    'java.util.Map',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  javaCode: `
    // Cache oauth provider <kid, publicKey>
    protected Map<String, PublicKey> cache_ = new ConcurrentHashMap<>();
  `,

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
    {
      class: 'String',
      name: 'certificateURL',
      documentation: '(Optional) URL to crytographic keys for verifing the signature of JWTs issued by the OAuth provider.'
    }
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
            var logger = foam.core.logger.Loggers.logger(x, this, getId());
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
      args: 'Context x, foam.core.oauth.OAuthCredential credential',
      type: 'Void',
      throws: [ 'java.io.IOException' ],
      javaCode: `
try {
java.net.URL url = new java.net.URL(getTokenURL());
java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
connection.setRequestMethod("POST");
connection.setDoOutput(true);
connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

String refreshToken = credential.getRefreshToken();
if ( refreshToken == null || refreshToken.isEmpty() ) {
  throw new RuntimeException("No refresh token available");
}

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
jakarta.json.JsonReader jsonReader = jakarta.json.Json.createReader(is);
jakarta.json.JsonObject responseJson = jsonReader.readObject(); 

// Update oauth credential data
credential.setAccessToken(responseJson.getString("access_token", null));
if ( responseJson.containsKey("refresh_token") ) {
  credential.setRefreshToken(responseJson.getString("refresh_token"));
}

if ( responseJson.containsKey("expires_in") ) {
  int expiresIn = responseJson.getInt("expires_in");
  Instant expiresAt = Instant.now().plusSeconds(expiresIn);
  credential.setExpiresAt(Date.from(expiresAt));
}
} catch (Exception e) {
    throw new RuntimeException("Failed to refresh token", e);
}
        `
    },
    {
      name: 'verifyTokenSignature',
      args: 'Context x, String jwtToken',
      type: 'Boolean',
      javaCode: `
if ( SafetyUtil.isEmpty(jwtToken) ) return false;

// certificateURL is not set, assuming token signature is verified
if ( SafetyUtil.isEmpty(getCertificateURL()) ) return true;

try {
  String[] parts = jwtToken.split("\\\\.");
  if ( parts == null || parts.length != 3 ) {
    throw new RuntimeException("Invalid JWT format");
  }

  var headerBytes = Base64.getUrlDecoder().decode(parts[0]);
  var header = new String(headerBytes, StandardCharsets.UTF_8);
  var headerReader = Json.createReader(new StringReader(header));
  var headerObject = headerReader.readObject();
  headerReader.close();

  String alg = headerObject.getString("alg", null);
  if ( alg == null || ! "RS256".equals(alg) ) {
    throw new RuntimeException("Unsupported JWT algorithm");
  }

  String kid = headerObject.getString("kid", null);
  if ( SafetyUtil.isEmpty(kid) ) {
    throw new RuntimeException("Missing JWT key id");
  }

  PublicKey publicKey = this.cache_.get(kid);
  if ( publicKey == null ) {
    publicKey = getPublicKey(kid);
    this.cache_.put(kid, publicKey);
  }

  var signingInput = parts[0] + "." + parts[1];
  var signatureBytes = Base64.getUrlDecoder().decode(parts[2]);

  var signature = Signature.getInstance("SHA256withRSA");
  signature.initVerify(publicKey);
  signature.update(signingInput.getBytes(StandardCharsets.US_ASCII));
  return signature.verify(signatureBytes);
} catch ( Exception e ) {
  throw new RuntimeException("Failed to verify token signature", e);
}
`
    },
    {
      visibility: 'protected',
      name: 'getPublicKey',
      args: 'String kid',
      type: 'PublicKey',
      javaThrows: [ 'java.io.IOException', 'java.security.NoSuchAlgorithmException', 'java.security.spec.InvalidKeySpecException' ],
      javaCode: `
HttpsURLConnection conn = null;

try {
  var url = new URL(getCertificateURL());
  conn = (HttpsURLConnection) url.openConnection();
  conn.setConnectTimeout(5000);
  conn.setReadTimeout(5000);
  conn.setRequestMethod("GET");
  conn.connect();

  int responseCode = conn.getResponseCode();
  if ( responseCode != 200 ) {
    throw new RuntimeException("Failed to fetch provider certificates, response code: " + responseCode);
  }

  JsonArray keys = null;
  try ( var in = conn.getInputStream() ) {
    var jsonReader = Json.createReader(conn.getInputStream());
    var jwks = jsonReader.readObject();
    keys = jwks.getJsonArray("keys");
  }

  if ( keys == null ) {
    throw new RuntimeException("No keys found in certificate response");
  }

  // Find matching key in jwks
  JsonObject matchingKey = null;
  for ( int i = 0 ; i < keys.size() ; i++ ) {
    var key = keys.getJsonObject(i);
    if ( kid.equals(key.getString("kid", null)) ) {
      matchingKey = key;
      break;
    }
  }

  if ( matchingKey == null ) {
    throw new RuntimeException("Key not found");
  }

  String kty = matchingKey.getString("kty", null);
  if ( ! "RSA".equals(kty) ) {
    throw new RuntimeException("Unsupported public key type");
  }

  String n = matchingKey.getString("n", null);
  String e = matchingKey.getString("e", null);
  if ( SafetyUtil.isEmpty(n) || SafetyUtil.isEmpty(e) ) {
    throw new RuntimeException("Missing RSA parameters");
  }

  var modulus = new BigInteger(1, Base64.getUrlDecoder().decode(n));
  var exponent = new BigInteger(1, Base64.getUrlDecoder().decode(e));

  var spec = new RSAPublicKeySpec(modulus, exponent);
  var keyFactory = KeyFactory.getInstance("RSA");
  return keyFactory.generatePublic(spec);
} catch ( Exception e ) {
  throw e;
} finally {
  if ( conn != null ) {
    conn.disconnect();
  }
}
`
    }
  ]
});
