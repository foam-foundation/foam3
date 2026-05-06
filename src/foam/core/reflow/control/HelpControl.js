/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.control',
  name: 'HelpControl',
  extends: 'foam.u2.Element',

  requires: [ 'foam.u2.Link' ],

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
    'data'
  ],

  methods: [
    function render() {
      this.start().
        addClass(this.myClass('promptHolder'))
        .start(this.Link).addClass(this.myClass('promptLink')).add('help').on('click', () => this.eval_('help')).end()
        .start(foam.u2.tag.Image, {
          glyph: 'rightChevron',
          embedSVG: true
        }).addClass(this.myClass('chevron')).end()
        .start(this.data.INPUT, null, this.data.input_$)
          .addClass(this.myClass('input'))
          .focus()
          .on('keyup', e => {
            if ( e.key == 'Enter' || e.keyCode == 13 ) {
              let input = this.data.input;
              this.data.input = '';
              this.eval_(input);
            }
          })
        .end()
      .end();
    }
  ]
});
