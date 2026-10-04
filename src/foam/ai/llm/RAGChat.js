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

  cssTokens: [
    { name: 'headerBtnBg',     value: 'rgba(255,255,255,0.15)' },
    { name: 'headerBtnBorder', value: 'rgba(255,255,255,0.3)'  },
    { name: 'headerBtnHover',  value: 'rgba(255,255,255,0.25)' },
    { name: 'headerSubtle',    value: 'rgba(255,255,255,0.75)' },
    { name: 'inputFocusShadow', value: '0 0 0 2px rgba(61,126,191,0.15)' }
  ],

  requires: [
    'foam.ai.llm.ChatMessage',
    'foam.ai.llm.ChatRole',
    'foam.ai.llm.ChatRequest',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.dao.ArraySink'
  ],

  imports: [
    'embedder',
    'llmService',
    'vectorStoreDAO'
  ],

  css: `
    << {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 700px;
      min-height: 500px;
      border-radius: $radius-lg;
      overflow: hidden;
      background: $backgroundSecondary;
      border: 1px solid $borderLight;
    }
    <<header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: $space-3_5 $space-5;
      background: $backgroundBrand;
      color: $textOnBrand;
    }
    <<header-title {
      display: flex;
      align-items: center;
      gap: $space-2_5;
      font-weight: $font-medium;
      font-size: 15px;
    }
    <<messages {
      flex: 1;
      overflow-y: auto;
      padding: $space-4 $space-5;
      display: flex;
      flex-direction: column;
      gap: $space-3;
      background: $backgroundSecondary;
    }
    <<message-row {
      display: flex;
      gap: $space-2_5;
      max-width: 82%;
    }
    <<message-row-user      { margin-left: auto; flex-direction: row-reverse; }
    <<message-row-assistant { margin-right: auto; }
    <<message-content {
      padding: $space-2_5 $space-3_5;
      border-radius: 18px;
      line-height: 1.45;
      font-size: $body-md;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    <<message-content-user {
      background: $grey700;
      color: $white;
      border-radius: 18px 18px $radius 18px;
    }
    <<message-content-assistant {
      background: $backgroundDefault;
      color: $textDefault;
      border-radius: 18px 18px 18px $radius;
      border: 1px solid $borderLight;
    }
    <<loading-row {
      display: flex;
      gap: $space-2_5;
      align-self: flex-start;
      max-width: 75%;
    }
    <<loading-content {
      display: flex;
      align-items: center;
      gap: $space-2;
      padding: $space-2_5 $space-3_5;
      background: $backgroundDefault;
      border-radius: $radius-2xl;
      border-bottom-left-radius: $radius;
      border: 1px solid $borderLight;
      color: $textTertiary;
      font-size: $body-md;
    }
    <<loading-dots { display: flex; gap: 3px; }
    <<loading-dots span {
      width: 6px; height: 6px;
      background: $backgroundBrand;
      border-radius: $radius-full;
      animation: <<bounce 1.4s infinite $ease-in-out both;
    }
    <<loading-dots span:nth-child(1) { animation-delay: -0.32s; }
    <<loading-dots span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes <<bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40%           { transform: scale(1);   opacity: 1;   }
    }
    <<empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: $textTertiary;
      text-align: center;
      padding: $space-10;
    }
    <<empty-icon  { font-size: 40px; margin-bottom: $space-3; opacity: 0.5; }
    <<empty-title { font-size: 16px; font-weight: $font-medium; color: $textSecondary; margin-bottom: $space-1_5; }
    <<input-container {
      display: flex;
      padding: $space-3_5 $space-5;
      background: $backgroundDefault;
      border-top: 1px solid $borderLight;
      gap: $space-2_5;
      align-items: flex-end;
    }
    <<input-wrapper { flex: 1; }
    <<input {
      width: 100%;
      padding: $space-2_5 $space-3_5;
      border: 1px solid $borderDefault;
      border-radius: 20px;
      font-size: $body-md;
      resize: none;
      min-height: 42px;
      max-height: 150px;
      font-family: inherit;
      background: $backgroundSecondary;
      box-sizing: border-box;
    }
    <<input:focus {
      outline: none;
      border-color: $backgroundBrand;
      background: $backgroundDefault;
      box-shadow: $inputFocusShadow;
    }
    <<send-btn {
      width: 42px; height: 42px;
      background: $backgroundBrand;
      color: $textOnBrand;
      border: none;
      border-radius: $radius-full;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    <<send-btn:hover:not(:disabled) { background: $backgroundBrandSecondary; }
    <<send-btn:disabled { background: $borderDefault; cursor: not-allowed; }
    <<clear-btn {
      padding: $space-1_5 $space-2_5;
      background: $headerBtnBg;
      color: $textOnBrand;
      border: 1px solid $headerBtnBorder;
      border-radius: $radius;
      cursor: pointer;
      font-size: $body-sm;
      font-weight: $font-regular;
    }
    <<clear-btn:hover { background: $headerBtnHover; }
    <<status {
      font-size: 11px;
      color: $headerSubtle;
      margin-left: $space-2;
    }
  `,

  constants: [
    { name: 'CONTEXT_TOKEN_BUDGET', value: 1200 },
    { name: 'RETRIEVAL_LIMIT',      value: 10   }
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.ai.llm.LLMOptions',
      name: 'options',
      factory: function() {
        return foam.ai.llm.LLMOptions.create({
          maxTokens:    512,
          temperature:  0.2,
          systemPrompt: 'Answer using only the provided context. If the answer is not in the context, say "I don\'t know." Be brief and direct.'
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
            .add('RAG Chat')
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
                  .addClass(self.myClass('message-content'))
                  .addClass(self.myClass('message-content-' + roleName))
                  .add(msg.content)
                .end()
              .end();
            }
            if ( isLoading ) {
              this.start('div').addClass(self.myClass('loading-row'))
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
      if ( this.llmService.clearHistory ) this.llmService.clearHistory();
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

        var augMsg   = this.ChatMessage.create({ role: 'USER', content: userContent });
        var response = await this.llmService.chat(
          this.__subContext__,
          this.ChatRequest.create({ messages: [ augMsg ], options: this.options })
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
