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
      class: 'Boolean',
      name: 'editable'
    },
    {
      class: 'String',
      name: 'markdown',
      onKey: true,
      label: '',
//      view: { class: 'foam.u2.tag.TextArea', rows: 40, cols: 80 }
      view: { class: 'foam.u2.view.MarkdownEditorView' }
    }
  ],

  methods: [
    function addToE(e) {
      let self = this;
      e.add(this.dynamic(function (editable) {
        let view = editable ? foam.u2.view.MarkdownEditorView : foam.u2.view.MarkdownView;
        this.tag(view, {data$: self.markdown$});
      }));
    }
  ]
});
