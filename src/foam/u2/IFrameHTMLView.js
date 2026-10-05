/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'IFrameHTMLView',
  extends: 'foam.u2.View',

  css: `
    << iframe {
      border: 1px solid $borderDefault;
      padding: 8px;
      max-width: 100%;
      box-sizing: border-box;
    }
    <<resize {
      resize: both;
    }
  `,

  properties: [
    'resizable',
    {
      class: 'String',
      name: 'src',
      documentation: 'Used to load a url rather than an HTML document, ignored if data is set'
    }
  ],

  methods: [    
    function render() {
      this.SUPER();
      this.addClass();
      this.start('iframe')
        .attrs((this.data ? { srcdoc: this.data } : { src: this.src }))
        .enableClass(this.myClass('resize'), this.resizable$)
        .on('load', evt => this.resizeIFrame(evt.target))
      .end();
    },

    function resizeIFrame(el) {
      // reset padding and margins of iframe document body
      el.contentDocument.body.style.padding = 0;
      el.contentDocument.body.style.margin = 0;

      // set iframe dimensions according to the document / its content
      el.style.height = Math.max(
        el.contentDocument.documentElement.scrollHeight,
        el.contentDocument.body.firstElementChild.scrollHeight
      );
      el.style.width = "100%";
    }
  ]
});
