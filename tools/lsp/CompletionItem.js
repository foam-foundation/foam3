/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'CompletionItem',

  documentation: 'Typed LSP completion item. Serialize with toLSP() for protocol wire format (no `class` field).',

  constants: {
    // LSP CompletionItemKind enum values (subset used by this LSP)
    KIND_TEXT: 1,
    KIND_METHOD: 2,
    KIND_CLASS: 7,
    KIND_PROPERTY: 10,
    KIND_VALUE: 12,
    KIND_ENUM: 13,
    KIND_KEYWORD: 14,
    KIND_COLOR: 16,
    KIND_FILE: 17,
    KIND_CONSTANT: 21,
    KIND_OPERATOR: 24,

    // InsertTextFormat
    FORMAT_PLAIN: 1,
    FORMAT_SNIPPET: 2
  },

  properties: [
    { class: 'String', name: 'label' },
    { class: 'Int',    name: 'kind', value: 1 },
    { class: 'String', name: 'detail' },
    { name: 'documentation' },    // string | { kind: 'markdown', value: string }
    { class: 'String', name: 'insertText' },
    { class: 'Int',    name: 'insertTextFormat' },
    { name: 'textEdit' },         // { range, newText }
    { class: 'String', name: 'filterText' },
    { class: 'String', name: 'sortText' },
    { class: 'Boolean', name: 'preselect' }
  ],

  methods: [
    function toLSP() {
      /** Return a plain LSP-protocol-shaped object (no FOAM `class` field). */
      var o = { label: this.label, kind: this.kind };
      if ( this.detail ) o.detail = this.detail;
      if ( this.documentation ) o.documentation = this.documentation;
      if ( this.insertText ) o.insertText = this.insertText;
      if ( this.insertTextFormat ) o.insertTextFormat = this.insertTextFormat;
      if ( this.textEdit ) o.textEdit = this.textEdit;
      if ( this.filterText ) o.filterText = this.filterText;
      if ( this.sortText ) o.sortText = this.sortText;
      if ( this.preselect ) o.preselect = this.preselect;
      return o;
    }
  ]
});
