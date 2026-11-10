/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm.provider',
  name: 'OpenAILLMService',

  implements: [ 'foam.ai.llm.LLMService' ],

  documentation: 'OpenAI implementation of LLMService. Server-side only (Java).',

  javaImports: [
    'foam.core.auth.APIKeyCredential',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.ai.llm.*',
    'java.net.URI',
    'java.net.http.HttpClient',
    'java.net.http.HttpRequest',
    'java.net.http.HttpResponse',
    'java.time.Duration',
    'org.json.JSONArray',
    'org.json.JSONObject'
  ],

  properties: [
    {
      class: 'String',
      name: 'credentialId',
      value: 'foam/llm/openai'
    },
    {
      class: 'String',
      name: 'apiKey',
      javaFactory: `
        foam.core.auth.APIKeyCredential cred = (foam.core.auth.APIKeyCredential)
          ((foam.dao.DAO) getX().get("credentialDAO")).find(getCredentialId());
        if ( cred == null ) throw new RuntimeException("LLM credential not found: " + getCredentialId());
        return cred.getApiKeySecret(getX());
      `
    },
    {
      class: 'String',
      name: 'defaultModel',
      value: 'gpt-4o'
    },
    {
      class: 'String',
      name: 'baseURL',
      value: 'https://api.openai.com/v1/chat/completions'
    }
  ],

  methods: [
    {
      name: 'complete',
      javaCode: `
        JSONArray messages = new JSONArray();
        LLMOptions options = request.getOptions();

        String systemPrompt = options.getSystemPrompt();
        if ( systemPrompt != null && ! systemPrompt.isEmpty() ) {
          JSONObject sys = new JSONObject();
          sys.put("role", "system");
          sys.put("content", systemPrompt);
          messages.put(sys);
        }

        JSONObject msg = new JSONObject();
        msg.put("role", "user");
        msg.put("content", request.getPrompt());
        messages.put(msg);

        return doRequest(x, messages, options);
      `
    },
    {
      name: 'chat',
      javaCode: `
        JSONArray  apiMessages = new JSONArray();
        LLMOptions options     = request.getOptions();

        String systemPrompt = options.getSystemPrompt();
        if ( systemPrompt != null && ! systemPrompt.isEmpty() ) {
          JSONObject sys = new JSONObject();
          sys.put("role", "system");
          sys.put("content", systemPrompt);
          apiMessages.put(sys);
        }

        for ( ChatMessage m : request.getMessages() ) {
          JSONObject msg = new JSONObject();
          msg.put("role", m.getRole().getLabel());
          msg.put("content", m.getContent());
          apiMessages.put(msg);
        }

        return doRequest(x, apiMessages, options);
      `
    },
    {
      name: 'doRequest',
      visibility: 'protected',
      type: 'foam.ai.llm.LLMResponse',
      args: 'Context x, Object messages, LLMOptions options',
      javaCode: `
        String model = options.getModel();
        if ( model == null || model.isEmpty() ) model = getDefaultModel();
        int maxTokens = options.getMaxTokens() > 0 ? options.getMaxTokens() : 4096;

        JSONObject body = new JSONObject();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("messages",   (JSONArray) messages);
        if ( options.getTemperature() > 0.0 ) body.put("temperature", options.getTemperature());

        try {
          var client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
          var req = HttpRequest.newBuilder()
            .uri(URI.create(getBaseURL()))
            .header("Content-Type",  "application/json")
            .header("Authorization", "Bearer " + getApiKey())
            .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
            .timeout(Duration.ofSeconds(120))
            .build();

          var resp = client.send(req, HttpResponse.BodyHandlers.ofString());
          if ( resp.statusCode() != 200 )
            throw new RuntimeException("OpenAI API error (" + resp.statusCode() + "): " + resp.body());

          JSONObject data    = new JSONObject(resp.body());
          JSONArray  choices = data.optJSONArray("choices");
          JSONObject choice  = choices != null && choices.length() > 0
            ? choices.getJSONObject(0) : null;

          LLMResponse response = new LLMResponse();
          response.setContent(
            choice != null ? choice.getJSONObject("message").getString("content") : "");
          response.setModel(data.optString("model", ""));
          response.setStopReason(
            choice != null ? choice.optString("finish_reason", "") : "");

          JSONObject usage = data.optJSONObject("usage");
          if ( usage != null ) {
            response.setInputTokens(usage.optInt("prompt_tokens", 0));
            response.setOutputTokens(usage.optInt("completion_tokens", 0));
          }

          return response;
        } catch ( RuntimeException e ) {
          throw e;
        } catch ( Exception e ) {
          throw new RuntimeException("OpenAI API request failed: " + e.getMessage(), e);
        }
      `
    }
  ]
});
