/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Markdown',

  properties: [
    {
      class: 'String',
      name: 'markdown',
      onKey: true,
      label: '',
      view: { class: 'foam.u2.tag.TextArea', rows: 40, cols: 80 }
    }
  ],

  methods: [
    function addToE(e) {
      e.tag(foam.u2.view.MarkdownView, {data$: this.markdown$});
    }
  ]
});
