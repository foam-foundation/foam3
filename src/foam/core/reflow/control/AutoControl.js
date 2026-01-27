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
      padding-left: 0;
      padding-right: 0;
      width: 100%;
    }
    ^input:focus-visible {
      border: none;
    }
  `,

  properties: [
    {
      name: 'input',
      onKey: false
    },
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

      this.start().
        addClass(this.myClass('promptHolder'))
        .start(this.Link).addClass(this.myClass('promptLink')).add('/').on('click', () => this.eval_('help')).end()
        .start(foam.u2.tag.Image, {
          glyph: 'rightChevron',
          embedSVG: true
        }).addClass(this.myClass('chevron')).end()
        .start(this.SmartView, {data$: this.input$, parser: this.grammar}, this.smartView_$)
          .on('keydown', this.onKeyDown)
          .addClass(this.myClass('input'))
          .focus()
        .end()
      .end();
    }
  ],

  listeners: [
    function onKeyDown(e) {
      if ( e.key === 'Enter' ) {
        let n = this.smartView_.preview;
        this.smartView_.preview = '';

        if ( n ) {
          if ( n.startsWith('/') ) n = n.substring(1);
          if ( n ) this.eval_(n);
        }

        e.stopPropagation();
        e.preventDefault();
        this.reset();
      }
    }
  ],
});
