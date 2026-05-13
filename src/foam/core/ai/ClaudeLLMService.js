/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'ClaudeLLMService',

  implements: [ 'foam.core.ai.LLMService' ],

  documentation: `
    Anthropic Claude implementation of LLMService.
    API key is injected via CSpec config — never exposed to client.
    Server-side only (Java).
  `,

  javaImports: [
    'foam.lang.X',
    'foam.core.ai.*',
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
      name: 'apiKey',
      documentation: 'Anthropic API key. Injected from CSpec/environment.'
    },
    {
      class: 'String',
      name: 'defaultModel',
      value: 'claude-sonnet-4-20250514'
    },
    {
      class: 'String',
      name: 'baseURL',
      value: 'https://api.anthropic.com/v1/messages'
    },
    {
      class: 'String',
      name: 'apiVersion',
      value: '2023-06-01'
    }
  ],

  methods: [
    {
      name: 'complete',
      javaCode: `
        JSONArray messages = new JSONArray();
        JSONObject msg = new JSONObject();
        msg.put("role", "user");
        msg.put("content", request.getPrompt());
        messages.put(msg);

        return doRequest(x, messages, request.getOptions());
      `
    },
    {
      name: 'chat',
      type: 'foam.core.ai.CompletionResponse',
      args: 'Context x, ChatMessage[] messages, LLMOptions options',
      javaCode: `
        JSONArray apiMessages = new JSONArray();

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
      args: 'Context x, Object messages, LLMOptions options',
      javaCode: `
        String model     = options.getModel();
        if ( model == null || model.isEmpty() ) model = getDefaultModel();
        int    maxTokens = options.getMaxTokens() > 0 ? options.getMaxTokens() : 4096*2;

        // Build request body
        JSONObject body = new JSONObject();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("messages",   (JSONArray) messages);

        if ( options.getTemperature() > 0 ) {
          body.put("temperature", options.getTemperature());
        }

        String systemPrompt = options.getSystemPrompt();
        if ( systemPrompt != null && ! systemPrompt.isEmpty() ) {
          body.put("system", systemPrompt);
        }

        // HTTP request
        HttpURLConnection conn = null;
        try {
          URL url = new URL(getBaseURL());
          conn = (HttpURLConnection) url.openConnection();
          conn.setRequestMethod("POST");
          conn.setRequestProperty("Content-Type",      "application/json");
          conn.setRequestProperty("x-api-key",         getApiKey());
          conn.setRequestProperty("anthropic-version",  getApiVersion());
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
              "Claude API error (" + status + "): " + sb.toString());
          }

          // Read response
          BufferedReader reader = new BufferedReader(
            new InputStreamReader(conn.getInputStream(), "UTF-8"));
          StringBuilder sb = new StringBuilder();
          String line;
          while ( ( line = reader.readLine() ) != null ) sb.append(line);
          reader.close();

          JSONObject data = new JSONObject(sb.toString());

          // Extract text content blocks
          JSONArray content = data.getJSONArray("content");
          StringBuilder text = new StringBuilder();
          for ( int i = 0 ; i < content.length() ; i++ ) {
            JSONObject block = content.getJSONObject(i);
            if ( "text".equals(block.getString("type")) ) {
              if ( text.length() > 0 ) text.append("\\n");
              text.append(block.getString("text"));
            }
          }

          // Build response
          CompletionResponse response = new CompletionResponse();
          response.setContent(text.toString());
          response.setModel(data.optString("model", ""));
          response.setStopReason(data.optString("stop_reason", ""));

          JSONObject usage = data.optJSONObject("usage");
          if ( usage != null ) {
            response.setInputTokens(usage.optInt("input_tokens", 0));
            response.setOutputTokens(usage.optInt("output_tokens", 0));
          }

          return response;
        } catch ( RuntimeException e ) {
          throw e;
        } catch ( Exception e ) {
          throw new RuntimeException("Claude API request failed: " + e.getMessage(), e);
        } finally {
          if ( conn != null ) conn.disconnect();
        }
      `
    }
  ]
});
