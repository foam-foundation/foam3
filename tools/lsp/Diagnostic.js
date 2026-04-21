/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'Diagnostic',

  documentation: 'Typed LSP diagnostic. Carries an optional `fix` (WorkspaceEdit) for code actions. Serialize with toLSP() for protocol wire format.',

  constants: {
    // LSP DiagnosticSeverity
    ERROR: 1,
    WARNING: 2,
    INFORMATION: 3,
    HINT: 4
  },

  properties: [
    { name: 'range' },            // { start: {line,character}, end: {line,character} }
    { class: 'Int',    name: 'severity', value: 2 },
    { class: 'String', name: 'message' },
    { class: 'String', name: 'source', value: 'foam-lsp' },
    { class: 'String', name: 'code' },
    // Carried through but not part of protocol-level diagnostic — consumed
    // by code-action handlers to materialize a WorkspaceEdit.
    { name: 'fix' }
  ],

  methods: [
    function toLSP() {
      /** Return a plain LSP-protocol-shaped object (no FOAM class, no fix). */
      var o = {
        range: this.range,
        severity: this.severity,
        message: this.message,
        source: this.source
      };
      if ( this.code ) o.code = this.code;
      return o;
    }
  ]
});
