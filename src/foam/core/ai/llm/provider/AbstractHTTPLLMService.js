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
    'java.io.Reader',
    'java.net.ConnectException',
    'java.net.SocketTimeoutException',
    'java.net.URI',
    'java.net.http.HttpClient',
    'java.net.http.HttpConnectTimeoutException',
    'java.net.http.HttpRequest',
    'java.net.http.HttpResponse',
    'java.nio.charset.StandardCharsets',
    'java.time.Duration',
    'java.util.LinkedHashMap',
    'java.util.Map',
    'java.util.concurrent.Executors',
    'java.util.concurrent.ScheduledExecutorService',
    'java.util.concurrent.ScheduledFuture',
    'java.util.concurrent.TimeUnit',
    'org.json.JSONArray',
    'org.json.JSONObject'
  ],

  javaCode: `
    /** An error the stream reported before any content: send retries it, as an HTTP 529. */
    public static class EarlyStreamError extends IOException {
      public EarlyStreamError(String message) { super(message); }
    }

    /** A reply other than 200 that send did not, or no longer, retry. */
    public static class StatusError extends IOException {
      public final int status;
      public StatusError(int status, String message) { super(message); this.status = status; }
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

      /** The end of the reply: its full count, however soon after the last report. */
      public void done() {
        if ( progress_ != null ) progress_.written((int) ( chars_ / 4 ));
      }

      /** What the gateway says the call waits on, from a ": status <text>" line. */
      public void status(String status) {
        if ( progress_ != null ) progress_.status(status);
      }
    }

    /**
     * The LLMProgress that send hands to readStream: it remembers the last count, so the
     * idle watchdog can tell the listener that count again while nothing arrives. Without
     * that, a call queued at a gateway that sends nothing never reaches the listener, and
     * a user's Stop is not heard until the reply starts, up to readTimeout later.
     */
    public static class Heartbeat implements LLMProgress {
      private final    LLMProgress progress_;
      private volatile int         tokens_ = 0;

      public Heartbeat(LLMProgress progress) { progress_ = progress; }

      public void written(int tokens) { tokens_ = tokens; progress_.written(tokens); }

      public void status(String status) { progress_.status(status); }

      /** The last count again: nothing new arrived, but the call is still open. */
      public void again() { progress_.written(tokens_); }
    }

    /**
     * A streamed reply's body that ends with a SocketTimeoutException when no byte arrives
     * for idleMs. HttpClient's own timeout covers the wait for the reply to start, but none
     * covers a stream that stops half way: a reply that pauses for 10 minutes would hang
     * the call for good. A timer checks the gap and closes the body, which ends a blocked read.
     *
     * The same timer runs quiet, when given, after each second with no byte. A quiet that
     * throws ends the call: the body is closed, and the blocked read throws that exception.
     * It runs on the timer's one thread, so it must return quickly.
     */
    public static class IdleTimeoutInputStream extends java.io.FilterInputStream {
      private static final ScheduledExecutorService TIMER = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "llm-idle-timeout");
        t.setDaemon(true);
        return t;
      });

      private final long               idleMs_;
      private final ScheduledFuture<?> check_;
      private final Runnable           quiet_;
      private volatile long            last_ = System.currentTimeMillis();
      private volatile long            lastQuiet_;
      private volatile boolean         timedOut_;
      private volatile RuntimeException stopped_;

      public IdleTimeoutInputStream(InputStream in, long idleMs) {
        this(in, idleMs, null);
      }

      public IdleTimeoutInputStream(InputStream in, long idleMs, Runnable quiet) {
        super(in);
        idleMs_ = idleMs;
        quiet_  = quiet;
        long every = Math.max(10, Math.min(1000, idleMs / 4));
        check_ = TIMER.scheduleWithFixedDelay(this::check, every, every, TimeUnit.MILLISECONDS);
      }

      private void check() {
        long now = System.currentTimeMillis();
        if ( now - last_ >= idleMs_ ) {
          timedOut_ = true;
        } else if ( quiet_ != null && now - last_ >= 1000 && now - lastQuiet_ >= 1000 ) {
          lastQuiet_ = now;
          try {
            quiet_.run();
            return;
          } catch (RuntimeException e) {
            stopped_ = e;
          }
        } else {
          return;
        }
        check_.cancel(false);
        try { in.close(); } catch (IOException e) { /* the reader learns it from its read */ }
      }

      public int read() throws IOException {
        byte[] one = new byte[1];
        return read(one, 0, 1) == -1 ? -1 : one[0] & 0xff;
      }

      public int read(byte[] b, int off, int len) throws IOException {
        int n;
        try {
          n = in.read(b, off, len);
        } catch (IOException e) {
          if ( stopped_ != null ) throw stopped_;
          if ( timedOut_ ) throw timeout();
          throw e;
        }
        if ( n == -1 && stopped_ != null ) throw stopped_;
        if ( n == -1 && timedOut_ ) throw timeout();
        last_ = System.currentTimeMillis();
        return n;
      }

      private SocketTimeoutException timeout() {
        return new SocketTimeoutException("No part of the reply for " + idleMs_ + " ms");
      }

      public void close() throws IOException {
        check_.cancel(false);
        in.close();
      }
    }

    /** The payload of the next "data:" line of a server-sent event stream; null at its
     *  end. An empty "data:" line or a ": keep-alive" comment is skipped, but still tells
     *  the listener the call is alive. A ": status queued ahead=2" comment, which a gateway
     *  sends while the call waits, tells the listener the stage. */
    public static String nextData(BufferedReader in, Written written) throws IOException {
      for ( String line ; ( line = in.readLine() ) != null ; ) {
        written.alive();
        if ( line.startsWith(": status ") ) written.status(line.substring(9).trim());
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

    /** A tool's input schema as JSON. Both APIs require one, so a tool that takes no
     *  input gets {"type":"object","properties":{}}. */
    public static JSONObject inputSchema(LLMTool t) {
      return SafetyUtil.isEmpty(t.getInputSchema())
        ? new JSONObject().put("type", "object").put("properties", new JSONObject())
        : new JSONObject(t.getInputSchema());
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
      documentation: 'The longest wait for the reply to start, then for each next piece of it, not for the whole of it.'
    },
    {
      class: 'Object',
      name: 'httpClient',
      javaType: 'java.net.http.HttpClient',
      visibility: 'HIDDEN',
      transient: true,
      documentation: `
        One client for every call, so calls reuse its connections. HTTP/1.1, because on a
        plain http:// URL HttpClient's default HTTP/2 sends an "Upgrade: h2c" request, which
        an OpenAI-compatible gateway served by uvicorn rejects with 400 "Invalid HTTP request
        received".
      `,
      javaFactory: `
        return HttpClient.newBuilder()
          .version(HttpClient.Version.HTTP_1_1)
          .connectTimeout(Duration.ofMillis(getConnectTimeout()))
          .build();
      `
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
          // the provider's text names its model and account: it stays in the log, and the
          // caller learns only which kind of failure it was, e.g. a revoked key is HTTP 401
          if ( e instanceof EarlyStreamError || e instanceof StatusError && retryable(((StatusError) e).status) ) {
            throw new RuntimeException("The AI service is busy and did not answer after " + ( getMaxRetries() + 1 ) + " tries", e);
          }
          if ( e instanceof StatusError ) {
            throw new RuntimeException("The AI service refused the request (HTTP " + ((StatusError) e).status + ")", e);
          }
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
      name: 'requestURL',
      documentation: `
        Where send posts the request, read on every call: baseURL. A provider whose
        endpoint can change while the server runs overrides it.
      `,
      type: 'String',
      javaCode: 'return getBaseURL();'
    },
    {
      name: 'send',
      documentation: `
        POSTs the body and reads the streamed reply back into one reply, retrying rate
        limits, overloads, refused connections and connections that time out before the
        request is sent. Once the request is sent, a timeout is not retried: the model may
        be writing the reply already. Once the reply has started, a failure is not retried:
        a retry would write the reply a second time.
      `,
      type: 'org.json.JSONObject',
      javaThrows: [ 'java.io.IOException' ],
      args: 'Context x, org.json.JSONObject body, Map headers, foam.ai.llm.LLMProgress progress',
      javaCode: `
        Logger              logger  = Loggers.logger(x, this);
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(requestURL()))
          .timeout(Duration.ofMillis(getReadTimeout()))
          .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8));
        for ( Object e : headers.entrySet() ) {
          Map.Entry h = (Map.Entry) e;
          builder.header((String) h.getKey(), (String) h.getValue());
        }
        HttpRequest request = builder.build();
        for ( int attempt = 0 ; ; attempt++ ) {
          try {
            HttpResponse<InputStream> resp = getHttpClient().send(request, HttpResponse.BodyHandlers.ofInputStream());
            int status = resp.statusCode();
            if ( status == 200 ) {
              Heartbeat beat = progress == null ? null : new Heartbeat(progress);
              try ( BufferedReader in = new BufferedReader(new InputStreamReader(
                      new IdleTimeoutInputStream(resp.body(), getReadTimeout(), beat == null ? null : beat::again),
                      StandardCharsets.UTF_8)) ) {
                return (JSONObject) readStream(in, beat);
              }
            }
            // an error reply can stall too, e.g. a proxy that sends 502 and then nothing
            String error = read(new IdleTimeoutInputStream(resp.body(), getReadTimeout()));
            if ( ! retryable(status) || attempt >= getMaxRetries() ) {
              throw new StatusError(status, "HTTP error " + status + ": " + error);
            }
            long wait = backoff(attempt, resp.headers().firstValue("retry-after").orElse(null));
            logger.warning("Model busy, retrying", "status", status, "attempt", attempt + 1, "waitMs", wait);
            pause(wait, progress);
          } catch (ConnectException | HttpConnectTimeoutException | EarlyStreamError e) {
            retry(logger, e, attempt, progress);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new InterruptedIOException("Interrupted while calling the AI service");
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
      name: 'retry',
      documentation: 'Waits before the next attempt after a failure send retries, or rethrows it once the retries are used up.',
      visibility: 'protected',
      javaThrows: [ 'java.io.IOException' ],
      args: 'foam.core.logger.Logger logger, java.io.IOException e, int attempt, foam.ai.llm.LLMProgress progress',
      javaCode: `
        if ( attempt >= getMaxRetries() ) throw e;
        long wait = backoff(attempt, null);
        logger.warning("Model unreachable or busy, retrying", "error", e.getMessage(), "attempt", attempt + 1, "waitMs", wait);
        pause(wait, progress);
      `
    },
    {
      name: 'pause',
      documentation: `
        Waits before a retry, telling the listener about once a second that nothing is
        written yet, so a listener that throws ends the call during a 60 s wait as well.
      `,
      javaThrows: [ 'java.io.IOException' ],
      args: 'long ms, foam.ai.llm.LLMProgress progress',
      javaCode: `
        try {
          for ( long end = System.currentTimeMillis() + ms ; ; ) {
            if ( progress != null ) progress.written(0);
            long left = end - System.currentTimeMillis();
            if ( left <= 0 ) return;
            Thread.sleep(Math.min(1000, left));
          }
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
