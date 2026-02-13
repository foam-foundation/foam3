/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.control',
  name: 'AutoControl',
  extends: 'foam.u2.Controller',

  requires: [
    'foam.parse.auto.SmartView',
    'foam.core.reflow.control.AutoGrammar',
    'foam.u2.Link'
  ],

  imports: [ 'eval_' ],

  css: `
    .foam-parse-auto-SuggestionView-command  { color: $green300; }
    .foam-parse-auto-SuggestionView-custom   { color: $red400; }
    .foam-parse-auto-SuggestionView-flow     { color: $orange400; }
    .foam-parse-auto-SuggestionView-history  { color: $brown400; }
    .foam-parse-auto-SuggestionView-standard { color: $blue400; }

    ^promptHolder button.foam-u2-ActionView { margin-right: 8px; }

    :has(> ^promptHolder) {
      width: 100%;
    }
    ^promptHolder {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0px;
    }
    ^promptLink {
      text-decoration: none !important;
      font-weight: bold;
      color: $primary500!important;
    }
    ^input {
      border: none;
      margin-right: 8px;
      padding-left: 0;
      padding-right: 0;
      width: 100%;
    }
    ^input:focus-visible {
      border: none;
    }
  `,

  properties: [
    'data',
    {
      name: 'grammar',
      factory: function() {
        return this.AutoGrammar.create();
      }
    },
    'smartView_'
  ],

  methods: [
    function reset() {
      this.smartView_.reset();
    },

    async function render() {
      await this.grammar.aInit();

      this.start()
        .addClass(this.myClass('promptHolder'))
        .add([this.COLLECTIONS, this.FLOWS, this.COMMANDS].map(v => {
          return v.clone().copyFrom({ toolTip: v.label, label: '' });
        }))
        .start(this.SmartView, {data$: this.data.input$, parser: this.grammar}, this.smartView_$)
          .on('keydown', this.onKeyDown)
          .addClass(this.myClass('input'))
          .focus()
        .end()
      .end();

      this.data.input_ = this.smartView_.field;
    }
  ],

  actions: [
    {
      name: 'collections',
      themeIcon: 'file',
      code: function() {
        this.smartView_.preview= '/dao ';
        this.smartView_.focus();
      }
    },
    {
      name: 'flows',
      themeIcon: 'flow',
      code: function() {
        this.smartView_.preview= '/load ';
        this.smartView_.focus();
      }
    },
    {
      name: 'commands',
      themeIcon: 'plus',
      code: function() {
        this.smartView_.preview = '/';
        this.smartView_.focus();
      }
    }
  ],

  listeners: [
    function onKeyDown(e) {
      if ( e.key === 'Enter' ) {
        let n = this.smartView_.preview;
        this.smartView_.preview = this.smartView_.data = '';

        if ( n ) {
          if ( n.startsWith('/') || n.startsWith('!') ) n = n.substring(1);
          if ( n ) this.eval_(n);
        }

        e.stopPropagation();
        e.preventDefault();
        this.reset();
      }
    }
  ],
});
