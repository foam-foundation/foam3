/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Unit tests for the FOAM LSP MCP server's pure translation layer
// (foam3/tools/lsp/editors/mcp/server.js): URI helpers, output shapers,
// tool schemas, and argument routing. These exercise the agent-facing
// surface WITHOUT spawning the LSP child — requiring the server module only
// loads its helpers because main() is guarded by `require.main === module`.

var h = require('./_harness');
var test = h.test, section = h.section;

var mcp = require('../../lsp/editors/mcp/server');
var ROOT = '/proj';

section('MCP — URI helpers');

test(mcp.normalizeUri('src/Foo.js', ROOT) === 'file:///proj/src/Foo.js',
  'normalizeUri: project-relative path → file:// under root');
test(mcp.normalizeUri('/abs/Foo.js', ROOT) === 'file:///abs/Foo.js',
  'normalizeUri: absolute path → file://');
test(mcp.normalizeUri('file:///x/Foo.js', ROOT) === 'file:///x/Foo.js',
  'normalizeUri: existing file:// passes through');
test(mcp.uriToPath('file:///proj/src/Foo.js') === '/proj/src/Foo.js',
  'uriToPath: strips file:// scheme');
test(mcp.relPath('file:///proj/src/Foo.js', ROOT) === 'src/Foo.js',
  'relPath: project-relative output');
test(mcp.relPath('file:///other/Bar.js', ROOT) === '/other/Bar.js',
  'relPath: outside root → absolute path');

section('MCP — kind/severity names');

test(mcp.kindName(5) === 'class' && mcp.kindName(7) === 'property' && mcp.kindName(6) === 'method',
  'kindName: maps common SymbolKinds');
test(mcp.severityName(1) === 'error' && mcp.severityName(2) === 'warn',
  'severityName: maps diagnostic severities');

section('MCP — output shapers');

var locs = [
  { uri: 'file:///proj/a/X.js', range: { start: { line: 10, character: 2 } } },
  { uri: 'file:///proj/b/Y.js', range: { start: { line: 0,  character: 0 } } }
];
test(mcp.shapeLocations(locs, ROOT) === 'a/X.js:10:2\nb/Y.js:0:0',
  'shapeLocations: array → path:line:character lines');
test(mcp.shapeLocations(locs[0], ROOT) === 'a/X.js:10:2',
  'shapeLocations: single Location accepted');
test(mcp.shapeLocations([], ROOT) === 'No results.',
  'shapeLocations: empty → No results.');

test(mcp.shapeHover({ contents: { kind: 'markdown', value: 'HELLO' } }) === 'HELLO',
  'shapeHover: returns markdown value');
test(mcp.shapeHover({ contents: null }) === 'No hover information.',
  'shapeHover: null contents → message');

var docSyms = [
  { name: 'com.x.Foo', kind: 5, range: { start: { line: 17 } }, children: [
    { name: 'bar', kind: 7, range: { start: { line: 20 } } },
    { name: 'baz', kind: 6, range: { start: { line: 30 } } }
  ] }
];
var docOut = mcp.shapeDocumentSymbols(docSyms, ROOT);
test(docOut.indexOf('com.x.Foo [class] @17') === 0, 'shapeDocumentSymbols: class line');
test(docOut.indexOf('  bar [property] @20') !== -1, 'shapeDocumentSymbols: indented child property');
test(docOut.indexOf('  baz [method] @30') !== -1, 'shapeDocumentSymbols: indented child method');

var wsHits = [
  { name: 'data', kind: 7, containerName: 'foam.u2.DetailView',
    location: { uri: 'file:///proj/src/DetailView.js', range: { start: { line: 17 } } } }
];
test(mcp.shapeWorkspaceSymbols(wsHits, ROOT, 60) === 'foam.u2.DetailView.data [property] src/DetailView.js:17',
  'shapeWorkspaceSymbols: container.name [kind] path:line');
var many = [];
for ( var i = 0 ; i < 70 ; i++ ) {
  many.push({ name: 'C' + i, kind: 5, containerName: 'p.C' + i,
    location: { uri: 'file:///proj/C' + i + '.js', range: { start: { line: i } } } });
}
var manyOut = mcp.shapeWorkspaceSymbols(many, ROOT, 60);
test(manyOut.split('\n').length === 61 && manyOut.indexOf('10 more') !== -1,
  'shapeWorkspaceSymbols: caps at 60 and appends a truncation note');

var fileDiags = [
  { range: { start: { line: 5, character: 4 } }, severity: 2, code: 'i18n', message: 'Hardcoded string' }
];
test(mcp.shapeDiagnostics(fileDiags, ROOT, 'file:///proj/src/Z.js') === 'src/Z.js:5:4 [warn i18n] Hardcoded string',
  'shapeDiagnostics: single-file array form');
var wsDiags = { 'file:///proj/A.js': [ { range: { start: { line: 1, character: 0 } }, severity: 1, message: 'boom' } ] };
test(mcp.shapeDiagnostics(wsDiags, ROOT) === 'A.js:1:0 [error] boom',
  'shapeDiagnostics: whole-workspace map form');
test(mcp.shapeDiagnostics([], ROOT, 'file:///proj/A.js') === 'No diagnostics.',
  'shapeDiagnostics: empty array → message');

var items = [ { name: 'Sub', detail: 'com.x.Sub', uri: 'file:///proj/Sub.js', range: { start: { line: 9, character: 0 } } } ];
test(mcp.shapeItems(items, ROOT)[0] === 'Sub (com.x.Sub) — Sub.js:9:0',
  'shapeItems: name (detail) — path:line:character');
test(mcp.shapeItems([], ROOT) === null, 'shapeItems: empty → null');

section('MCP — tool schemas');

var tools = mcp.toolSchemas();
var names = tools.map(function(t) { return t.name; });
test(tools.length === 11, 'toolSchemas: 11 tools — 7 original + 4 trace (got ' + tools.length + ')');
['foam_implementation','foam_type_definition','foam_type_hierarchy','foam_call_hierarchy'].forEach(function(n) {
  test(names.indexOf(n) !== -1, 'toolSchemas: includes new trace tool ' + n);
});
var hover = tools.find(function(t) { return t.name === 'foam_hover'; });
test(hover && hover.inputSchema.properties.symbol && hover.inputSchema.properties.uri,
  'toolSchemas: nav tools accept both symbol and uri (name-addressing)');
var ws = tools.find(function(t) { return t.name === 'foam_workspace_symbols'; });
test(ws && ws.inputSchema.required.indexOf('query') !== -1,
  'toolSchemas: workspace_symbols still requires query');

section('MCP — resolvePos (cursor-position addressing)');

// Name addressing is handled server-side by foam/byName; resolvePos only ever
// sees an explicit uri + line + character and resolves it synchronously.
var pos = mcp.resolvePos(ROOT, { uri: 'src/DetailView.js', line: 3, character: 5 });
test(pos && pos.uri.indexOf('file://') === 0 && pos.uri.endsWith('/src/DetailView.js'),
  'resolvePos: project-relative uri is normalized to file://');
test(pos && pos.line === 3 && pos.character === 5,
  'resolvePos: line/character pass through');

var threw = false;
try { mcp.resolvePos(ROOT, {}); } catch ( e ) { threw = true; }
test(threw, 'resolvePos: throws when neither symbol nor uri is provided');
