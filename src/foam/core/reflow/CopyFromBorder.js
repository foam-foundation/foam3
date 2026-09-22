/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CopyFromBorder',
  extends: 'foam.u2.Element',

  imports: [ 'window' ],

  css: `
    ^copy {
      font-size: smaller;
      padding-bottom: 6px;
      text-decoration: underline;
    }
    ^content {
      border: 1px $grey400 solid;
      max-height: 800px;
      max-width: 95%;
      overflow: scroll;
      padding-left: 10px;
    }
  `,

  messages: [
    {
      name: 'COPY',
      message: 'copy'
    }
  ],

  properties: [ 'content' ],

  methods: [
    function render() {
      this.SUPER();
      this.
        addClass().
        start('div').
          addClass(this.myClass('copy')).
          on('click', this.copyToClipboard).
          add(this.COPY).
        end().
        start('div', {}, this.content$).
          addClass(this.myClass('content')).
          style({fontSize: 'smaller'}).
        end();
    }
  ],

  listeners: [
    function copyToClipboard() {
      var range = document.createRange();
      range.selectNode(this.content.element_);
      this.window.getSelection().empty();
      this.window.getSelection().addRange(range);
    }
  ]
});
