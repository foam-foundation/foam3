/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.llm',
  name: 'RAGChat',
  extends: 'foam.u2.Controller',

  documentation: `
    Chat that answers questions from indexed records through ragService and
    links the records each answer used. The records are those of daoKeys,
    e.g. [ 'flowDAO' ] for the Knowledge Base, and only those the user can
    read are searched. A view that hosts it adds its own buttons to the
    header by overriding renderHeaderActions.
  `,

  cssTokens: [
    { name: 'inputFocusShadow', value: '0 0 0 2px rgba(61,126,191,0.15)' }
  ],

  requires: [
    'foam.u2.view.MarkdownView'
  ],

  imports: [
    'ragService'
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
      padding: $space-2 $space-3 $space-2 $space-5;
      background: $backgroundDefault;
      color: $textDefault;
      border-bottom: 1px solid $borderLight;
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
    <<sources {
      margin-top: $space-2_5;
      padding-top: $space-2;
      border-top: 1px solid $borderLight;
      font-size: $body-sm;
      color: $textTertiary;
      white-space: normal;
    }
    <<source {
      margin-left: $space-1_5;
      color: $textBrand;
      font-weight: $font-medium;
      text-decoration: underline;
      cursor: pointer;
    }
    <<message-content-error { color: $hintWarningText; }
    <<markdown { white-space: normal; }
    <<markdown p:first-child { margin-top: 0; }
    <<markdown p:last-child, <<markdown ul:last-child { margin-bottom: 0; }
  `,

  messages: [
    { name: 'ASK_AI',      message: 'Ask AI' },
    { name: 'EMPTY_TITLE', message: 'Ask a question' },
    { name: 'EMPTY_BODY',  message: 'Answers come from the documents you can open, with a link to each one.' },
    { name: 'PLACEHOLDER', message: 'Ask a question about the documents…' },
    { name: 'THINKING',    message: 'Searching the documents…' },
    { name: 'SOURCES',     message: 'Sources:' },
    { name: 'NO_ANSWER',   message: 'I couldn\'t find that in the docs.' },
    { name: 'TRY_AGAIN',   message: 'I couldn\'t find that in the docs. Try other words.' },
    { name: 'CLOSEST',     message: 'Closest:' },
    { name: 'UNAVAILABLE', message: 'Ask AI is not available right now. Try again later.' }
  ],

  properties: [
    {
      class: 'StringArray',
      name: 'daoKeys',
      documentation: 'The DAOs whose indexed records answer, e.g. [ \'flowDAO\' ].'
    },
    {
      class: 'String',
      name: 'title',
      factory: function() { return this.ASK_AI; }
    },
    { class: 'String',  name: 'inputText' },
    {
      class: 'Array',
      name: 'conversationHistory',
      documentation: 'One entry per message: { role: \'user\' | \'assistant\', content, sources, closest, markdown, error }.',
      factory: function() { return []; }
    },
    { class: 'Boolean', name: 'isLoading' },
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
            .add(self.title$)
          .end()
          .start('div')
            .call(self.renderHeaderActions, [self])
          .end()
        .end()

        .start('div')
          .addClass(self.myClass('messages'))
          .call(function() { self.messagesContainer_ = this; })
          .add(self.dynamic(function(conversationHistory, isLoading) {
            if ( conversationHistory.length === 0 && ! isLoading ) {
              this.start('div').addClass(self.myClass('empty-state'))
                .start('div').addClass(self.myClass('empty-icon')).add('✦').end()
                .start('div').addClass(self.myClass('empty-title')).add(self.EMPTY_TITLE).end()
                .start('div').add(self.EMPTY_BODY).end()
              .end();
              return;
            }
            for ( var i = 0; i < conversationHistory.length; i++ ) {
              var msg = conversationHistory[i];
              this.start('div')
                .addClass(self.myClass('message-row'))
                .addClass(self.myClass('message-row-' + msg.role))
                .start('div')
                  .addClass(self.myClass('message-content'))
                  .addClass(self.myClass('message-content-' + msg.role))
                  .enableClass(self.myClass('message-content-error'), !! msg.error)
                  // an answer is markdown (lists, bold); the user's own text is shown as typed
                  .callIfElse(msg.markdown,
                    function() { this.addClass(self.myClass('markdown')).tag(self.MarkdownView, { data: msg.content }); },
                    function() { this.add(msg.content); })
                  .call(self.renderSources_, [self, msg.sources, msg.closest ? self.CLOSEST : self.SOURCES])
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
                  .add(self.THINKING)
                .end()
              .end();
            }
          }))
        .end()

        .start('div').addClass(self.myClass('input-container'))
          .start('div').addClass(self.myClass('input-wrapper'))
            .start('textarea')
              .addClass(self.myClass('input'))
              .attrs({ placeholder: self.PLACEHOLDER, rows: 1 })
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

    // The header's buttons; a host view overrides it to add its own, e.g. Hide and Close.
    function renderHeaderActions(self) {
      this.startContext({ data: self })
        .tag(self.CLEAR, { buttonStyle: 'TERTIARY' })
      .endContext();
    },

    function renderSources_(self, sources, label) {
      if ( ! sources || ! sources.length ) return;
      this.start('div').addClass(self.myClass('sources'))
        .add(label)
        .forEach(sources, function(s) {
          this.start('a').addClass(self.myClass('source'))
            .add(s.sourceId)
            .on('click', function(e) { e.preventDefault(); self.openSource_(s); })
          .end();
        })
      .end();
    },

    // Opens the record through the user's own DAO, so a link never shows more than the user can read
    async function openSource_(source) {
      var x   = this.__subContext__;
      var dao = x[source.daoKey];
      var obj = dao && await dao.find(source.sourceId);
      if ( obj && obj.openIndexed ) obj.openIndexed(x);
    },

    // A question scrolls to the bottom, where the 'Searching' row shows; an answer
    // scrolls to its own first line, so a long answer is read from the top.
    function addMessage_(msg) {
      this.conversationHistory = this.conversationHistory.concat([ msg ]);
      var container = this.messagesContainer_?.el_?.();
      if ( ! container ) return;
      var rowClass = this.myClass('message-row');
      // after the list has re-rendered with the new message
      setTimeout(function() {
        var rows = container.querySelectorAll('.' + rowClass);
        var last = rows[rows.length - 1];
        if ( msg.role === 'assistant' && last ) {
          container.scrollTop += last.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    },

    async function sendMessage_() {
      var question = this.inputText.trim();
      if ( ! question || this.isLoading ) return;

      this.inputText = '';
      this.isLoading = true;
      this.addMessage_({ role: 'user', content: question });

      var reply;
      try {
        var answer = await this.ragService.ask(this.__subContext__, question, this.daoKeys, foam.locale);
        reply = answer.answered
          ? { role: 'assistant', content: answer.answer, sources: answer.sources, markdown: true }
          : answer.sources.length
            ? { role: 'assistant', content: this.NO_ANSWER, sources: answer.sources, closest: true }
            : { role: 'assistant', content: this.TRY_AGAIN };
      } catch(e) {
        // The reason (no budget left, gateway down) is logged on the server; the user gets one message
        console.error('RAGChat error:', e);
        reply = { role: 'assistant', content: this.UNAVAILABLE, error: true };
      }

      // before the answer is added, so the list re-renders once and keeps the scroll
      this.isLoading = false;
      this.addMessage_(reply);
    }
  ],

  actions: [
    {
      name: 'clear',
      isEnabled: function(conversationHistory, isLoading) { return conversationHistory.length > 0 && ! isLoading; },
      code: function() {
        this.conversationHistory = [];
        this.inputText           = '';
      }
    }
  ]
});
