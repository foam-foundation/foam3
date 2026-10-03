/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.llm',
  name: 'RAGChat',
  extends: 'foam.u2.Controller',

  documentation: 'RAG chat UI: embed query → kNN search → build context → local LLM → answer.',

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRole',
    'foam.ai.llm.ChatRequest',
    'foam.ai.llm.LLMOptions',
    'foam.ai.llm.ConversationalLLMService',
    'foam.ai.llm.provider.TransformersLLMService',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.provider.TransformersEmbeddingService',
    'foam.dao.ArraySink'
  ],

  imports: [
    'vectorStoreDAO'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 700px;
      min-height: 500px;
      border-radius: 8px;
      overflow: hidden;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
    }
    ^header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: #3d7ebf;
      color: #fff;
    }
    ^header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 15px;
    }
    ^messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8f9fa;
    }
    ^message-row {
      display: flex;
      gap: 10px;
      max-width: 82%;
    }
    ^message-row-user      { margin-left: auto; flex-direction: row-reverse; }
    ^message-row-assistant { margin-right: auto; }
    ^avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    ^avatar-user      { display: none; }
    ^avatar-assistant { background: #28a745; color: #fff; }
    ^message-content {
      padding: 10px 15px;
      border-radius: 18px;
      line-height: 1.45;
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    ^message-content-user {
      background: #4a4a4a;
      color: #fff;
      border-radius: 18px 18px 4px 18px;
    }
    ^message-content-assistant {
      background: #fff;
      color: #212529;
      border-radius: 18px 18px 18px 4px;
      border: 1px solid #dee2e6;
    }
    ^loading-row {
      display: flex;
      gap: 10px;
      align-self: flex-start;
      max-width: 75%;
    }
    ^loading-content {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #fff;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      border: 1px solid #dee2e6;
      color: #6c757d;
      font-size: 14px;
    }
    ^loading-dots { display: flex; gap: 3px; }
    ^loading-dots span {
      width: 6px; height: 6px;
      background: #3d7ebf;
      border-radius: 50%;
      animation: ^bounce 1.4s infinite ease-in-out both;
    }
    ^loading-dots span:nth-child(1) { animation-delay: -0.32s; }
    ^loading-dots span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes ^bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40%           { transform: scale(1);   opacity: 1;   }
    }
    ^empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #6c757d;
      text-align: center;
      padding: 40px;
    }
    ^empty-icon  { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
    ^empty-title { font-size: 16px; font-weight: 600; color: #495057; margin-bottom: 6px; }
    ^input-container {
      display: flex;
      padding: 14px 20px;
      background: #fff;
      border-top: 1px solid #dee2e6;
      gap: 10px;
      align-items: flex-end;
    }
    ^input-wrapper { flex: 1; }
    ^input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ced4da;
      border-radius: 20px;
      font-size: 14px;
      resize: none;
      min-height: 42px;
      max-height: 150px;
      font-family: inherit;
      background: #f8f9fa;
      box-sizing: border-box;
    }
    ^input:focus {
      outline: none;
      border-color: #3d7ebf;
      background: #fff;
      box-shadow: 0 0 0 2px rgba(61,126,191,0.15);
    }
    ^send-btn {
      width: 42px; height: 42px;
      background: #3d7ebf;
      color: #fff;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    ^send-btn:hover:not(:disabled) { background: #2f6399; }
    ^send-btn:disabled { background: #adb5bd; cursor: not-allowed; }
    ^clear-btn {
      padding: 5px 10px;
      background: rgba(255,255,255,0.15);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    }
    ^clear-btn:hover { background: rgba(255,255,255,0.25); }
    ^status {
      font-size: 11px;
      color: rgba(255,255,255,0.75);
      margin-left: 8px;
    }
  `,

  constants: [
    { name: 'MAX_NEW_TOKENS',       value: 512  },
    { name: 'CONTEXT_TOKEN_BUDGET', value: 1200 },
    { name: 'RETRIEVAL_LIMIT',      value: 10   },
    {
      name:  'SYSTEM_PROMPT',
      value: 'Answer using only the provided context. If the answer is not in the context, say "I don\'t know." Be brief and direct.'
    }
  ],

  properties: [
    {
      name: 'embedder',
      factory: function() { return this.TransformersEmbeddingService.create(); }
    },
    {
      name: 'llmService',
      factory: function() {
        return this.ConversationalLLMService.create({
          delegate: this.TransformersLLMService.create()
        });
      }
    },
    { class: 'String',  name: 'inputText' },
    {
      class: 'Array',
      name: 'conversationHistory',
      factory: function() { return []; }
    },
    { class: 'Boolean', name: 'isLoading' },
    { class: 'String',  name: 'statusMsg' },
    { name: 'messagesContainer_' }
  ],

  methods: [
    function render() {
      var self = this;
      self.SUPER();

      self
        .addClass()
        .start('div').addClass(self.myClass('header'))
          .start('div').addClass(self.myClass('header-title'))
            .add('🤖 RAG Chat')
            .start('span').addClass(self.myClass('status')).add(self.statusMsg$).end()
          .end()
          .start('button')
            .addClass(self.myClass('clear-btn'))
            .add('Clear')
            .on('click', function() { self.clearChat_(); })
          .end()
        .end()

        .start('div')
          .addClass(self.myClass('messages'))
          .call(function() { self.messagesContainer_ = this; })
          .add(self.dynamic(function(conversationHistory, isLoading) {
            if ( conversationHistory.length === 0 && ! isLoading ) {
              this.start('div').addClass(self.myClass('empty-state'))
                .start('div').addClass(self.myClass('empty-icon')).add('💬').end()
                .start('div').addClass(self.myClass('empty-title')).add('Ask about your indexed flows').end()
              .end();
              return;
            }
            for ( var i = 0; i < conversationHistory.length; i++ ) {
              var msg      = conversationHistory[i];
              var roleName = msg.role.label;
              this.start('div')
                .addClass(self.myClass('message-row'))
                .addClass(self.myClass('message-row-' + roleName))
                .start('div')
                  .addClass(self.myClass('avatar'))
                  .addClass(self.myClass('avatar-' + roleName))
                  .add('🤖')
                .end()
                .start('div')
                  .addClass(self.myClass('message-content'))
                  .addClass(self.myClass('message-content-' + roleName))
                  .add(msg.content)
                .end()
              .end();
            }
            if ( isLoading ) {
              this.start('div').addClass(self.myClass('loading-row'))
                .start('div').addClass(self.myClass('avatar'))
                  .addClass(self.myClass('avatar-assistant')).add('🤖').end()
                .start('div').addClass(self.myClass('loading-content'))
                  .start('div').addClass(self.myClass('loading-dots'))
                    .start('span').end()
                    .start('span').end()
                    .start('span').end()
                  .end()
                  .add('Thinking…')
                .end()
              .end();
            }
          }))
        .end()

        .start('div').addClass(self.myClass('input-container'))
          .start('div').addClass(self.myClass('input-wrapper'))
            .start('textarea')
              .addClass(self.myClass('input'))
              .attrs({ placeholder: 'Ask a question about your indexed flows…', rows: 1 })
              .on('input',   function(e) { self.inputText = e.target.value; })
              .on('keydown', function(e) {
                if ( e.key === 'Enter' && ! e.shiftKey ) {
                  e.preventDefault();
                  self.sendMessage_();
                }
              })
              .call(function() {
                var el = this;
                self.inputText$.sub(function() {
                  if ( el.el_() ) el.el_().value = self.inputText;
                });
              })
            .end()
          .end()
          .start('button')
            .addClass(self.myClass('send-btn'))
            .attrs({ disabled: self.slot(function(isLoading, inputText) {
              return isLoading || ! inputText || ! inputText.trim();
            }, self.isLoading$, self.inputText$) })
            .add('➤')
            .on('click', function() { self.sendMessage_(); })
          .end()
        .end();
    },

    function clearChat_() {
      this.conversationHistory = [];
      this.inputText           = '';
      this.statusMsg           = '';
      this.llmService.clearHistory();
    },

    function scrollToBottom_() {
      var container = this.messagesContainer_?.el_?.();
      if ( container ) {
        setTimeout(function() { container.scrollTop = container.scrollHeight; }, 50);
      }
    },

    function countTokens_(text) {
      return text ? Math.ceil(text.length / 4) : 0;
    },

    async function buildContext_(query) {
      var qv   = await this.embedder.embed(this.__subContext__, query);
      var cc   = this.CosineComparator.create({ queryVector: qv.vector });
      var sink = await this.vectorStoreDAO
        .where(this.EQ(this.VectorEmbedding.EMBEDDING_MODEL, qv.embeddingModel))
        .orderBy(cc).limit(this.RETRIEVAL_LIMIT).select(this.ArraySink.create());

      var chunks = sink.array;
      if ( ! chunks.length ) return '';

      var lines = [];
      var used  = 0;
      for ( var i = 0; i < chunks.length; i++ ) {
        var t    = (chunks[i].text || '').trim();
        var cost = this.countTokens_(t);
        if ( ! t || used + cost > this.CONTEXT_TOKEN_BUDGET ) break;
        lines.push('[' + (i + 1) + '] ' + t);
        used += cost;
      }
      return lines.join('\n\n');
    },

    async function sendMessage_() {
      var query = this.inputText.trim();
      if ( ! query || this.isLoading ) return;

      this.inputText = '';
      this.isLoading = true;
      this.statusMsg = 'Searching…';

      // Add plain query to display history
      var userMsg = this.ChatMessage.create({ role: 'USER', content: query });
      this.conversationHistory = this.conversationHistory.concat([ userMsg ]);
      this.scrollToBottom_();

      try {
        var ragContext  = await this.buildContext_(query);
        var userContent = ragContext
          ? 'Context:\n' + ragContext + '\n\nQuestion: ' + query
          : query;

        this.statusMsg = 'Generating…';

        // Pass just the current augmented turn — ConversationalLLMService
        // prepends accumulated history and appends the assistant reply.
        var augMsg  = this.ChatMessage.create({ role: 'USER', content: userContent });
        var options = this.LLMOptions.create({
          maxTokens:    this.MAX_NEW_TOKENS,
          temperature:  0.2,
          systemPrompt: this.SYSTEM_PROMPT
        });

        var response = await this.llmService.chat(
          this.__subContext__,
          this.ChatRequest.create({ messages: [ augMsg ], options: options })
        );

        this.conversationHistory = this.conversationHistory.concat([
          this.ChatMessage.create({ role: 'ASSISTANT', content: response.content || '(no response)' })
        ]);
        this.statusMsg = '';
      } catch(e) {
        console.error('RAGChat error:', e);
        this.conversationHistory = this.conversationHistory.concat([
          this.ChatMessage.create({ role: 'ASSISTANT', content: 'Error: ' + e.message })
        ]);
        this.statusMsg = '';
      }

      this.isLoading = false;
      this.scrollToBottom_();
    }
  ]
});
