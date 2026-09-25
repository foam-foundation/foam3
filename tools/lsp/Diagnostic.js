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
    HINT: 4,

    // LSP DiagnosticTag
    UNNECESSARY: 1,   // editor fades the range out (unused code)
    DEPRECATED: 2     // editor strikes the range through
  },

  properties: [
    { name: 'range' },            // { start: {line,character}, end: {line,character} }
    { class: 'Int',    name: 'severity', value: 2 },
    { class: 'String', name: 'message' },
    { class: 'String', name: 'source', value: 'foam-lsp' },
    { class: 'String', name: 'code' },
    // DiagnosticTag values (UNNECESSARY / DEPRECATED).
    { class: 'Array',  name: 'tags' },
    // [{ location: { uri, range }, message }] — the second place a
    // diagnostic is about, e.g. where a deprecated class is declared.
    { class: 'Array',  name: 'relatedInformation' },
    // Carried through but not part of protocol-level diagnostic — consumed
    // by code-action handlers to materialize a WorkspaceEdit.
    { name: 'fix' }
  ],

  methods: [
    function toLSP(opt_caps) {
      /**
       * Return a plain LSP-protocol-shaped object (no FOAM class, no fix).
       *
       * `opt_caps` is the client's textDocument.publishDiagnostics
       * capability object. tags and relatedInformation are optional in the
       * protocol, and a client that never declared them may not expect
       * them — so each is sent only when the client said it handles it:
       * tags filtered to `tagSupport.valueSet`, relatedInformation only
       * when `relatedInformation === true`. No caps → neither is sent.
       */
      var o = {
        range: this.range,
        severity: this.severity,
        message: this.message,
        source: this.source
      };
      if ( this.code ) o.code = this.code;

      var tagSet = opt_caps && opt_caps.tagSupport && opt_caps.tagSupport.valueSet;
      if ( this.tags.length && Array.isArray(tagSet) ) {
        var tags = this.tags.filter(function(t) { return tagSet.indexOf(t) !== -1; });
        if ( tags.length ) o.tags = tags;
      }
      if ( this.relatedInformation.length && opt_caps && opt_caps.relatedInformation === true ) {
        o.relatedInformation = this.relatedInformation;
      }
      return o;
    }
  ]
});
