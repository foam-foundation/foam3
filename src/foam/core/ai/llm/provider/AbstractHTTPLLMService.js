/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm.provider',
  name: 'AbstractHTTPLLMService',
  abstract: true,

  implements: [ 'foam.ai.llm.LLMService' ],

  documentation: `
    What every HTTP model provider does around its own request format: streams the reply
    and reports how much of it is written to an LLMProgress found in the context under
    "llmProgress"; retries rate limits, overloads and refused connections with backoff
    (or the server's retry-after); bounds the connect and each read; and keeps the
    provider's error text, which names its model and account, in the log, giving the
    caller a plain message instead.

    A subclass builds the body (requestBody), the headers (requestHeaders), reads its
    stream back into the reply a call without streaming returns (readStream), and reads
    that reply (parseReply).
  `,

  javaImports: [
    'foam.ai.llm.*',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.util.SafetyUtil',
    'java.io.BufferedReader',
    'java.io.IOException',
    'java.io.InputStream',
    'java.io.InputStreamReader',
    'java.io.InterruptedIOException',
    'java.io.OutputStream',
    'java.io.Reader',
    'java.net.ConnectException',
    'java.net.HttpURLConnection',
    'java.net.URL',
    'java.nio.charset.StandardCharsets',
    'java.util.LinkedHashMap',
    'java.util.Map',
    'org.json.JSONArray',
    'org.json.JSONObject'
  ],

  javaCode: `
    /** An error the stream reported before any content: send retries it, as an HTTP 529. */
    public static class EarlyStreamError extends IOException {
      public EarlyStreamError(String message) { super(message); }
    }

    /**
     * Tells an LLMProgress how much of the reply is written, at most once a second: a
     * reply streams in as thousands of small pieces, and each report may write to a DAO.
     * One token is taken as four characters.
     */
    public static class Written {
      private final LLMProgress progress_;
      private long chars_     = 0;
      private long last_      = 0;
      private long lastAlive_ = 0;

      public Written(LLMProgress progress) { progress_ = progress; }

      public void chars(int n) {
        chars_ += n;
        if ( progress_ == null || chars_ < 4 ) return;
        long now = System.currentTimeMillis();
        if ( now - last_ < 1000 ) return;
        last_ = now;
        progress_.written((int) ( chars_ / 4 ));
      }

      /**
       * Any event of the stream, such as a piece of the model's thinking or a keep-alive.
       * A model can think for a minute before it writes a word, and a listener that hears
       * nothing in that minute cannot end a call nobody waits for any more. So the listener
       * is told the count again, unchanged, after a second without a report.
       */
      public void alive() {
        if ( progress_ == null ) return;
        long now = System.currentTimeMillis();
        if ( now - last_ < 1000 || now - lastAlive_ < 1000 ) return;
        lastAlive_ = now;
        progress_.written((int) ( chars_ / 4 ));
      }
    }

    /** The payload of the next "data:" line of a server-sent event stream; null at its
     *  end. An empty "data:" line is a keep-alive and is skipped. */
    public static String nextData(BufferedReader in) throws IOException {
      for ( String line ; ( line = in.readLine() ) != null ; ) {
        if ( ! line.startsWith("data:") ) continue;
        String data = line.substring(5).trim();
        if ( ! data.isEmpty() ) return data;
      }
      return null;
    }

    /** JSON text as an object; {} when it is not one, as a tool's arguments cut short. */
    public static JSONObject object(String json) {
      try {
        return SafetyUtil.isEmpty(json) ? new JSONObject() : new JSONObject(json);
      } catch (org.json.JSONException e) {
        return new JSONObject();
      }
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'baseURL'
    },
    {
      class: 'String',
      name: 'defaultModel'
    },
    {
      class: 'Int',
      name: 'connectTimeout',
      value: 30000,
      units: 'ms'
    },
    {
      class: 'Int',
      name: 'readTimeout',
      value: 600000,
      units: 'ms',
      documentation: 'The longest wait for the next piece of a streamed reply, not for the whole of it.'
    },
    {
      class: 'Int',
      name: 'maxRetries',
      value: 3
    },
    {
      class: 'Map',
      name: 'headers',
      documentation: 'Extra headers sent on every call, e.g. a beta feature flag.'
    },
    {
      class: 'Boolean',
      name: 'identityHeaders',
      documentation: `
        Send X-User-Id (the signed-in person's user name, the real user when an admin acts
        as someone else, else "system"), X-Session-Id and X-Agent-Name from the options,
        so a gateway shared under one key can report usage per person and per feature.
      `
    }
  ],

  methods: [
    {
      name: 'chat',
      javaCode: `
        return call(x, apiMessages(request.getOptions().getSystemPrompt(), request.getMessages()), request.getOptions());
      `
    },
    {
      name: 'complete',
      javaCode: `
        ChatMessage msg = new ChatMessage();
        msg.setRole(ChatRole.USER);
        msg.setContent(request.getPrompt());
        return call(x, apiMessages(request.getOptions().getSystemPrompt(), new ChatMessage[] { msg }), request.getOptions());
      `
    },
    {
      name: 'apiMessages',
      abstract: true,
      type: 'Object',
      args: 'String systemPrompt, foam.ai.llm.ChatMessage[] messages'
    },
    {
      name: 'requestBody',
      abstract: true,
      type: 'Object',
      args: 'Object messages, foam.ai.llm.LLMOptions options'
    },
    {
      name: 'parseReply',
      abstract: true,
      type: 'foam.ai.llm.LLMResponse',
      args: 'Object reply'
    },
    {
      name: 'providerHeaders',
      abstract: true,
      documentation: "The provider's own headers: its key and API version.",
      type: 'Map',
      args: 'Context x'
    },
    {
      name: 'readStream',
      abstract: true,
      documentation: 'The streamed reply rebuilt as the reply a call without streaming returns; throws when the stream ends early.',
      type: 'Object',
      javaThrows: [ 'java.io.IOException' ],
      args: 'java.io.BufferedReader in, foam.ai.llm.LLMProgress progress'
    },
    {
      name: 'call',
      type: 'foam.ai.llm.LLMResponse',
      args: 'Context x, Object messages, foam.ai.llm.LLMOptions options',
      javaCode: `
        JSONObject body = (JSONObject) requestBody(messages, options);
        LLMProgress progress = (LLMProgress) x.get("llmProgress");
        JSONObject reply;
        try {
          reply = send(x, body, requestHeaders(x, options), progress);
        } catch (IOException e) {
          Loggers.logger(x, this).error("Model call failed", "model", body.optString("model"), e);
          // the provider's text names its model and account: it stays in the log
          throw new RuntimeException("The AI service could not be reached", e);
        }
        if ( reply == null ) throw new RuntimeException("The AI service sent a reply that could not be read");
        LLMResponse response = parseReply(reply);
        if ( "refusal".equals(response.getStopReason()) ) throw new RuntimeException("The AI service declined the request");
        return response;
      `
    },
    {
      name: 'requestHeaders',
      type: 'Map',
      args: 'Context x, foam.ai.llm.LLMOptions options',
      javaCode: `
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Content-Type", "application/json");
        headers.putAll((Map<String, String>) providerHeaders(x));
        if ( getHeaders() != null ) {
          for ( Object e : getHeaders().entrySet() ) {
            Map.Entry h = (Map.Entry) e;
            headers.put(String.valueOf(h.getKey()), String.valueOf(h.getValue()));
          }
        }
        if ( getIdentityHeaders() ) {
          Subject subject = (Subject) x.get("subject");
          User    user    = subject == null ? null : subject.getRealUser();
          headers.put("X-User-Id", user == null ? "system"
            : SafetyUtil.isEmpty(user.getUserName()) ? String.valueOf(user.getId()) : user.getUserName());
          if ( ! SafetyUtil.isEmpty(options.getSessionId()) ) headers.put("X-Session-Id", options.getSessionId());
          if ( ! SafetyUtil.isEmpty(options.getAgentName()) ) headers.put("X-Agent-Name", options.getAgentName());
        }
        return headers;
      `
    },
    {
      name: 'send',
      documentation: `
        POSTs the body and reads the streamed reply back into one reply, retrying rate
        limits, overloads and refused connections. Once the reply has started, a failure
        is not retried: a retry would write the reply a second time.
      `,
      type: 'org.json.JSONObject',
      javaThrows: [ 'java.io.IOException' ],
      args: 'Context x, org.json.JSONObject body, Map headers, foam.ai.llm.LLMProgress progress',
      javaCode: `
        Logger logger = Loggers.logger(x, this);
        byte[] bytes  = body.toString().getBytes(StandardCharsets.UTF_8);
        for ( int attempt = 0 ; ; attempt++ ) {
          HttpURLConnection conn = null;
          try {
            conn = (HttpURLConnection) new URL(getBaseURL()).openConnection();
            conn.setRequestMethod("POST");
            for ( Object e : headers.entrySet() ) {
              Map.Entry h = (Map.Entry) e;
              conn.setRequestProperty((String) h.getKey(), (String) h.getValue());
            }
            conn.setDoOutput(true);
            conn.setConnectTimeout(getConnectTimeout());
            conn.setReadTimeout(getReadTimeout());
            try ( OutputStream os = conn.getOutputStream() ) {
              os.write(bytes);
            }
            int status = conn.getResponseCode();
            if ( status == HttpURLConnection.HTTP_OK ) {
              try ( BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)) ) {
                return (JSONObject) readStream(in, progress);
              }
            }
            String error = read(conn.getErrorStream());
            if ( ! retryable(status) || attempt >= getMaxRetries() ) {
              throw new IOException("HTTP error " + status + ": " + error);
            }
            long wait = backoff(attempt, conn.getHeaderField("retry-after"));
            logger.warning("Model busy, retrying", "status", status, "attempt", attempt + 1, "waitMs", wait);
            pause(wait);
          } catch (ConnectException | EarlyStreamError e) {
            if ( attempt >= getMaxRetries() ) throw e;
            long wait = backoff(attempt, null);
            logger.warning("Model unreachable or busy, retrying", "error", e.getMessage(), "attempt", attempt + 1, "waitMs", wait);
            pause(wait);
          } finally {
            if ( conn != null ) conn.disconnect();
          }
        }
      `
    },
    {
      name: 'retryable',
      type: 'Boolean',
      args: 'int status',
      javaCode: `
        return status == 429 || status == 500 || status == 502 || status == 503 || status == 504 || status == 529;
      `
    },
    {
      name: 'backoff',
      documentation: "The wait before a retry: the server's retry-after in seconds, at most 60 s, else 1 s doubling per attempt plus up to 0.5 s, at most 30 s.",
      type: 'Long',
      args: 'int attempt, String retryAfter',
      javaCode: `
        if ( ! SafetyUtil.isEmpty(retryAfter) ) {
          try {
            return Math.min(60000, Long.parseLong(retryAfter.trim()) * 1000);
          } catch (NumberFormatException e) {
            // an HTTP-date form: fall through to our own schedule
          }
        }
        return Math.min(30000, (1000L << attempt) + (long) ( Math.random() * 500 ));
      `
    },
    {
      name: 'pause',
      javaThrows: [ 'java.io.IOException' ],
      args: 'long ms',
      javaCode: `
        try {
          Thread.sleep(ms);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          throw new InterruptedIOException("Interrupted while waiting to retry the AI service");
        }
      `
    },
    {
      name: 'read',
      visibility: 'protected',
      type: 'String',
      javaThrows: [ 'java.io.IOException' ],
      args: 'java.io.InputStream is',
      javaCode: `
        if ( is == null ) return "";
        try ( Reader r = new InputStreamReader(is, StandardCharsets.UTF_8) ) {
          StringBuilder sb = new StringBuilder();
          char[] buf = new char[8192];
          for ( int n ; ( n = r.read(buf) ) != -1 ; ) sb.append(buf, 0, n);
          return sb.toString();
        }
      `
    }
  ]
});
