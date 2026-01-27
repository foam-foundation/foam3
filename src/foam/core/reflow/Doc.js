/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DocView',
  extends: 'foam.u2.View',

  requires: [ 'foam.u2.HTMLView' ],

  css: `
    ^ { margin-right: 10px; }
  `,

  methods: [
    function render() {
      this.
        addClass().
        tag(this.HTMLView, {data$: this.data.richText$});
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Doc',

  properties: [
    {
      class: 'String',
      name: 'richText',
      label: '',
      view: 'foam.u2.view.RichTextView'
    }
  ],

  methods: [
    function addToE(e) {
      e.tag(foam.core.reflow.DocView, {data: this});
    }
  ]
});
