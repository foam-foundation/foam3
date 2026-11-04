/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm.provider.test',
  name: 'LLMToolsTest',
  extends: 'foam.core.test.Test',

  documentation: `
    A model that calls a tool, gets its result and answers, through both providers, with no
    network call: the request body each provider builds and the reply each one reads.
  `,

  javaImports: [
    'foam.ai.llm.*',
    'foam.core.ai.llm.provider.AbstractHTTPLLMService',
    'foam.core.ai.llm.provider.ClaudeLLMService',
    'foam.core.ai.llm.provider.OpenAILLMService',
    'java.io.BufferedReader',
    'java.io.StringReader',
    'org.json.JSONArray',
    'org.json.JSONObject'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        ClaudeLLMService claude = new ClaudeLLMService();
        OpenAILLMService openai = new OpenAILLMService();

        LLMTool tool = new LLMTool();
        tool.setName("set_date_format");
        tool.setDescription("Read a date column with one of the listed formats");
        tool.setInputSchema("{\\"type\\":\\"object\\",\\"properties\\":{\\"column\\":{\\"type\\":\\"string\\"}},\\"required\\":[\\"column\\"]}");
        LLMTool noInput = new LLMTool();
        noInput.setName("run_preview");
        noInput.setDescription("Show sample rows");

        LLMOptions options = new LLMOptions();
        options.setSystemPrompt("You help upload files.");
        options.setTools(new LLMTool[] { tool, noInput });
        options.setTemperature(0);

        LLMToolUse use = new LLMToolUse();
        use.setId("call_1");
        use.setName("set_date_format");
        use.setInputJson("{\\"column\\":\\"settle_date\\"}");
        use.setResult("Shown to the user.");

        ChatMessage ask = message(ChatRole.USER, "Read settle_date as yymmdd", null);
        ChatMessage called = message(ChatRole.ASSISTANT, "", new LLMToolUse[] { use });
        ChatMessage thanks = message(ChatRole.USER, "Thanks", null);

        // Claude: tool_use on the assistant turn, tool_result opening the next user turn
        JSONArray cm = (JSONArray) claude.apiMessages("", new ChatMessage[] { ask, called, thanks });
        test(cm.length() == 3, "claude: three turns, got " + cm);
        expect(cm.getJSONObject(0).getString("content"), "Read settle_date as yymmdd", "claude: plain text stays a string");
        JSONObject toolUse = cm.getJSONObject(1).getJSONArray("content").getJSONObject(0);
        expect(toolUse.getString("type"), "tool_use", "claude: the call is a tool_use block, with no empty text block before it");
        expect(toolUse.getJSONObject("input").getString("column"), "settle_date", "claude: the call's input is an object");
        JSONArray userBlocks = cm.getJSONObject(2).getJSONArray("content");
        expect(userBlocks.getJSONObject(0).getString("type"), "tool_result", "claude: the result opens the next user turn");
        expect(userBlocks.getJSONObject(0).getString("tool_use_id"), "call_1", "claude: the result quotes the call's id");
        expect(userBlocks.getJSONObject(1).getString("text"), "Thanks", "claude: the user's text follows the result");

        JSONArray endsOnCall = (JSONArray) claude.apiMessages("", new ChatMessage[] { ask, called });
        test(endsOnCall.length() == 3 && "user".equals(endsOnCall.getJSONObject(2).getString("role"))
          && endsOnCall.getJSONObject(2).getJSONArray("content").length() == 1,
          "claude: a conversation ending on a call gets a user turn holding only its result: " + endsOnCall);

        options.setWebSearch(true);
        options.setThinking(LLMThinking.DISABLED);
        JSONObject cb = (JSONObject) claude.requestBody(cm, options);
        JSONArray  ct = cb.getJSONArray("tools");
        test(ct.length() == 3, "claude: two tools plus web search: " + ct);
        expect(ct.getJSONObject(0).getJSONObject("input_schema").getJSONArray("required").getString(0), "column", "claude: the schema is sent as input_schema");
        expect(ct.getJSONObject(1).getJSONObject("input_schema").getString("type"), "object", "claude: a tool with no input gets an empty object schema");
        expect(ct.getJSONObject(2).getString("name"), "web_search", "claude: web search is a server tool beside the others");
        expect(cb.getJSONObject("thinking").getString("type"), "disabled", "claude: thinking turned off");
        test(! cb.has("temperature"), "claude: temperature 0 is not sent");
        expect(cb.getString("system"), "You help upload files.", "claude: system prompt");
        options.setThinking(LLMThinking.BETWEEN_TOOLS);
        expect(((JSONObject) claude.requestBody(cm, options)).getJSONObject("thinking").getString("type"), "between_tools", "claude: thinking only between tool calls");

        test(! cb.has("fallbacks"), "claude: no fallbacks unless set");
        claude.setFallbacks("default");
        expect(((JSONObject) claude.requestBody(cm, options)).getString("fallbacks"), "default", "claude: fallbacks sent when set");

        LLMOptions plain = new LLMOptions();
        plain.setTemperature(0);
        JSONObject pb = (JSONObject) claude.requestBody(new JSONArray(), plain);
        test(! pb.has("tools") && ! pb.has("thinking"), "claude: a request without tools sends no tools and no thinking");

        LLMResponse cr = claude.parseReply(new JSONObject(
          "{\\"model\\":\\"m\\",\\"stop_reason\\":\\"tool_use\\",\\"content\\":["
          + "{\\"type\\":\\"thinking\\",\\"thinking\\":\\"...\\"},"
          + "{\\"type\\":\\"text\\",\\"text\\":\\"I'll set it.\\"},"
          + "{\\"type\\":\\"tool_use\\",\\"id\\":\\"toolu_9\\",\\"name\\":\\"set_date_format\\",\\"input\\":{\\"column\\":\\"settle_date\\"}}],"
          + "\\"usage\\":{\\"input_tokens\\":100,\\"output_tokens\\":20,\\"cache_read_input_tokens\\":50,\\"cache_creation_input_tokens\\":7,\\"server_tool_use\\":{\\"web_search_requests\\":2}}}"));
        expect(cr.getContent(), "I'll set it.", "claude reply: text only, thinking left out");
        test(cr.getToolUses().length == 1 && "toolu_9".equals(cr.getToolUses()[0].getId()), "claude reply: the tool call is read");
        expect(new JSONObject(cr.getToolUses()[0].getInputJson()).getString("column"), "settle_date", "claude reply: the call's input as JSON");
        test(cr.getCacheReadTokens() == 50 && cr.getCacheWriteTokens() == 7, "claude reply: cache tokens read");
        test(cr.getWebSearches() == 2, "claude reply: the web searches that ran are counted");

        // chat completions: tool_calls on the assistant, a tool message per result
        JSONArray om = (JSONArray) openai.apiMessages(options.getSystemPrompt(), new ChatMessage[] { ask, called, thanks });
        test(om.length() == 5, "openai: system, user, assistant, tool, user: " + om);
        expect(om.getJSONObject(0).getString("role"), "system", "openai: system prompt first");
        JSONObject assistant = om.getJSONObject(2);
        test(assistant.isNull("content"), "openai: an assistant turn with only calls has null content");
        JSONObject fn = assistant.getJSONArray("tool_calls").getJSONObject(0).getJSONObject("function");
        expect(fn.getString("name"), "set_date_format", "openai: the call names its function");
        expect(new JSONObject(fn.getString("arguments")).getString("column"), "settle_date", "openai: arguments are JSON text");
        expect(om.getJSONObject(3).getString("role"), "tool", "openai: the result is a tool message");
        expect(om.getJSONObject(3).getString("tool_call_id"), "call_1", "openai: the result quotes the call's id");

        JSONArray resultOnly = (JSONArray) openai.apiMessages("", new ChatMessage[] { ask, called, message(ChatRole.USER, "", null) });
        test(resultOnly.length() == 3, "openai: an empty user turn after results is not sent: " + resultOnly);

        JSONObject ob = (JSONObject) openai.requestBody(om, options);
        JSONObject ot = ob.getJSONArray("tools").getJSONObject(0);
        expect(ot.getString("type"), "function", "openai: tools are functions");
        expect(ot.getJSONObject("function").getJSONObject("parameters").getJSONArray("required").getString(0), "column", "openai: the schema is sent as parameters");
        test(ob.getJSONArray("tools").length() == 2 && ! ob.has("thinking"), "openai: no web search tool and no thinking field");

        LLMResponse or = openai.parseReply(new JSONObject(
          "{\\"model\\":\\"g\\",\\"choices\\":[{\\"finish_reason\\":\\"tool_calls\\",\\"message\\":{\\"content\\":null,"
          + "\\"tool_calls\\":[{\\"id\\":\\"c7\\",\\"type\\":\\"function\\",\\"function\\":{\\"name\\":\\"run_preview\\",\\"arguments\\":\\"{}\\"}}]}}],"
          + "\\"usage\\":{\\"prompt_tokens\\":120,\\"completion_tokens\\":9,\\"prompt_tokens_details\\":{\\"cached_tokens\\":100}}}"));
        expect(or.getContent(), "", "openai reply: null content reads as empty");
        test(or.getToolUses().length == 1 && "run_preview".equals(or.getToolUses()[0].getName()), "openai reply: the tool call is read");
        expect(or.getStopReason(), "tool_use", "openai reply: the stop reason reads as from every provider");
        test(or.getInputTokens() == 20 && or.getCacheReadTokens() == 100, "openai reply: cached prompt tokens counted once, as cache reads");
        LLMResponse gw = openai.parseReply(new JSONObject("{\\"choices\\":[{\\"message\\":{\\"content\\":\\"ok\\"}}],\\"usage\\":{\\"prompt_tokens\\":21,\\"completion_tokens\\":5,\\"prompt_tokens_details\\":{\\"cached_tokens\\":1795}}}"));
        test(gw.getInputTokens() == 21 && gw.getCacheReadTokens() == 1795, "openai reply: a gateway whose prompt_tokens leaves out the cached ones is not charged negative input, got " + gw.getInputTokens());
        test(gw.getWebSearches() == 0, "openai reply: no web search ran");

        test(cb.getBoolean("stream") && ob.getBoolean("stream") && ob.getJSONObject("stream_options").getBoolean("include_usage"),
          "both providers stream; chat completions asks for the usage chunk");

        // streams rebuilt into the reply a call without streaming returns
        int[] reported = { 0 };
        LLMProgress progress = tokens -> reported[0] = tokens;
        JSONObject cs = (JSONObject) claude.readStream(lines(
          "event: message_start",
          "data: {'type':'message_start','message':{'model':'m','usage':{'input_tokens':30,'output_tokens':1}}}",
          "data: {'type':'content_block_start','index':0,'content_block':{'type':'thinking','thinking':''}}",
          "data: {'type':'content_block_delta','index':0,'delta':{'type':'thinking_delta','thinking':'hmm'}}",
          "data: {'type':'content_block_stop','index':0}",
          "data:",
          "data: {'type':'content_block_start','index':1,'content_block':{'type':'text','text':''}}",
          "data: {'type':'content_block_delta','index':1,'delta':{'type':'text_delta','text':'Setting the format.'}}",
          "data: {'type':'content_block_stop','index':1}",
          "data: {'type':'content_block_start','index':2,'content_block':{'type':'tool_use','id':'t1','name':'set_date_format','input':{}}}",
          "data: {'type':'content_block_delta','index':2,'delta':{'type':'input_json_delta','partial_json':'{\\\\'col'}}",
          "data: {'type':'content_block_delta','index':2,'delta':{'type':'input_json_delta','partial_json':'umn\\\\':\\\\'settle_date\\\\'}'}}",
          "data: {'type':'content_block_stop','index':2}",
          "data: {'type':'message_delta','delta':{'stop_reason':'tool_use'},'usage':{'input_tokens':null,'output_tokens':42}}",
          "data: {'type':'message_stop'}"), progress);
        LLMResponse sr = claude.parseReply(cs);
        expect(sr.getContent(), "Setting the format.", "claude stream: text rebuilt, thinking left out");
        expect(new JSONObject(sr.getToolUses()[0].getInputJson()).getString("column"), "settle_date", "claude stream: tool input joined from its pieces");
        test(sr.getInputTokens() == 30 && sr.getOutputTokens() == 42, "claude stream: a count sent as null keeps the start's value");
        expect(sr.getStopReason(), "tool_use", "claude stream: stop reason");
        test(reported[0] > 0, "claude stream: progress reported, " + reported[0] + " tokens");

        // a listener that throws ends the call even while the model only thinks
        String[] thinking = {
          "data: {'type':'message_start','message':{'model':'m'}}",
          "data: {'type':'content_block_start','index':0,'content_block':{'type':'thinking','thinking':''}}",
          "data: {'type':'content_block_delta','index':0,'delta':{'type':'thinking_delta','thinking':'hmm'}}",
          "data: {'type':'content_block_stop','index':0}",
          "data: {'type':'message_stop'}" };
        try {
          claude.readStream(lines(thinking), (LLMProgress) tokens -> { throw new RuntimeException("stopped"); });
          test(false, "claude stream: a listener that throws while the model thinks ends the call");
        } catch (RuntimeException e) {
          test("stopped".equals(e.getMessage()), "claude stream: a listener that throws while the model thinks ends the call");
        }
        try {
          openai.readStream(lines("data: {'choices':[{'delta':{'role':'assistant'}}]}", "data: [DONE]"),
            (LLMProgress) tokens -> { throw new RuntimeException("stopped"); });
          test(false, "openai stream: a listener that throws before any text ends the call");
        } catch (RuntimeException e) {
          test("stopped".equals(e.getMessage()), "openai stream: a listener that throws before any text ends the call");
        }

        try {
          claude.readStream(lines("data: {'type':'error','error':{'type':'overloaded_error'}}"), null);
          test(false, "claude stream: an early error throws");
        } catch (AbstractHTTPLLMService.EarlyStreamError e) {
          test(true, "claude stream: an error before any content is retryable");
        }
        try {
          claude.readStream(lines(
            "data: {'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}}",
            "data: {'type':'error','error':{'type':'overloaded_error'}}"), null);
          test(false, "claude stream: a late error throws");
        } catch (AbstractHTTPLLMService.EarlyStreamError e) {
          test(false, "claude stream: an error after content is not retried");
        } catch (java.io.IOException e) {
          test(true, "claude stream: an error after content fails the call");
        }
        try {
          claude.readStream(lines("data: {'type':'message_start','message':{}}"), null);
          test(false, "claude stream: a cut stream throws");
        } catch (java.io.IOException e) {
          test(true, "claude stream: a stream that ends before message_stop throws");
        }

        JSONObject os = (JSONObject) openai.readStream(lines(
          "data: {'model':'bedrock:sonnet','choices':[{'delta':{'role':'assistant','content':'On it'}}]}",
          "data: {'choices':[{'delta':{'tool_calls':[{'index':0,'id':'c1','function':{'name':'run_preview','arguments':'{\\\\'ro'}}]}}]}",
          "data: {'choices':[{'delta':{'tool_calls':[{'index':0,'function':{'arguments':'ws\\\\':5}'}}]},'finish_reason':'tool_calls'}]}",
          "data: {'choices':[],'usage':{'prompt_tokens':10,'completion_tokens':4}}",
          "data: [DONE]"), null);
        LLMResponse osr = openai.parseReply(os);
        expect(osr.getContent(), "On it", "openai stream: text rebuilt");
        expect(osr.getModel(), "bedrock:sonnet", "openai stream: the model that answered is kept");
        test(osr.getToolUses().length == 1 && new JSONObject(osr.getToolUses()[0].getInputJson()).getInt("rows") == 5, "openai stream: tool call joined from its pieces");
        test(osr.getInputTokens() == 10 && osr.getOutputTokens() == 4, "openai stream: usage chunk read");
        try {
          openai.readStream(lines("data: {'choices':[{'delta':{'content':'x'}}]}"), null);
          test(false, "openai stream: a cut stream throws");
        } catch (java.io.IOException e) {
          test(true, "openai stream: a stream that ends before [DONE] throws");
        }

        // retries
        test(claude.retryable(429) && claude.retryable(529) && claude.retryable(503) && ! claude.retryable(400) && ! claude.retryable(401), "429, 529 and 503 are retried; 400 and 401 are not");
        expect(claude.backoff(0, "7"), 7000L, "retry-after in seconds is honoured");
        expect(claude.backoff(0, "600"), 60000L, "retry-after is capped at 60 s");
        test(claude.backoff(2, null) >= 4000 && claude.backoff(2, null) < 4500, "third attempt waits about 4 s");
        expect(claude.backoff(10, null), 30000L, "backoff is capped at 30 s");
      `
    },
    {
      name: 'lines',
      type: 'java.io.BufferedReader',
      args: 'String... lines',
      javaCode: `
        // fixtures write ' for " so they need no escaping
        return new BufferedReader(new StringReader((String.join("\\n", lines) + "\\n").replace('\\'', '"')));
      `
    },
    {
      name: 'message',
      type: 'foam.ai.llm.ChatMessage',
      args: 'foam.ai.llm.ChatRole role, String content, foam.ai.llm.LLMToolUse[] uses',
      javaCode: `
        ChatMessage m = new ChatMessage();
        m.setRole(role);
        m.setContent(content);
        if ( uses != null ) m.setToolUses(uses);
        return m;
      `
    }
  ]
});
