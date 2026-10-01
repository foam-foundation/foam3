/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// pmake loads a maker given by absolute path, as FOAM-LSP passes its own
// LSPMaker. The temp dir name holds a space on purpose: pmake splits its
// argument string on spaces, so the path has to survive quoting.
//
// Usage: cd foam3 && node tools/tests/testPmakeMakers.js

globalThis.SILENT = true; globalThis.VERBOSE = false;
globalThis.DRY_RUN = false; globalThis.HELP = false; globalThis.NOP = '';

var fs       = require('fs');
var os       = require('os');
var path     = require('path');
var pmake    = require('../pmake');
var buildlib = require('../buildlib');

var failures = 0;
function test(ok, msg) {
  console.error(( ok ? 'PASS ' : 'FAIL ' ) + msg);
  if ( ! ok ) failures++;
}

test(pmake.ABSOLUTE_MAKERS === true, 'pmake exports ABSOLUTE_MAKERS');

var dir   = fs.mkdtempSync(path.join(os.tmpdir(), 'pmake maker '));
var maker = path.join(dir, 'ProbeMaker');
fs.writeFileSync(maker + '.js',
  "exports.init = function() { globalThis.__probe__ = [ 'init' ]; };\n" +
  "exports.end  = function() { globalThis.__probe__.push('end'); };\n");

pmake.bind(buildlib, "-makers='" + maker + "' -pom=" + path.resolve(__dirname, '../../pom'))();

test(Array.isArray(globalThis.__probe__) && globalThis.__probe__.join(',') === 'init,end',
  'absolute maker ran init then end (got ' + globalThis.__probe__ + ')');

fs.rmSync(dir, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
