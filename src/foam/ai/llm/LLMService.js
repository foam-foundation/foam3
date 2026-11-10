/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.ENUM({
  package: 'foam.ai.llm',
  name: 'ChatRole',
  values: [
    { name: 'SYSTEM',    label: 'system'    },
    { name: 'USER',      label: 'user'      },
    { name: 'ASSISTANT', label: 'assistant'  }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'LLMTool',

  documentation: `
    A tool the model may call, e.g. { name: 'set_date_format', description: 'Read a date column
    with one of the listed formats', inputSchema: '{"type":"object","properties":{...}}' }.
    The provider sends it in its own format; the model answers with an LLMToolUse.
  `,

  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'description'
    },
    {
      class: 'String',
      name: 'inputSchema',
      documentation: 'JSON Schema of the input, as JSON text. Empty means the tool takes no input.'
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'LLMToolUse',

  documentation: `
    One call the model asked for. The caller runs it, sets result, and sends the assistant
    message carrying it back in the next chat request; the provider turns each result into
    the tool-result message the model expects before the next user text.
  `,

  properties: [
    {
      class: 'String',
      name: 'id',
      documentation: "The provider's id for this call, which its result must quote."
    },
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'inputJson',
      documentation: 'The input the model chose, as JSON text, e.g. {"column":"settle_date","format":"YYMMDD"}.'
    },
    {
      class: 'String',
      name: 'result',
      documentation: 'What running the call produced, written by the caller before the next request.'
    }
  ]
});


foam.ENUM({
  package: 'foam.ai.llm',
  name: 'LLMThinking',

  documentation: 'Extended thinking. Providers without thinking ignore it.',

  values: [
    { name: 'DEFAULT',       label: 'Model default' },
    { name: 'DISABLED',      label: 'Disabled' },
    { name: 'BETWEEN_TOOLS', label: 'Only between tool calls', documentation: 'For models that cannot turn thinking off.' }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'ChatMessage',

  properties: [
    {
      class: 'Enum',
      of: 'foam.ai.llm.ChatRole',
      name: 'role',
      value: 'USER'
    },
    {
      class: 'String',
      name: 'content'
    },
    {
      class: 'FObjectArray',
      of: 'foam.ai.llm.LLMToolUse',
      name: 'toolUses',
      documentation: 'On an ASSISTANT message, the calls the model made in that turn, each with its result.'
    },
    {
      class: 'String',
      name: 'thinkingBlocks',
      documentation: `
        On an ASSISTANT message, the model's thinking for that turn in the provider's own
        form, as JSON text: Claude's thinking blocks with their signatures. Claude refuses a
        conversation whose last turn called a tool while thinking was on unless that turn
        comes back with its thinking unchanged, so it is kept here and sent back as it came.
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'LLMOptions',

  documentation: 'Provider-agnostic completion options.',

  properties: [
    {
      class: 'String',
      name: 'model',
      documentation: 'Model identifier. Provider maps this to its own naming.'
    },
    {
      class: 'Int',
      name: 'maxTokens',
      value: 8192
    },
    {
      class: 'Double',
      name: 'temperature',
      value: 0
    },
    {
      class: 'String',
      name: 'systemPrompt'
    },
    {
      class: 'FObjectArray',
      of: 'foam.ai.llm.LLMTool',
      name: 'tools',
      documentation: `
        Tools the model may call. A provider that cannot send tools throws when this is
        set rather than answer without them: an agent that relies on a tool call would
        otherwise loop, or make the answer up, with no error.
      `
    },
    {
      class: 'Boolean',
      name: 'webSearch',
      documentation: 'Let the model search the web. Providers without a search tool ignore it.'
    },
    {
      class: 'Enum',
      of: 'foam.ai.llm.LLMThinking',
      name: 'thinking'
    },
    {
      class: 'String',
      name: 'sessionId',
      documentation: 'Groups the calls of one user session, for a gateway that reports usage per session.'
    },
    {
      class: 'String',
      name: 'agentName',
      documentation: 'What asked, e.g. report/summarize, for a gateway that reports usage per feature.'
    },
    {
      class: 'Boolean',
      name: 'stateless',
      documentation: `
        Send this call as it is, outside any conversation a decorator keeps:
        ConversationalLLMService neither adds its history to it nor records
        it. For a caller that keeps its own history, such as a chat screen
        that sends its earlier messages with every call.
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'LLMRequest',
  abstract: true,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.ai.llm.LLMOptions',
      name: 'options',
      factory: function() { return foam.ai.llm.LLMOptions.create(); }
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'CompletionRequest',
  extends: 'foam.ai.llm.LLMRequest',

  properties: [
    {
      class: 'String',
      name: 'prompt',
      required: true
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'ChatRequest',
  extends: 'foam.ai.llm.LLMRequest',

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.ai.llm.ChatMessage',
      name: 'messages'
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.llm',
  name: 'LLMResponse',

  properties: [
    {
      class: 'String',
      name: 'content',
      documentation: 'The text response from the model.'
    },
    {
      class: 'String',
      name: 'model',
      documentation: 'The model that actually served the request.'
    },
    {
      class: 'Int',
      name: 'inputTokens'
    },
    {
      class: 'Int',
      name: 'outputTokens'
    },
    {
      class: 'Int',
      name: 'cacheReadTokens',
      documentation: "Input tokens served from the provider's prompt cache, billed lower than inputTokens."
    },
    {
      class: 'Int',
      name: 'cacheWriteTokens'
    },
    {
      class: 'Int',
      name: 'webSearches',
      documentation: `Web searches the model ran for this reply. 0 when webSearch was asked
        for but the provider has no search tool, so the caller can say the answer came from
        the model's own knowledge.`
    },
    {
      class: 'String',
      name: 'stopReason'
    },
    {
      class: 'FObjectArray',
      of: 'foam.ai.llm.LLMToolUse',
      name: 'toolUses',
      documentation: 'The calls the model asked for; stopReason is then tool_use.'
    },
    {
      class: 'String',
      name: 'thinkingBlocks',
      documentation: "The model's thinking in the provider's own form, carried to the next request by toMessage."
    }
  ],

  methods: [
    {
      name: 'toMessage',
      documentation: `
        This reply as the ASSISTANT turn of the next request, with its tool calls and the
        thinking the provider wants back. The message shares the calls, so a result set on
        a call of this reply is on the message too.
      `,
      type: 'foam.ai.llm.ChatMessage',
      code: function() {
        return foam.ai.llm.ChatMessage.create({
          role:           'ASSISTANT',
          content:        this.content,
          toolUses:       this.toolUses,
          thinkingBlocks: this.thinkingBlocks
        });
      },
      javaCode: `
        ChatMessage m = new ChatMessage();
        m.setRole(ChatRole.ASSISTANT);
        m.setContent(getContent());
        m.setToolUses(getToolUses());
        m.setThinkingBlocks(getThinkingBlocks());
        return m;
      `
    }
  ]
});


foam.INTERFACE({
  package: 'foam.ai.llm',
  name: 'LLMProgress',

  documentation: `
    Told how much of a reply the model has written while it streams in, so a long call
    can show progress instead of waiting in silence. A provider finds it in the context
    under "llmProgress".

    It is told about once a second while the stream is open, with the same count while
    the model thinks before it writes. A listener that throws ends the call: the
    connection closes, the model stops writing, and the exception reaches the caller.
    A screen uses this to stop a long call the user no longer wants. It is also told,
    with the same count, about once a second while the provider waits to retry a busy
    model, so a stop is heard during that wait too.

    Server-side callers only: the context does not cross the network, so a call made from
    the browser through the LLMService client gets no progress.
  `,

  methods: [
    {
      name: 'written',
      args: 'int tokens'
    }
  ]
});


foam.INTERFACE({
  package: 'foam.ai.llm',
  name: 'LLMService',

  documentation: `
    Abstract LLM completion service. Implementations provide
    Claude, OpenAI, Ollama, etc. behind a uniform interface.
    Decoratable for logging, auth, rate-limiting, caching, etc.
  `,

  skeleton: true,
  client:   true,
  proxy:    true,

  methods: [
    {
      name: 'complete',
      async: true,
      type: 'foam.ai.llm.LLMResponse',
      documentation: 'Send a prompt and return the model completion.',
      args: 'Context x, foam.ai.llm.CompletionRequest request'
    },
    {
      name: 'chat',
      async: true,
      type: 'foam.ai.llm.LLMResponse',
      documentation: 'Multi-turn chat completion with message history.',
      args: 'Context x, foam.ai.llm.ChatRequest request'
    }
  ]
});
