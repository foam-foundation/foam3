/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm.provider',
  name: 'OpenAILLMService',

  extends: 'foam.core.ai.llm.provider.AbstractHTTPLLMService',

  documentation: `
    OpenAI implementation of LLMService, on the chat-completions API, which DeepSeek,
    Ollama and OpenAI-format gateways also speak. Server-side only (Java).
  `,

  javaImports: [
    'foam.core.auth.APIKeyCredential',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.ai.llm.*',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.List',
    'java.io.BufferedReader',
    'java.io.IOException',
    'java.util.HashMap',
    'java.util.LinkedHashMap',
    'java.util.Map',
    'java.util.TreeMap',
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
      documentation: 'Read from the credential on every call, so a key rotated in the vault is used on the next one.',
      javaGetter: `
        foam.core.auth.APIKeyCredential cred = (foam.core.auth.APIKeyCredential)
          ((foam.dao.DAO) getX().get("credentialDAO")).find(getCredentialId());
        if ( cred == null ) throw new RuntimeException("LLM credential not found: " + getCredentialId());
        return cred.getApiKeySecret(getX());
      `
    },
    {
      name: 'defaultModel',
      value: 'gpt-4o'
    },
    {
      name: 'baseURL',
      value: 'https://api.openai.com/v1/chat/completions'
    }
  ],

  methods: [
    {
      name: 'apiMessages',
      documentation: `
        The conversation in the chat-completions format: the system prompt as the first
        message; an assistant turn that called tools carries tool_calls, followed by one
        role "tool" message per call holding its result, before the next user text.
      `,
      type: 'Object',
      args: 'String systemPrompt, foam.ai.llm.ChatMessage[] messages',
      javaCode: `
        JSONArray out = new JSONArray();
        if ( ! SafetyUtil.isEmpty(systemPrompt) ) {
          JSONObject sys = new JSONObject();
          sys.put("role",    "system");
          sys.put("content", systemPrompt);
          out.put(sys);
        }
        LLMToolUse[] pending = null;
        for ( ChatMessage m : messages ) {
          if ( pending != null ) {
            toolResults(out, pending);
            pending = null;
          }
          JSONObject msg = new JSONObject();
          msg.put("role", m.getRole().getLabel());
          if ( m.getRole() == ChatRole.ASSISTANT && m.getToolUses().length > 0 ) {
            msg.put("content", SafetyUtil.isEmpty(m.getContent()) ? JSONObject.NULL : m.getContent());
            JSONArray calls = new JSONArray();
            for ( LLMToolUse u : m.getToolUses() ) {
              JSONObject fn = new JSONObject();
              fn.put("name",      u.getName());
              fn.put("arguments", SafetyUtil.isEmpty(u.getInputJson()) ? "{}" : u.getInputJson());
              JSONObject call = new JSONObject();
              call.put("id",       u.getId());
              call.put("type",     "function");
              call.put("function", fn);
              calls.put(call);
            }
            msg.put("tool_calls", calls);
            pending = m.getToolUses();
            out.put(msg);
            continue;
          }
          // a turn holding only tool results sends no empty user message
          if ( m.getRole() == ChatRole.USER && SafetyUtil.isEmpty(m.getContent()) && out.length() > 0
               && "tool".equals(out.getJSONObject(out.length() - 1).optString("role")) ) continue;
          msg.put("content", m.getContent());
          out.put(msg);
        }
        if ( pending != null ) toolResults(out, pending);
        return out;
      `
    },
    {
      name: 'toolResults',
      visibility: 'protected',
      args: 'Object out, foam.ai.llm.LLMToolUse[] uses',
      javaCode: `
        for ( LLMToolUse u : uses ) {
          JSONObject msg = new JSONObject();
          msg.put("role",         "tool");
          msg.put("tool_call_id", u.getId());
          msg.put("content",      u.getResult());
          ((JSONArray) out).put(msg);
        }
      `
    },
    {
      name: 'requestBody',
      documentation: `
        The JSON body sent to the chat-completions endpoint, built without any network call
        so a test can read it. Web search and thinking have no chat-completions form and are
        left out.
      `,
      type: 'Object',
      args: 'Object messages, foam.ai.llm.LLMOptions options',
      javaCode: `
        String model = options.getModel();
        if ( model == null || model.isEmpty() ) model = getDefaultModel();
        int maxTokens = options.getMaxTokens() > 0 ? options.getMaxTokens() : 4096;

        JSONObject body = new JSONObject();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("messages",   (JSONArray) messages);
        // streamed so the caller hears how far a long reply has got; without
        // include_usage a streamed reply carries no token counts
        body.put("stream",         true);
        body.put("stream_options", new JSONObject().put("include_usage", true));

        if ( options.getTemperature() > 0 ) {
          body.put("temperature", options.getTemperature());
        }

        if ( options.getTools().length > 0 ) {
          JSONArray tools = new JSONArray();
          for ( LLMTool t : options.getTools() ) {
            JSONObject fn = new JSONObject();
            fn.put("name",        t.getName());
            fn.put("description", t.getDescription());
            fn.put("parameters",  SafetyUtil.isEmpty(t.getInputSchema())
              ? new JSONObject().put("type", "object").put("properties", new JSONObject())
              : new JSONObject(t.getInputSchema()));
            JSONObject tool = new JSONObject();
            tool.put("type",     "function");
            tool.put("function", fn);
            tools.put(tool);
          }
          body.put("tools", tools);
        }
        return body;
      `
    },
    {
      name: 'parseReply',
      documentation: `
        The response read from a chat-completions reply. tool_calls become LLMToolUses and
        the stop reason reads tool_use, as from every provider; cached prompt tokens are
        counted once, as cache reads, not again as input.
      `,
      type: 'foam.ai.llm.LLMResponse',
      args: 'Object reply',
      javaCode: `
        JSONObject data    = (JSONObject) reply;
        JSONArray  choices = data.optJSONArray("choices");
        JSONObject choice  = choices != null && choices.length() > 0 ? choices.getJSONObject(0) : null;
        JSONObject message = choice == null ? null : choice.optJSONObject("message");

        List<LLMToolUse> uses  = new ArrayList<>();
        JSONArray        calls = message == null ? null : message.optJSONArray("tool_calls");
        for ( int i = 0 ; calls != null && i < calls.length() ; i++ ) {
          JSONObject call = calls.getJSONObject(i);
          JSONObject fn   = call.optJSONObject("function");
          LLMToolUse u    = new LLMToolUse();
          u.setId(call.optString("id", ""));
          u.setName(fn == null ? "" : fn.optString("name", ""));
          u.setInputJson(fn == null ? "{}" : fn.optString("arguments", "{}"));
          uses.add(u);
        }

        LLMResponse response = new LLMResponse();
        response.setContent(message == null || message.isNull("content") ? "" : message.optString("content", ""));
        response.setToolUses(uses.toArray(new LLMToolUse[0]));
        response.setModel(data.optString("model", ""));
        response.setStopReason(uses.size() > 0 ? "tool_use" : choice != null ? choice.optString("finish_reason", "") : "");

        JSONObject usage = data.optJSONObject("usage");
        if ( usage != null ) {
          JSONObject details = usage.optJSONObject("prompt_tokens_details");
          int cached = details == null ? 0 : details.optInt("cached_tokens", 0);
          int prompt = usage.optInt("prompt_tokens", 0);
          // OpenAI's prompt_tokens includes the cached ones (120 with 100 cached is 20 input);
          // some gateways in front of other models leave them out (21 with 1795 cached is 21)
          response.setInputTokens(prompt >= cached ? prompt - cached : prompt);
          response.setCacheReadTokens(cached);
          response.setOutputTokens(usage.optInt("completion_tokens", 0));
        }
        return response;
      `
    },
    {
      name: 'providerHeaders',
      javaCode: `
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Authorization", "Bearer " + getApiKey());
        return headers;
      `
    },
    {
      name: 'readStream',
      documentation: `
        Rebuilds a chat-completions reply from its streamed chunks, in the shape a call
        without streaming returns. Text arrives as delta.content pieces. A tool call
        arrives as pieces under its index: the first carries its id and name, the rest add
        to its arguments text. With include_usage a chunk with no choices carries the token
        counts, and "data: [DONE]" ends the stream. An error chunk fails the call; a stream
        that ends before [DONE] throws.
      `,
      javaCode: `
        Written       written   = new Written(progress);
        StringBuilder text      = new StringBuilder();
        Map<Integer, JSONObject>    calls     = new TreeMap<>();
        Map<Integer, StringBuilder> arguments = new HashMap<>();
        Object     finish = null;
        JSONObject usage  = null;
        String     model  = null;
        for ( String data ; ( data = nextData(in) ) != null ; ) {
          written.alive();
          if ( "[DONE]".equals(data) ) {
            JSONArray toolCalls = new JSONArray();
            for ( Map.Entry<Integer, JSONObject> call : calls.entrySet() ) {
              call.getValue().getJSONObject("function").put("arguments", arguments.get(call.getKey()).toString());
              toolCalls.put(call.getValue());
            }
            JSONObject message = new JSONObject();
            message.put("role",    "assistant");
            message.put("content", text.length() == 0 ? JSONObject.NULL : text.toString());
            if ( toolCalls.length() > 0 ) message.put("tool_calls", toolCalls);
            JSONObject choice = new JSONObject();
            choice.put("index",         0);
            choice.put("message",       message);
            choice.put("finish_reason", finish == null ? JSONObject.NULL : finish);
            JSONObject reply = new JSONObject();
            if ( model != null ) reply.put("model", model);
            reply.put("choices", new JSONArray().put(choice));
            if ( usage != null ) reply.put("usage", usage);
            return reply;
          }
          JSONObject chunk = object(data);
          if ( model == null && chunk.has("model") && ! chunk.isNull("model") ) model = chunk.getString("model");
          if ( chunk.has("error") ) throw new IOException("The reply stream reported an error: " + chunk.opt("error"));
          JSONArray choices = chunk.optJSONArray("choices");
          for ( int i = 0 ; choices != null && i < choices.length() ; i++ ) {
            JSONObject choice = choices.getJSONObject(i);
            if ( ! choice.isNull("finish_reason") && choice.has("finish_reason") ) finish = choice.get("finish_reason");
            JSONObject delta = choice.optJSONObject("delta");
            if ( delta == null ) continue;
            String piece = delta.isNull("content") ? "" : delta.optString("content", "");
            text.append(piece);
            written.chars(piece.length());
            JSONArray parts = delta.optJSONArray("tool_calls");
            for ( int j = 0 ; parts != null && j < parts.length() ; j++ ) {
              JSONObject part  = parts.getJSONObject(j);
              int        index = part.optInt("index");
              JSONObject fn    = part.optJSONObject("function");
              JSONObject call  = calls.computeIfAbsent(index, k -> new JSONObject()
                .put("type", "function").put("function", new JSONObject()));
              if ( part.has("id") && ! part.isNull("id") ) call.put("id", part.getString("id"));
              if ( fn != null && fn.has("name") && ! fn.isNull("name") ) call.getJSONObject("function").put("name", fn.getString("name"));
              String args = fn == null || fn.isNull("arguments") ? "" : fn.optString("arguments", "");
              arguments.computeIfAbsent(index, k -> new StringBuilder()).append(args);
              written.chars(args.length());
            }
          }
          if ( chunk.optJSONObject("usage") != null ) usage = chunk.getJSONObject("usage");
        }
        throw new IOException("The reply stream ended before [DONE]");
      `
    }
  ]
});
