/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm.provider.test',
  name: 'OpenAICredentialURLTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Where chat and embedding calls go when the OpenAI credential has a url, against two
    local servers that record each request's path: a url sends them to that
    OpenAI-compatible endpoint, a changed url takes effect on the next call, no url keeps
    OpenAI's endpoint, and a baseURL set on the instance or declared by a subclass (Ollama,
    DeepSeek) still wins. A key set on the instance with setApiKey is sent as given and
    needs no credential row.
  `,

  javaImports: [
    'com.sun.net.httpserver.HttpServer',
    'foam.ai.llm.*',
    'foam.core.ai.llm.provider.ClaudeLLMService',
    'foam.core.ai.llm.provider.DeepSeekLLMService',
    'foam.core.ai.llm.provider.OllamaLLMService',
    'foam.core.ai.llm.provider.OpenAILLMService',
    'foam.core.ai.vector.provider.OpenAIEmbeddingServiceImpl',
    'foam.core.auth.APIKeyCredential',
    'foam.core.auth.Credential',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.net.InetSocketAddress',
    'java.nio.charset.StandardCharsets',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        List<String> pathsA = Collections.synchronizedList(new ArrayList<>());
        List<String> pathsB = Collections.synchronizedList(new ArrayList<>());
        List<String> auths  = Collections.synchronizedList(new ArrayList<>());
        HttpServer a = stub(pathsA, auths);
        HttpServer b = stub(pathsB, auths);
        String urlA = "http://127.0.0.1:" + a.getAddress().getPort();
        String urlB = "http://127.0.0.1:" + b.getAddress().getPort();

        DAO credentialDAO = new MDAO(Credential.getOwnClassInfo());
        X   tx            = x.put("credentialDAO", credentialDAO);
        credential(credentialDAO, "foam/llm/openai", urlA);

        OpenAILLMService openai = new OpenAILLMService() {
          public String getApiKey() { return "test-key"; }
        };
        openai.setX(tx);
        OpenAIEmbeddingServiceImpl embeddings = new OpenAIEmbeddingServiceImpl(tx);

        try {
          // a credential url sends the call to <url>/v1/chat/completions
          expect(openai.chat(tx, chat("Hi")).getContent(), "ok", "url A: the reply is read");
          expect(String.join(",", pathsA), "/v1/chat/completions", "url A: one request to /v1/chat/completions on A");

          expect(embeddings.embed(tx, "hello").getVector()[0], 0.5f, "embeddings, url A: the vector is read");
          expect(pathsA.get(pathsA.size() - 1), "/v1/embeddings", "embeddings, url A: the request goes to /v1/embeddings on A");

          // a url changed between two calls sends the second call to the new url
          credential(credentialDAO, "foam/llm/openai", urlB);
          pathsA.clear();
          expect(openai.chat(tx, chat("Hi")).getContent(), "ok", "url B: the reply is read");
          expect(String.join(",", pathsB), "/v1/chat/completions", "url B: the second call goes to B");
          test(pathsA.isEmpty(), "url B: nothing more reaches A, got " + pathsA);

          embeddings.embed(tx, "hello");
          expect(pathsB.get(pathsB.size() - 1), "/v1/embeddings", "embeddings, url B: the second call goes to B");
          test(pathsA.isEmpty(), "embeddings, url B: nothing more reaches A, got " + pathsA);

          // a key changed on the credential is sent on the next embeddings call
          APIKeyCredential rotated = (APIKeyCredential) ((APIKeyCredential) credentialDAO.find("foam/llm/openai")).fclone();
          rotated.setApiKey("key-2");
          credentialDAO.put(rotated);
          embeddings.embed(tx, "hello");
          expect(auths.get(auths.size() - 1), "Bearer key-2", "embeddings: a changed key is used on the next call");

          // a url saved with a trailing slash gives one slash before /v1
          credential(credentialDAO, "foam/llm/openai", urlB + "/");
          expect(openai.requestURL(), urlB + "/v1/chat/completions", "trailing slash: chat url has one slash");
          expect(embeddings.getEndpoint(), urlB + "/v1/embeddings", "trailing slash: embeddings url has one slash");

          // a baseURL set on the instance wins over the credential url
          OpenAILLMService explicit = new OpenAILLMService() {
            public String getApiKey() { return "test-key"; }
          };
          explicit.setX(tx);
          explicit.setBaseURL(urlA + "/explicit");
          pathsB.clear();
          expect(explicit.chat(tx, chat("Hi")).getContent(), "ok", "explicit baseURL: the reply is read");
          expect(String.join(",", pathsA), "/explicit", "explicit baseURL: the call goes to the instance's baseURL on A");
          test(pathsB.isEmpty(), "explicit baseURL: nothing reaches the credential url B, got " + pathsB);

          OpenAIEmbeddingServiceImpl explicitEmbeddings = new OpenAIEmbeddingServiceImpl(tx);
          explicitEmbeddings.setEndpoint(urlA + "/explicit");
          expect(explicitEmbeddings.getEndpoint(), urlA + "/explicit", "embeddings, explicit endpoint: wins over the credential url");

          // Ollama and DeepSeek keep the baseURL they declare, whatever the credentials hold
          OllamaLLMService ollama = new OllamaLLMService();
          ollama.setX(tx);
          expect(ollama.requestURL(), "http://localhost:11434/v1/chat/completions", "ollama: ignores the url on foam/llm/openai");
          DeepSeekLLMService deepseek = new DeepSeekLLMService();
          deepseek.setX(tx);
          credential(credentialDAO, "foam/llm/deepseek", urlB);
          expect(deepseek.requestURL(), "https://api.deepseek.com/chat/completions", "deepseek: ignores a url on its own credential");

          // with no url, and with no credential at all, the default is used
          credential(credentialDAO, "foam/llm/openai", "");
          expect(openai.requestURL(), "https://api.openai.com/v1/chat/completions", "no url: OpenAI's endpoint");
          expect(embeddings.getEndpoint(), "https://api.openai.com/v1/embeddings", "embeddings, no url: OpenAI's endpoint");

          credentialDAO.remove(credentialDAO.find("foam/llm/openai"));
          expect(openai.requestURL(), "https://api.openai.com/v1/chat/completions", "no credential: OpenAI's endpoint");
          expect(embeddings.getEndpoint(), "https://api.openai.com/v1/embeddings", "embeddings, no credential: OpenAI's endpoint");
          expect(ollama.requestURL(), "http://localhost:11434/v1/chat/completions", "ollama, no credential: its own endpoint, no error");

          // a baseURL and key set in code need no credential row, and the key set is the one sent
          OpenAILLMService coded = new OpenAILLMService();
          coded.setX(tx);
          coded.setBaseURL(urlA + "/coded");
          coded.setApiKey("coded-key");
          expect(coded.chat(tx, chat("Hi")).getContent(), "ok", "key set in code: the reply is read with no credential row");
          expect(auths.get(auths.size() - 1), "Bearer coded-key", "key set in code: that key is sent");

          OpenAIEmbeddingServiceImpl codedEmbeddings = new OpenAIEmbeddingServiceImpl(tx);
          codedEmbeddings.setEndpoint(urlA + "/coded/v1/embeddings");
          codedEmbeddings.setApiKey("coded-key");
          codedEmbeddings.embed(tx, "hello");
          expect(auths.get(auths.size() - 1), "Bearer coded-key", "embeddings, key set in code: that key is sent");

          ClaudeLLMService claude = new ClaudeLLMService();
          claude.setX(tx);
          claude.setApiKey("coded-key");
          expect(claude.getApiKey(), "coded-key", "claude, key set in code: returned with no credential row");
        } finally {
          a.stop(0);
          b.stop(0);
        }
      `
    },
    {
      name: 'stub',
      documentation: 'A local server that records each request path and Authorization header, and answers as a chat-completions stream or an embeddings reply.',
      type: 'com.sun.net.httpserver.HttpServer',
      args: 'List paths, List auths',
      javaCode: `
        HttpServer server;
        try {
          server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (java.io.IOException e) {
          throw new RuntimeException(e);
        }
        server.createContext("/", ex -> {
          ex.getRequestBody().readAllBytes();
          String path = ex.getRequestURI().getPath();
          paths.add(path);
          auths.add(ex.getRequestHeaders().getFirst("Authorization"));
          String reply = path.endsWith("/embeddings")
            ? "{\\"data\\":[{\\"index\\":0,\\"embedding\\":[0.5]}]}"
            : "data: {\\"choices\\":[{\\"delta\\":{\\"content\\":\\"ok\\"}}]}\\n\\ndata: [DONE]\\n\\n";
          byte[] body = reply.getBytes(StandardCharsets.UTF_8);
          ex.sendResponseHeaders(200, body.length);
          ex.getResponseBody().write(body);
          ex.close();
        });
        server.start();
        return server;
      `
    },
    {
      name: 'credential',
      documentation: 'Puts the credential with this id and url, replacing any row already there.',
      args: 'foam.dao.DAO dao, String id, String url',
      javaCode: `
        APIKeyCredential cred = new APIKeyCredential();
        cred.setId(id);
        cred.setApiKey("test-key");
        cred.setUrl(url);
        dao.put(cred);
      `
    },
    {
      name: 'chat',
      type: 'foam.ai.llm.ChatRequest',
      args: 'String content',
      javaCode: `
        ChatMessage m = new ChatMessage();
        m.setRole(ChatRole.USER);
        m.setContent(content);
        ChatRequest request = new ChatRequest();
        request.setMessages(new ChatMessage[] { m });
        request.setOptions(new LLMOptions());
        return request;
      `
    }
  ]
});
