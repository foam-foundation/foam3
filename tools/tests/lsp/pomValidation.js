/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// POM membership diagnostics + pull-diagnostic shape.

var h = require('./_harness');
var test = h.test, section = h.section;
var index = h.index, diagHandler = h.diagHandler;


// === PomValidator — orphans / missing / duplicates ===

section('PomValidator');

index.buildFileIndex();

var validator = foam.parse.lsp.handlers.PomValidator.create({ index: index });
var path_      = require('path');
var foam3Root_ = path_.resolve(__dirname, '../../..');
var result    = validator.validate();

test(result && typeof result === 'object', 'PomValidator.validate returns an object');
test(Array.isArray(result.orphans),    'result.orphans is an array');
test(Array.isArray(result.missing),    'result.missing is an array');
test(Array.isArray(result.duplicates), 'result.duplicates is an array');

// Missing should be exactly zero on a healthy checkout — every POM entry
// should resolve to a real file.
test(result.missing.length === 0,
  'No POM entries point at missing files (count=' + result.missing.length + ')');


// A file that declares only a foam.LIB gets no class id, so the index alone
// never sees it; the loaded pom that lists it is what puts it in the build.
(function() {
  var fs = require('fs'), os = require('os'), path = require('path');
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pom-lib-'));
  var src = path.join(dir, 'src');
  fs.mkdirSync(path.join(src, 'x'), { recursive: true });
  fs.writeFileSync(path.join(src, 'x/Cls.js'),      "foam.CLASS({ package: 'x', name: 'Cls' });\n");
  fs.writeFileSync(path.join(src, 'x/lib.js'),      "foam.LIB({ name: 'x.lib' });\n");
  fs.writeFileSync(path.join(src, 'x/Unlisted.js'), "foam.LIB({ name: 'x.unlisted' });\n");
  var stub = { fileIndex_: { 'x.Cls': path.join(src, 'x/Cls.js') } };
  foam.poms.push({ location: src, files: [ { name: 'x/Cls' }, { name: 'x/lib' } ] });
  try {
    var r = foam.parse.lsp.handlers.PomValidator.create({ index: stub }).validate();
    test(r.orphans.indexOf(path.join(src, 'x/lib.js')) === -1,
      'a LIB-only file listed in a loaded pom is not an orphan');
    test(r.orphans.indexOf(path.join(src, 'x/Unlisted.js')) !== -1,
      'a LIB-only file in no pom is still an orphan');
  } finally {
    foam.poms.pop();
  }
})();

test(result.orphans.indexOf(path_.join(foam3Root_, 'src/foam/lang/Boot.js')) === -1,
  'foam/lang/Boot.js (listed in src/pom.js) is not reported as in no pom');


// === Pull diagnostics — DiagnosticsHandler shape suitable for textDocument/diagnostic ===

section('Pull-diagnostic shape');

// The dispatch in server.js for textDocument/diagnostic wraps existing
// DiagnosticsHandler output. Smoke-test the handler shape so the wire
// format stays valid.
var unknownText = "foam.CLASS({\n  extends: 'foo.bar.Nonexistent'\n});";
var diags = diagHandler.handle(unknownText, 'file:///t');
test(Array.isArray(diags), 'DiagnosticsHandler.handle returns an array (ready for pull-diagnostic wrap)');
test(diags.every(function(d) { return d.range && typeof d.message === 'string'; }),
  'each diagnostic has range + message');
