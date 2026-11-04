/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm.provider',
  name: 'ClaudeLLMService',

  extends: 'foam.core.ai.llm.provider.AbstractHTTPLLMService',

  documentation: `
    Anthropic Claude implementation of LLMService, on the Messages API.
    API key is injected via CSpec config — never exposed to client.
    Server-side only (Java).
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
      value: 'foam/llm/claude'
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
      value: 'claude-sonnet-4-20250514'
    },
    {
      name: 'baseURL',
      value: 'https://api.anthropic.com/v1/messages'
    },
    {
      class: 'String',
      name: 'fallbacks',
      documentation: `
        Sent as the request's fallbacks, e.g. "default": on a policy decline the API re-runs
        the request on a fallback model inside the same call instead of stopping. Needs
        the server-side-fallback beta in headers.
      `
    },
    {
      class: 'String',
      name: 'apiVersion',
      value: '2023-06-01'
    }
  ],

  methods: [
    {
      name: 'apiMessages',
      documentation: `
        The conversation in Anthropic's format. An assistant turn that called tools carries
        one tool_use block per call, and the user turn after it opens with one tool_result
        block per call, since the model reads a call's result before the next user text.
        When the conversation ends on such an assistant turn, a user turn holding only the
        results is added.
      `,
      type: 'Object',
      args: 'String systemPrompt, foam.ai.llm.ChatMessage[] messages',
      javaCode: `
        // the system prompt goes in the body, not among the messages (requestBody)
        JSONArray     out     = new JSONArray();
        LLMToolUse[]  pending = null;
        for ( ChatMessage m : messages ) {
          JSONObject msg = new JSONObject();
          msg.put("role", m.getRole().getLabel());
          if ( m.getRole() == ChatRole.ASSISTANT && m.getToolUses().length > 0 ) {
            JSONArray blocks = new JSONArray();
            if ( ! SafetyUtil.isEmpty(m.getContent()) ) blocks.put(textBlock(m.getContent()));
            for ( LLMToolUse u : m.getToolUses() ) {
              JSONObject b = new JSONObject();
              b.put("type",  "tool_use");
              b.put("id",    u.getId());
              b.put("name",  u.getName());
              b.put("input", SafetyUtil.isEmpty(u.getInputJson()) ? new JSONObject() : new JSONObject(u.getInputJson()));
              blocks.put(b);
            }
            msg.put("content", blocks);
            pending = m.getToolUses();
          } else if ( pending != null ) {
            JSONArray blocks = (JSONArray) toolResults(pending);
            if ( ! SafetyUtil.isEmpty(m.getContent()) ) blocks.put(textBlock(m.getContent()));
            msg.put("content", blocks);
            pending = null;
          } else {
            msg.put("content", m.getContent());
          }
          out.put(msg);
        }
        if ( pending != null ) {
          JSONObject msg = new JSONObject();
          msg.put("role",    "user");
          msg.put("content", toolResults(pending));
          out.put(msg);
        }
        return out;
      `
    },
    {
      name: 'toolResults',
      visibility: 'protected',
      type: 'Object',
      args: 'foam.ai.llm.LLMToolUse[] uses',
      javaCode: `
        JSONArray blocks = new JSONArray();
        for ( LLMToolUse u : uses ) {
          JSONObject b = new JSONObject();
          b.put("type",        "tool_result");
          b.put("tool_use_id", u.getId());
          b.put("content",     u.getResult());
          blocks.put(b);
        }
        return blocks;
      `
    },
    {
      name: 'textBlock',
      visibility: 'protected',
      type: 'Object',
      args: 'String text',
      javaCode: `
        JSONObject b = new JSONObject();
        b.put("type", "text");
        b.put("text", text);
        return b;
      `
    },
    {
      name: 'requestBody',
      documentation: 'The JSON body sent to the Messages API, built without any network call so a test can read it.',
      type: 'Object',
      args: 'Object messages, foam.ai.llm.LLMOptions options',
      javaCode: `
        String model     = options.getModel();
        if ( model == null || model.isEmpty() ) model = getDefaultModel();
        int    maxTokens = options.getMaxTokens() > 0 ? options.getMaxTokens() : 4096*2;

        JSONObject body = new JSONObject();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("messages",   (JSONArray) messages);
        // a long reply takes minutes: streamed, the caller hears how far it has got
        body.put("stream",     true);
        if ( ! SafetyUtil.isEmpty(getFallbacks()) ) body.put("fallbacks", getFallbacks());

        if ( options.getTemperature() > 0 ) {
          body.put("temperature", options.getTemperature());
        }

        String systemPrompt = options.getSystemPrompt();
        if ( systemPrompt != null && ! systemPrompt.isEmpty() ) {
          body.put("system", systemPrompt);
        }

        JSONArray tools = new JSONArray();
        for ( LLMTool t : options.getTools() ) {
          JSONObject tool = new JSONObject();
          tool.put("name",        t.getName());
          tool.put("description", t.getDescription());
          tool.put("input_schema", SafetyUtil.isEmpty(t.getInputSchema())
            ? new JSONObject().put("type", "object").put("properties", new JSONObject())
            : new JSONObject(t.getInputSchema()));
          tools.put(tool);
        }
        if ( options.getWebSearch() ) {
          JSONObject search = new JSONObject();
          search.put("type",     "web_search_20260209");
          search.put("name",     "web_search");
          search.put("max_uses", 5);
          tools.put(search);
        }
        if ( tools.length() > 0 ) body.put("tools", tools);

        if ( options.getThinking() == LLMThinking.DISABLED ) {
          body.put("thinking", new JSONObject().put("type", "disabled"));
        } else if ( options.getThinking() == LLMThinking.BETWEEN_TOOLS ) {
          body.put("thinking", new JSONObject().put("type", "between_tools"));
        }

        return body;
      `
    },
    {
      name: 'parseReply',
      documentation: 'The response read from the Messages API reply: text blocks joined, tool_use blocks as LLMToolUses, usage.',
      type: 'foam.ai.llm.LLMResponse',
      args: 'Object reply',
      javaCode: `
        JSONObject data    = (JSONObject) reply;
        JSONArray  content = data.getJSONArray("content");
        StringBuilder      text = new StringBuilder();
        List<LLMToolUse>   uses = new ArrayList<>();
        for ( int i = 0 ; i < content.length() ; i++ ) {
          JSONObject block = content.getJSONObject(i);
          String     type  = block.getString("type");
          if ( "text".equals(type) ) {
            if ( text.length() > 0 ) text.append("\\n");
            text.append(block.getString("text"));
          } else if ( "tool_use".equals(type) ) {
            LLMToolUse u = new LLMToolUse();
            u.setId(block.getString("id"));
            u.setName(block.getString("name"));
            JSONObject input = block.optJSONObject("input");
            u.setInputJson(input == null ? "{}" : input.toString());
            uses.add(u);
          }
        }

        LLMResponse response = new LLMResponse();
        response.setContent(text.toString());
        response.setToolUses(uses.toArray(new LLMToolUse[0]));
        response.setModel(data.optString("model", ""));
        response.setStopReason(data.optString("stop_reason", ""));

        JSONObject usage = data.optJSONObject("usage");
        if ( usage != null ) {
          response.setInputTokens(usage.optInt("input_tokens", 0));
          response.setOutputTokens(usage.optInt("output_tokens", 0));
          response.setCacheReadTokens(usage.optInt("cache_read_input_tokens", 0));
          response.setCacheWriteTokens(usage.optInt("cache_creation_input_tokens", 0));
          JSONObject server = usage.optJSONObject("server_tool_use");
          if ( server != null ) response.setWebSearches(server.optInt("web_search_requests", 0));
        }
        return response;
      `
    },
    {
      name: 'providerHeaders',
      javaCode: `
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("x-api-key",         getApiKey());
        headers.put("anthropic-version", getApiVersion());
        return headers;
      `
    },
    {
      name: 'readStream',
      documentation: `
        Rebuilds the message from its server-sent events. Each content block arrives as a
        start event, deltas and a stop event carrying the block's index; a tool_use block's
        input arrives as pieces of JSON text, such as '{"cit' then 'y":"Rabat"}', parsed when
        the block stops. An error before any block, such as overloaded_error, throws
        EarlyStreamError, which is retried; after content it fails the call. A stream that
        ends before message_stop, as when the connection drops, throws.
      `,
      javaCode: `
        Written    written = new Written(progress);
        JSONObject message = new JSONObject();
        Map<Integer, JSONObject>                 blocks = new TreeMap<>();
        Map<Integer, Map<String, StringBuilder>> pieces = new HashMap<>();
        for ( String data ; ( data = nextData(in) ) != null ; ) {
          written.alive();
          JSONObject event = object(data);
          String     type  = event.optString("type");
          int        index = event.optInt("index");
          if ( "message_start".equals(type) && event.optJSONObject("message") != null ) {
            message = event.getJSONObject("message");
          } else if ( "content_block_start".equals(type) && event.optJSONObject("content_block") != null ) {
            blocks.put(index, event.getJSONObject("content_block"));
          } else if ( "content_block_delta".equals(type) && event.optJSONObject("delta") != null ) {
            JSONObject delta = event.getJSONObject("delta");
            String     kind  = delta.optString("type");
            // text_delta carries "text", thinking_delta "thinking", signature_delta
            // "signature"; input_json_delta carries "partial_json" for the block's input
            boolean json  = "input_json_delta".equals(kind);
            String  field = json ? "input" : kind.replace("_delta", "");
            String  piece = delta.optString(json ? "partial_json" : field, "");
            pieces.computeIfAbsent(index, k -> new LinkedHashMap<>()).computeIfAbsent(field, k -> new StringBuilder()).append(piece);
            // only the reply itself counts as written, not the model's thinking
            if ( json || "text".equals(field) ) written.chars(piece.length());
          } else if ( "content_block_stop".equals(type) && blocks.containsKey(index) ) {
            JSONObject block = blocks.get(index);
            for ( Map.Entry<String, StringBuilder> p : pieces.getOrDefault(index, new HashMap<>()).entrySet() ) {
              String value = p.getValue().toString();
              block.put(p.getKey(), "input".equals(p.getKey()) ? object(value) : value);
            }
          } else if ( "message_delta".equals(type) ) {
            JSONObject delta = event.optJSONObject("delta");
            if ( delta != null && ! delta.isNull("stop_reason") ) message.put("stop_reason", delta.getString("stop_reason"));
            JSONObject counts = event.optJSONObject("usage");
            if ( counts != null ) {
              // the final counts update the start's; one sent as null keeps the start's value
              JSONObject usage = message.optJSONObject("usage");
              if ( usage == null ) usage = new JSONObject();
              for ( String key : counts.keySet() ) if ( ! counts.isNull(key) ) usage.put(key, counts.get(key));
              message.put("usage", usage);
            }
          } else if ( "message_stop".equals(type) ) {
            message.put("content", new JSONArray(blocks.values()));
            return message;
          } else if ( "error".equals(type) ) {
            String error = "The reply stream reported an error: " + event.opt("error");
            if ( blocks.isEmpty() ) throw new EarlyStreamError(error);
            throw new IOException(error);
          }
        }
        throw new IOException("The reply stream ended before the reply was complete");
      `
    }
  ]
});
