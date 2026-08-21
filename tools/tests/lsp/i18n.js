/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Split from the spec: i18n extract variants, missing-language scan,
// translation providers, and command edit-building.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, cache = h.cache;

section('I18nHandler — extract (moved from DiagnosticsHandler)');
var i18n = foam.parse.lsp.handlers.I18nHandler.create({ index: index, cache: cache });

var SRC = "foam.CLASS({\n  package: 'test',\n  name: 'ExtractMe',\n" +
  "  methods: [\n    function render() {\n      this.add('Upload complete');\n    }\n  ]\n});\n";

var edit = i18n.buildAddExtractEdit(SRC, 'Upload complete', 'file:///t/ExtractMe.js');
test(!! edit, 'extract returns an edit for a single-model file');
var edits = edit && edit.changes['file:///t/ExtractMe.js'];
test(edits && edits.length === 2, 'extract has usage rewrite + messages insertion');
test(edits && edits.some(function(e) { return e.newText === 'this.UPLOAD_COMPLETE_MSG'; }),
  'usage rewritten to this.UPLOAD_COMPLETE_MSG');
test(edits && edits.some(function(e) { return /messages: \[/.test(e.newText); }),
  'new messages: block inserted');

// Ambiguity bail-outs survive the move
test(i18n.buildAddExtractEdit(SRC + SRC, 'Upload complete', 'file:///t/Two.js') === null,
  'two foam.CLASS blocks → null (no autofix)');
