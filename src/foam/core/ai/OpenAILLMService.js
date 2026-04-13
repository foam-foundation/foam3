/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'OpenAILLMService',

  implements: [ 'foam.core.ai.LLMService' ],

  documentation: 'OpenAI implementation of LLMService. Server-side only (Java).',

  javaImports: [
    'foam.lang.X',
    'foam.core.ai.CompletionRequest',
    'foam.core.ai.CompletionResponse',
    'foam.core.ai.ChatMessage',
    'foam.core.ai.LLMOptions',
    'java.io.BufferedReader',
    'java.io.InputStreamReader',
    'java.io.OutputStream',
    'java.net.HttpURLConnection',
    'java.net.URL',
    'org.json.JSONArray',
    'org.json.JSONObject'
  ],

  properties: [
    {
      class: 'String',
      name: 'apiKey'
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
        JSONArray apiMessages = new JSONArray();

        String systemPrompt = options.getSystemPrompt();
        if ( systemPrompt != null && ! systemPrompt.isEmpty() ) {
          JSONObject sys = new JSONObject();
          sys.put("role", "system");
          sys.put("content", systemPrompt);
          apiMessages.put(sys);
        }

        for ( ChatMessage m : messages ) {
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
      type: 'foam.core.ai.CompletionResponse',
      args: 'Context x, Object messages, foam.core.ai.LLMOptions options',
      javaCode: `
        String model = options.getModel();
        if ( model == null || model.isEmpty() ) model = getDefaultModel();
        int maxTokens = options.getMaxTokens() > 0 ? options.getMaxTokens() : 4096;

        JSONObject body = new JSONObject();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("messages",   (JSONArray) messages);

        if ( options.getTemperature() > 0 ) {
          body.put("temperature", options.getTemperature());
        }

        HttpURLConnection conn = null;
        try {
          URL url = new URL(getBaseURL());
          conn = (HttpURLConnection) url.openConnection();
          conn.setRequestMethod("POST");
          conn.setRequestProperty("Content-Type",  "application/json");
          conn.setRequestProperty("Authorization", "Bearer " + getApiKey());
          conn.setDoOutput(true);

          try ( OutputStream os = conn.getOutputStream() ) {
            os.write(body.toString().getBytes("UTF-8"));
          }

          int status = conn.getResponseCode();
          if ( status != 200 ) {
            BufferedReader err = new BufferedReader(
              new InputStreamReader(conn.getErrorStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ( ( line = err.readLine() ) != null ) sb.append(line);
            err.close();
            throw new RuntimeException(
              "OpenAI API error (" + status + "): " + sb.toString());
          }

          BufferedReader reader = new BufferedReader(
            new InputStreamReader(conn.getInputStream(), "UTF-8"));
          StringBuilder sb = new StringBuilder();
          String line;
          while ( ( line = reader.readLine() ) != null ) sb.append(line);
          reader.close();

          JSONObject data   = new JSONObject(sb.toString());
          JSONArray  choices = data.optJSONArray("choices");
          JSONObject choice  = choices != null && choices.length() > 0
            ? choices.getJSONObject(0) : null;

          CompletionResponse response = new CompletionResponse();
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
        } finally {
          if ( conn != null ) conn.disconnect();
        }
      `
    }
  ]
});
