/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm.provider.test',
  name: 'LLMSendTest',
  extends: 'foam.core.test.Test',

  documentation: `
    The HTTP side of the providers, against a local server that answers each request with
    the next scripted reply: which failures are retried and how often, what the caller is
    told when retries run out, and that a listener that throws ends the call at once, even
    while the provider waits to retry.
  `,

  javaImports: [
    'com.sun.net.httpserver.HttpServer',
    'foam.ai.llm.*',
    'foam.core.ai.llm.provider.ClaudeLLMService',
    'foam.core.ai.llm.provider.OpenAILLMService',
    'java.net.InetSocketAddress',
    'java.nio.charset.StandardCharsets',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.List',
    'java.util.concurrent.atomic.AtomicInteger',
    'org.json.JSONArray',
    'org.json.JSONObject'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // each entry: { status, retry-after header or null, body }
        List<Object[]> replies = Collections.synchronizedList(new ArrayList<>());
        List<String>   bodies  = Collections.synchronizedList(new ArrayList<>());
        HttpServer server;
        try {
          server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (java.io.IOException e) {
          throw new RuntimeException(e);
        }
        server.createContext("/", ex -> {
          bodies.add(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
          Object[] r = replies.isEmpty() ? new Object[] { 500, null, "" } : replies.remove(0);
          if ( r[1] != null ) ex.getResponseHeaders().add("retry-after", (String) r[1]);
          byte[] b = ((String) r[2]).getBytes(StandardCharsets.UTF_8);
          ex.sendResponseHeaders((Integer) r[0], b.length == 0 ? -1 : b.length);
          if ( b.length > 0 ) ex.getResponseBody().write(b);
          ex.close();
        });
        server.start();
        String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/";

        ClaudeLLMService claude = new ClaudeLLMService() {
          public String getApiKey() { return "test-key"; }
        };
        claude.setBaseURL(url);
        claude.setMaxRetries(2);
        OpenAILLMService openai = new OpenAILLMService() {
          public String getApiKey() { return "test-key"; }
        };
        openai.setBaseURL(url);
        openai.setMaxRetries(2);

        String reply = sse(
          "{'type':'message_start','message':{'model':'m'}}",
          "{'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}}",
          "{'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':'twenty characters ok'}}",
          "{'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':' and twenty more ok.'}}",
          "{'type':'content_block_stop','index':0}",
          "{'type':'message_stop'}");
        String expected = "twenty characters ok and twenty more ok.";

        try {
          // a rate limit with retry-after is retried, and the same body is sent again
          replies.add(new Object[] { 429, "0", "" });
          replies.add(new Object[] { 200, null, reply });
          LLMResponse r = claude.chat(x, chat(ChatRole.USER, "Hi"));
          expect(r.getContent(), expected, "429 then 200: the reply is read");
          test(bodies.size() == 2 && bodies.get(0).equals(bodies.get(1)), "429 then 200: two requests with the same body");

          // a request the service refuses is not retried, and the caller learns its status
          bodies.clear();
          replies.add(new Object[] { 400, null, "{\\"error\\":{\\"message\\":\\"bad schema for account 123\\"}}" });
          expect(failure(claude, x, chat(ChatRole.USER, "Hi")), "The AI service refused the request (HTTP 400)", "400: refused, with its status and without the provider's text");
          test(bodies.size() == 1, "400: sent once, got " + bodies.size());

          // a busy service is retried maxRetries times, then the caller is told it is busy
          bodies.clear();
          for ( int i = 0 ; i < 3 ; i++ ) replies.add(new Object[] { 503, "0", "" });
          expect(failure(claude, x, chat(ChatRole.USER, "Hi")), "The AI service is busy and did not answer after 3 tries", "503 every time: busy after 3 tries");
          test(bodies.size() == 3, "503 every time: 1 try and 2 retries, got " + bodies.size());

          // an error in the stream before any content is retried
          bodies.clear();
          replies.add(new Object[] { 200, null, sse("{'type':'error','error':{'type':'overloaded_error'}}") });
          replies.add(new Object[] { 200, null, reply });
          expect(claude.chat(x, chat(ChatRole.USER, "Hi")).getContent(), expected, "claude: an early stream error is retried");
          test(bodies.size() == 2, "claude: early stream error, then the reply: 2 requests, got " + bodies.size());

          bodies.clear();
          replies.add(new Object[] { 200, null, sse("{'error':{'message':'overloaded'}}") });
          replies.add(new Object[] { 200, null, sse("{'choices':[{'delta':{'content':'ok'}}]}", "[DONE]") });
          expect(openai.chat(x, chat(ChatRole.USER, "Hi")).getContent(), "ok", "chat completions: an early stream error is retried");
          test(bodies.size() == 2, "chat completions: early stream error, then the reply: 2 requests, got " + bodies.size());

          // the listener hears the full count at the end, however soon after its last report
          int[] last = { -1 };
          replies.add(new Object[] { 200, null, reply });
          expect(claude.chat(x.put("llmProgress", (LLMProgress) tokens -> last[0] = tokens), chat(ChatRole.USER, "Hi")).getContent(), expected, "progress: the reply is read");
          test(last[0] == expected.length() / 4, "progress: the last report is the whole reply, " + expected.length() / 4 + " tokens, got " + last[0]);

          // a listener that throws ends the call during a retry wait, not after it
          bodies.clear();
          replies.add(new Object[] { 429, "30", "" });
          long start = System.currentTimeMillis();
          expect(failure(claude, x.put("llmProgress", (LLMProgress) tokens -> { throw new RuntimeException("stopped"); }), chat(ChatRole.USER, "Hi")),
            "stopped", "stop during a 30 s retry wait: the listener's exception reaches the caller");
          test(System.currentTimeMillis() - start < 5000 && bodies.size() == 1, "stop during a 30 s retry wait: ends at once, with no retry");

          // a listener that throws after text has come ends the call, with no retry
          bodies.clear();
          replies.add(new Object[] { 200, null, reply });
          expect(failure(claude, x.put("llmProgress", (LLMProgress) tokens -> { if ( tokens > 0 ) throw new RuntimeException("stopped"); }), chat(ChatRole.USER, "Hi")),
            "stopped", "stop after text: the listener's exception reaches the caller");
          test(bodies.size() == 1, "stop after text: sent once, got " + bodies.size());

          // Claude takes SYSTEM messages in the system prompt, not as turns
          bodies.clear();
          replies.add(new Object[] { 200, null, reply });
          ChatRequest withSystem = chat(ChatRole.USER, "Hi");
          withSystem.getOptions().setSystemPrompt("Be brief.");
          ChatMessage sys = new ChatMessage();
          sys.setRole(ChatRole.SYSTEM);
          sys.setContent("Answer in French.");
          withSystem.setMessages(new ChatMessage[] { sys, withSystem.getMessages()[0] });
          claude.chat(x, withSystem);
          JSONObject sent = new JSONObject(bodies.get(0));
          expect(sent.getString("system"), "Be brief.\\n\\nAnswer in French.", "claude: a SYSTEM message joins the system prompt");
          JSONArray turns = sent.getJSONArray("messages");
          test(turns.length() == 1 && "user".equals(turns.getJSONObject(0).getString("role")), "claude: no system turn among the messages: " + turns);
          expect(withSystem.getOptions().getSystemPrompt(), "Be brief.", "claude: the caller's options are left as they were");
        } finally {
          server.stop(0);
        }

        // nothing listening: the connection is refused, retried, then the caller is told
        claude.setMaxRetries(1);
        claude.setBaseURL(url);
        expect(failure(claude, x, chat(ChatRole.USER, "Hi")), "The AI service could not be reached", "connection refused: could not be reached");
      `
    },
    {
      name: 'sse',
      type: 'String',
      args: 'String... events',
      javaCode: `
        // fixtures write ' for " so they need no escaping
        StringBuilder sb = new StringBuilder();
        for ( String e : events ) sb.append("data: ").append(e.replace('\\'', '"')).append("\\n\\n");
        return sb.toString();
      `
    },
    {
      name: 'chat',
      type: 'foam.ai.llm.ChatRequest',
      args: 'foam.ai.llm.ChatRole role, String content',
      javaCode: `
        ChatMessage m = new ChatMessage();
        m.setRole(role);
        m.setContent(content);
        ChatRequest request = new ChatRequest();
        request.setMessages(new ChatMessage[] { m });
        request.setOptions(new LLMOptions());
        return request;
      `
    },
    {
      name: 'failure',
      documentation: 'The message the call failed with; null when it did not fail.',
      type: 'String',
      args: 'foam.ai.llm.LLMService service, Context x, foam.ai.llm.ChatRequest request',
      javaCode: `
        try {
          service.chat(x, request);
          return null;
        } catch (RuntimeException e) {
          return e.getMessage();
        }
      `
    }
  ]
});
