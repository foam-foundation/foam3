#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// FOAM LSP MCP Server — exposes the FOAM Language Server as MCP tools
// for any MCP-speaking coding agent (Claude Code, Codex, Gemini, Cursor,
// Pi, ...). Speaks MCP (NDJSON) on its own stdio, spawns the FOAM LSP
// (`foam3/tools/lsp-start.js`) as a child, and speaks LSP (Content-
// Length-framed JSON-RPC) to it.
//
// Tool results are shaped into compact `path:line:character` text rather
// than raw LSP JSON, and navigation tools accept a `symbol` name in place
// of a cursor position — both so AI agents can trace through FOAM code
// efficiently. All positions are 0-based (LSP convention).
//
// Environment:
//   FOAM_PROJECT_ROOT  — absolute path to the FOAM project root (the dir
//                        containing pom.js and the foam3/ submodule).
//                        Falls back to process.cwd() if unset.
//
// Requiring this file (e.g. from tests) loads the pure helpers + schemas
// WITHOUT spawning the LSP; the server only boots when run directly.

'use strict';

const { spawn }   = require('child_process');
const fs          = require('fs');
const path        = require('path');
const readline    = require('readline');

// --- stderr logger (stdout is reserved for MCP protocol) -----------------

function log() {
  const args = Array.prototype.slice.call(arguments);
  process.stderr.write('[foam-mcp] ' + args.join(' ') + '\n');
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// --- URI helpers ---------------------------------------------------------

function normalizeUri(raw, projectRoot) {
  if ( ! raw ) return raw;
  if ( raw.startsWith('file://') ) return raw;
  if ( path.isAbsolute(raw) ) return 'file://' + raw;
  return 'file://' + path.resolve(projectRoot, raw);
}

function uriToPath(uri) {
  if ( ! uri ) return uri;
  if ( uri.startsWith('file://') ) return decodeURIComponent(uri.slice(7));
  return uri;
}

// Project-relative path for compact output. Falls back to the absolute path
// when the file lives outside the project root.
function relPath(uri, projectRoot) {
  var p = uriToPath(uri);
  if ( ! p ) return '';
  if ( projectRoot && p.indexOf(projectRoot) === 0 ) {
    var rel = p.slice(projectRoot.length);
    return rel.replace(/^\/+/, '');
  }
  return p;
}

// --- LSP SymbolKind names (compact output) -------------------------------

const KIND_NAMES = {
  5: 'class', 6: 'method', 7: 'property', 8: 'field', 9: 'constructor',
  10: 'enum', 11: 'interface', 12: 'function', 13: 'variable',
  22: 'enum-value', 24: 'action'
};
function kindName(kind) { return KIND_NAMES[kind] || ('kind' + kind); }

const SEVERITY_NAMES = { 1: 'error', 2: 'warn', 3: 'info', 4: 'hint' };
function severityName(sev) { return SEVERITY_NAMES[sev] || 'info'; }

// --- Output shapers: raw LSP result -> compact agent-friendly text --------

function posOf(range) {
  var s = ( range && range.start ) || { line: 0, character: 0 };
  return s.line + ':' + s.character;
}

function shapeLocations(res, projectRoot) {
  var arr = ! res ? [] : ( Array.isArray(res) ? res : [ res ] );
  if ( arr.length === 0 ) return 'No results.';
  return arr.map(function(loc) {
    return relPath(loc.uri, projectRoot) + ':' + posOf(loc.range);
  }).join('\n');
}

function shapeHover(res) {
  if ( res && res.contents ) {
    if ( typeof res.contents === 'string' ) return res.contents;
    if ( res.contents.value ) return res.contents.value;
  }
  return 'No hover information.';
}

function shapeDocumentSymbols(res, projectRoot) {
  if ( ! Array.isArray(res) || res.length === 0 ) return 'No symbols.';
  var lines = [];
  function walk(sym, depth) {
    var indent = '  '.repeat(depth);
    var line = ( sym.range && sym.range.start ) ? sym.range.start.line : 0;
    lines.push(indent + sym.name + ' [' + kindName(sym.kind) + '] @' + line);
    if ( Array.isArray(sym.children) ) {
      for ( var i = 0 ; i < sym.children.length ; i++ ) walk(sym.children[i], depth + 1);
    }
  }
  for ( var i = 0 ; i < res.length ; i++ ) walk(res[i], 0);
  return lines.join('\n');
}

function shapeWorkspaceSymbols(res, projectRoot, cap) {
  if ( ! Array.isArray(res) || res.length === 0 ) return 'No matching symbols.';
  cap = cap || 60;
  var shown = res.slice(0, cap);
  var lines = shown.map(function(s) {
    var loc  = s.location || {};
    var line = ( loc.range && loc.range.start ) ? loc.range.start.line : 0;
    var name = s.containerName ? ( s.containerName + '.' + s.name ) : s.name;
    return name + ' [' + kindName(s.kind) + '] ' + relPath(loc.uri, projectRoot) + ':' + line;
  });
  if ( res.length > cap ) {
    lines.push('… ' + ( res.length - cap ) + ' more — narrow the query for the rest.');
  }
  return lines.join('\n');
}

function shapeDiagnostics(res, projectRoot, uri) {
  // A single-file request returns Diagnostic[]; a whole-workspace request
  // returns { uri: Diagnostic[] }.
  function fmt(rel, d) {
    var line = ( d.range && d.range.start ) ? d.range.start.line : 0;
    var col  = ( d.range && d.range.start ) ? d.range.start.character : 0;
    var code = d.code ? ( ' ' + d.code ) : '';
    return rel + ':' + line + ':' + col + ' [' + severityName(d.severity) + code + '] ' + d.message;
  }
  if ( Array.isArray(res) ) {
    if ( res.length === 0 ) return 'No diagnostics.';
    var rel = relPath(uri, projectRoot);
    return res.map(function(d) { return fmt(rel, d); }).join('\n');
  }
  if ( res && typeof res === 'object' ) {
    var lines = [];
    for ( var u in res ) {
      var r = relPath(u, projectRoot);
      var ds = res[u] || [];
      for ( var i = 0 ; i < ds.length ; i++ ) lines.push(fmt(r, ds[i]));
    }
    return lines.length ? lines.join('\n') : 'No diagnostics.';
  }
  return 'No diagnostics.';
}

function shapeItems(items, projectRoot) {
  // items: TypeHierarchyItem[] / CallHierarchyItem[] (name + uri + range).
  if ( ! Array.isArray(items) || items.length === 0 ) return null;
  return items.map(function(it) {
    return it.name + ' (' + ( it.detail || '' ) + ') — ' +
      relPath(it.uri, projectRoot) + ':' + posOf(it.range);
  });
}

function shapeCodeActions(res) {
  if ( ! Array.isArray(res) || res.length === 0 ) return 'No code actions.';
  return res.map(function(a, i) {
    var title = a.title || ( a.command && a.command.title ) || ( 'action ' + i );
    return '- ' + title;
  }).join('\n');
}

// --- MCP tool schemas -----------------------------------------------------

function toolSchemas() {
  // Every navigation tool accepts EITHER a `symbol` name OR a cursor position
  // (uri + line + character). Positions are 0-based.
  const target = {
    symbol:    { type: 'string',  description: "Name-addressed target: a class id (\"foam.u2.DetailView\"), a short class name (\"DetailView\"), or Class.member (\"foam.u2.DetailView.data\", \"foam.dao.DAO.find\"). Use this instead of uri+line+character to navigate by name." },
    uri:       { type: 'string',  description: 'Absolute path, project-relative path, or file:// URI (used with line+character)' },
    line:      { type: 'integer', description: '0-based line number' },
    character: { type: 'integer', description: '0-based column' }
  };
  return [
    {
      name:        'foam_hover',
      description: 'FOAM-aware hover for a class or member. Returns class docs, property types, method signatures, and short-name resolution from the live FOAM registry. Address by symbol name or cursor position.',
      inputSchema: { type: 'object', properties: target }
    },
    {
      name:        'foam_definition',
      description: 'Go-to-definition for a FOAM class, property type, or require reference. Address by symbol name or cursor position. Returns path:line:character.',
      inputSchema: { type: 'object', properties: target }
    },
    {
      name:        'foam_references',
      description: 'Find references to a FOAM class: subclasses, interface implementors, and JS/Java/string usages across the workspace. Address by symbol name or cursor position. Returns path:line:character per usage.',
      inputSchema: { type: 'object', properties: target }
    },
    {
      name:        'foam_implementation',
      description: 'Concrete implementors of a FOAM interface (or direct subclasses of a class). Address by symbol name or cursor position.',
      inputSchema: { type: 'object', properties: target }
    },
    {
      name:        'foam_type_definition',
      description: 'For a property usage, jump to the property type class (e.g. a CurrencyCode property → foam.lang.CurrencyCode). Address by symbol name or cursor position.',
      inputSchema: { type: 'object', properties: target }
    },
    {
      name:        'foam_type_hierarchy',
      description: 'Inheritance tree for a FOAM class/interface: supertypes (extends chain) and/or subtypes (subclasses + implementors). Address by symbol name or cursor position.',
      inputSchema: {
        type: 'object',
        properties: Object.assign({}, target, {
          direction: { type: 'string', enum: ['subtypes','supertypes','both'], description: 'Which way to walk the hierarchy (default both)' }
        })
      }
    },
    {
      name:        'foam_call_hierarchy',
      description: 'Call hierarchy for a FOAM method: incoming callers and/or outgoing callees. Address by symbol name (Class.method) or cursor position.',
      inputSchema: {
        type: 'object',
        properties: Object.assign({}, target, {
          direction: { type: 'string', enum: ['incoming','outgoing','both'], description: 'incoming = who calls this, outgoing = what this calls (default both)' }
        })
      }
    },
    {
      name:        'foam_document_symbols',
      description: 'Outline of a FOAM file: classes, properties, methods, actions, with line numbers. Good for quickly understanding a model.',
      inputSchema: {
        type: 'object', required: ['uri'], properties: { uri: target.uri }
      }
    },
    {
      name:        'foam_workspace_symbols',
      description: 'Search all FOAM classes, properties, and methods across the workspace by name (substring match). Returns up to 60 ranked hits as name [kind] path:line; narrow the query if truncated.',
      inputSchema: {
        type:     'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Class/member name or substring, e.g. "DetailView" or "DAO"' }
        }
      }
    },
    {
      name:        'foam_diagnostics',
      description: 'FOAM-aware diagnostics for a file or the whole workspace: unknown class references, wrong foam.nanos.* imports, CSS-token violations, invalid getters/setters in javaCode blocks.',
      inputSchema: {
        type: 'object', properties: { uri: target.uri }
      }
    },
    {
      name:        'foam_code_actions',
      description: 'Quick fixes for FOAM diagnostics in a file: extract hardcoded display strings to messages: entries (i18n), replace raw colors with $css-tokens, correct wrong Java import packages, did-you-mean class suggestions. Optionally scope to one 0-based line.',
      inputSchema: {
        type:     'object',
        required: ['uri'],
        properties: {
          uri:  target.uri,
          line: { type: 'integer', description: 'Optional 0-based line — only return actions for diagnostics touching this line' }
        }
      }
    }
  ];
}

// --- FOAM LSP client ------------------------------------------------------

class FoamLSPClient {
  constructor(projectRoot) {
    this.projectRoot       = projectRoot;
    this.nextId            = 1;
    this.pending           = new Map();       // id -> { resolve, reject }
    this.openedUris        = new Set();
    this.diagnosticsByUri  = new Map();       // uri -> diagnostics[]
    this.buffer            = Buffer.alloc(0);
    this.isReady           = false;
    this._whenReady        = new Promise(function(resolve, reject) {
      this._resolveReady = resolve;
      this._rejectReady  = reject;
    }.bind(this));
  }

  whenReady() { return this._whenReady; }

  start() {
    const entry = path.join(this.projectRoot, 'foam3/tools/lsp-start.js');
    if ( ! fs.existsSync(entry) ) {
      this._rejectReady(new Error('FOAM LSP entry not found at ' + entry));
      return;
    }
    log('spawning LSP:', 'node', entry, '(cwd=' + this.projectRoot + ')');

    this.child = spawn('node', [entry], {
      cwd:   this.projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.child.stdout.on('data', this._onStdout.bind(this));
    this.child.stderr.on('data', function(chunk) {
      // Forward LSP stderr to our stderr with a prefix; never touch stdout.
      const text = chunk.toString('utf8');
      text.split('\n').forEach(function(ln) {
        if ( ln ) process.stderr.write('[foam-lsp] ' + ln + '\n');
      });
    });
    this.child.on('exit', function(code, signal) {
      log('LSP exited code=' + code + ' signal=' + signal);
      if ( ! this.isReady ) {
        this._rejectReady(new Error('LSP exited during init (code=' + code + ')'));
      }
    }.bind(this));

    // Kick off initialize.
    this._rawRequest('initialize', {
      processId:    process.pid,
      rootUri:      'file://' + this.projectRoot,
      capabilities: {
        textDocument: {
          publishDiagnostics: { relatedInformation: false },
          hover:              { contentFormat: ['markdown', 'plaintext'] }
        }
      },
      workspaceFolders: [{
        uri:  'file://' + this.projectRoot,
        name: path.basename(this.projectRoot)
      }]
    }).then(function(initResult) {
      log('LSP initialized');
      this._notify('initialized', {});
      this.isReady = true;
      this._resolveReady(initResult);
    }.bind(this)).catch(function(e) {
      log('LSP initialize failed:', e.message);
      this._rejectReady(e);
    }.bind(this));
  }

  // Stream parser — LSP uses Content-Length framing.
  _onStdout(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while ( true ) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if ( headerEnd < 0 ) return;
      const header = this.buffer.slice(0, headerEnd).toString('utf8');
      const match  = header.match(/Content-Length:\s*(\d+)/i);
      if ( ! match ) {
        // Malformed header — skip past it.
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const len   = parseInt(match[1], 10);
      const total = headerEnd + 4 + len;
      if ( this.buffer.length < total ) return;
      const body  = this.buffer.slice(headerEnd + 4, total).toString('utf8');
      this.buffer = this.buffer.slice(total);
      let msg;
      try { msg = JSON.parse(body); }
      catch (e) { log('LSP body parse error:', e.message); continue; }
      this._onMessage(msg);
    }
  }

  _onMessage(msg) {
    if ( msg.id !== undefined && this.pending.has(msg.id) ) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if ( msg.error ) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else             p.resolve(msg.result);
      return;
    }
    if ( msg.method === 'textDocument/publishDiagnostics' ) {
      const params = msg.params || {};
      if ( params.uri ) this.diagnosticsByUri.set(params.uri, params.diagnostics || []);
      return;
    }
    // Ignore server-initiated window/* and other notifications.
  }

  _sendRaw(message) {
    const body   = JSON.stringify(message);
    const buf    = Buffer.from(body, 'utf8');
    const header = 'Content-Length: ' + buf.length + '\r\n\r\n';
    this.child.stdin.write(header);
    this.child.stdin.write(buf);
  }

  _rawRequest(method, params) {
    const id   = this.nextId++;
    const self = this;
    return new Promise(function(resolve, reject) {
      self.pending.set(id, { resolve: resolve, reject: reject });
      self._sendRaw({ jsonrpc: '2.0', id: id, method: method, params: params });
    });
  }

  _notify(method, params) {
    this._sendRaw({ jsonrpc: '2.0', method: method, params: params });
  }

  async request(method, params) {
    await this.whenReady();
    return this._rawRequest(method, params);
  }

  async ensureOpen(uri) {
    await this.whenReady();
    if ( this.openedUris.has(uri) ) return;
    const fsPath = uriToPath(uri);
    let text;
    try { text = fs.readFileSync(fsPath, 'utf8'); }
    catch (e) { throw new Error('file not found: ' + fsPath); }
    this._notify('textDocument/didOpen', {
      textDocument: {
        uri:        uri,
        languageId: 'javascript',
        version:    1,
        text:       text
      }
    });
    this.openedUris.add(uri);
  }

  async getDiagnostics(uri) {
    await this.whenReady();
    if ( ! uri ) {
      const out = {};
      for ( const entry of this.diagnosticsByUri ) out[entry[0]] = entry[1];
      return out;
    }
    await this.ensureOpen(uri);
    // Diagnostics are pushed asynchronously after didOpen; give the server
    // a moment to publish for this URI.
    for ( let i = 0 ; i < 10 && ! this.diagnosticsByUri.has(uri) ; i++ ) {
      await sleep(100);
    }
    return this.diagnosticsByUri.get(uri) || [];
  }
}

// --- Position resolution --------------------------------------------------

// Returns { uri, line, character } for cursor-position addressing. Name
// addressing is handled server-side by foam/byName (see navRaw/hierarchyRaw),
// so this only ever sees an explicit uri + line + character.
function resolvePos(projectRoot, args) {
  if ( ! args.uri ) throw new Error('provide either "symbol" or "uri"+"line"+"character"');
  // line/character default to 0 when omitted with a uri (start of file).
  return {
    uri:       normalizeUri(args.uri, projectRoot),
    line:      args.line | 0,
    character: args.character | 0
  };
}

// Raw result for a single-request nav op: foam/byName (by class id) when
// addressed by `symbol`, else the cursor-position LSP request. `extraParams`
// merges into the position request (e.g. references' includeDeclaration).
// Symbol mode and position mode return the same LSP shape, so callers run one
// shaper over either.
async function navRaw(lsp, projectRoot, args, op, lspMethod, extraParams) {
  if ( args.symbol ) {
    const r = await lsp.request('foam/byName', { name: args.symbol, op: op });
    if ( r === null ) throw new Error('could not resolve symbol: ' + args.symbol);
    return r;
  }
  const t = resolvePos(projectRoot, args);
  await lsp.ensureOpen(t.uri);
  const params = Object.assign({
    textDocument: { uri: t.uri },
    position:     { line: t.line, character: t.character }
  }, extraParams || {});
  return lsp.request(lspMethod, params);
}

// Two-list hierarchy result. kind 'type' → { a: supertypes, b: subtypes };
// kind 'call' → { a: incoming-callers, b: outgoing-callees }. Symbol mode goes
// through foam/byName (by class id); position mode does the LSP prepare +
// sub-calls. Returns null when the position can't be prepared.
async function hierarchyRaw(lsp, projectRoot, args, kind) {
  if ( args.symbol ) {
    const r = await lsp.request('foam/byName',
      { name: args.symbol, op: kind === 'type' ? 'typeHierarchy' : 'callHierarchy' });
    if ( r === null ) throw new Error('could not resolve symbol: ' + args.symbol);
    if ( kind === 'type' ) return { a: r.supertypes || [], b: r.subtypes || [] };
    return { a: ( r.incoming || [] ).map(function(c) { return c.from; }),
             b: ( r.outgoing || [] ).map(function(c) { return c.to; }) };
  }
  const t = resolvePos(projectRoot, args);
  await lsp.ensureOpen(t.uri);
  const prepMethod = kind === 'type' ? 'textDocument/prepareTypeHierarchy' : 'textDocument/prepareCallHierarchy';
  const prep = await lsp.request(prepMethod, {
    textDocument: { uri: t.uri }, position: { line: t.line, character: t.character }
  });
  const item = Array.isArray(prep) ? prep[0] : prep;
  if ( ! item ) return null;
  if ( kind === 'type' ) {
    return {
      a: await lsp.request('typeHierarchy/supertypes', { item: item }),
      b: await lsp.request('typeHierarchy/subtypes', { item: item })
    };
  }
  const inc = await lsp.request('callHierarchy/incomingCalls', { item: item });
  const og  = await lsp.request('callHierarchy/outgoingCalls', { item: item });
  return { a: ( inc || [] ).map(function(c) { return c.from; }),
           b: ( og || [] ).map(function(c) { return c.to; }) };
}

// --- Tool dispatch --------------------------------------------------------

// Returns a compact text string for the MCP text content block.
async function callTool(lsp, projectRoot, name, args) {
  args = args || {};
  switch ( name ) {
    case 'foam_hover':
      return shapeHover(await navRaw(lsp, projectRoot, args, 'hover', 'textDocument/hover'));
    case 'foam_definition':
      return shapeLocations(await navRaw(lsp, projectRoot, args, 'definition', 'textDocument/definition'), projectRoot);
    case 'foam_references':
      return shapeLocations(await navRaw(lsp, projectRoot, args, 'references', 'textDocument/references',
        { context: { includeDeclaration: false } }), projectRoot);
    case 'foam_implementation':
      return shapeLocations(await navRaw(lsp, projectRoot, args, 'implementation', 'textDocument/implementation'), projectRoot);
    case 'foam_type_definition':
      // Symbol mode resolves the symbol's own definition; position mode jumps
      // to the property type at the cursor.
      return shapeLocations(await navRaw(lsp, projectRoot, args, 'definition', 'textDocument/typeDefinition'), projectRoot);
    case 'foam_type_hierarchy': {
      const hr = await hierarchyRaw(lsp, projectRoot, args, 'type');
      if ( ! hr ) return 'No type hierarchy at this target.';
      const dir = args.direction || 'both';
      const out = [];
      if ( dir === 'supertypes' || dir === 'both' ) {
        const lines = shapeItems(hr.a, projectRoot);
        out.push('Supertypes:\n' + ( lines ? lines.join('\n') : '  (none)' ));
      }
      if ( dir === 'subtypes' || dir === 'both' ) {
        const lines = shapeItems(hr.b, projectRoot);
        out.push('Subtypes:\n' + ( lines ? lines.join('\n') : '  (none)' ));
      }
      return out.join('\n\n');
    }
    case 'foam_call_hierarchy': {
      const hr = await hierarchyRaw(lsp, projectRoot, args, 'call');
      if ( ! hr ) return 'No call hierarchy at this target (point at a method).';
      const dir = args.direction || 'both';
      const out = [];
      if ( dir === 'incoming' || dir === 'both' ) {
        const lines = shapeItems(hr.a, projectRoot);
        out.push('Incoming (callers):\n' + ( lines ? lines.join('\n') : '  (none)' ));
      }
      if ( dir === 'outgoing' || dir === 'both' ) {
        const lines = shapeItems(hr.b, projectRoot);
        out.push('Outgoing (callees):\n' + ( lines ? lines.join('\n') : '  (none)' ));
      }
      return out.join('\n\n');
    }
    case 'foam_document_symbols': {
      const uri = normalizeUri(args.uri, projectRoot);
      await lsp.ensureOpen(uri);
      const res = await lsp.request('textDocument/documentSymbol', {
        textDocument: { uri: uri }
      });
      return shapeDocumentSymbols(res, projectRoot);
    }
    case 'foam_workspace_symbols': {
      const res = await lsp.request('workspace/symbol', { query: String(args.query || '') });
      return shapeWorkspaceSymbols(res, projectRoot, 60);
    }
    case 'foam_diagnostics': {
      const uri = args.uri ? normalizeUri(args.uri, projectRoot) : null;
      const res = await lsp.getDiagnostics(uri);
      return shapeDiagnostics(res, projectRoot, uri);
    }
    case 'foam_code_actions': {
      const uri   = normalizeUri(args.uri, projectRoot);
      const diags = await lsp.getDiagnostics(uri);
      const list  = Array.isArray(diags) ? diags : [];
      const scoped = ( args.line === undefined || args.line === null ) ? list :
        list.filter(function(d) {
          return d.range &&
            d.range.start.line <= (args.line | 0) &&
            (args.line | 0) <= d.range.end.line;
        });
      if ( scoped.length === 0 ) return 'No code actions.';
      const res = await lsp.request('textDocument/codeAction', {
        textDocument: { uri: uri },
        range:        scoped[0].range,
        context:      { diagnostics: scoped }
      });
      return shapeCodeActions(res);
    }
    default:
      throw new Error('Unknown tool: ' + name);
  }
}

// --- MCP server over stdio (NDJSON) --------------------------------------

function sendMCP(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function mcpResult(id, result) { sendMCP({ jsonrpc: '2.0', id: id, result: result }); }
function mcpError(id, code, message) {
  sendMCP({ jsonrpc: '2.0', id: id, error: { code: code, message: message } });
}
function toolContent(text) {
  return { content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text, null, 2) }] };
}

function main() {
  const projectRoot = process.env.FOAM_PROJECT_ROOT || process.cwd();
  log('project root:', projectRoot);

  const lsp = new FoamLSPClient(projectRoot);
  lsp.start();                              // fire-and-forget; tool calls await whenReady()
  lsp.whenReady().catch(function() {});     // prevent unhandled rejection

  const tools = toolSchemas();

  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on('line', async function(line) {
    if ( ! line.trim() ) return;
    let msg;
    try { msg = JSON.parse(line); }
    catch (e) { log('MCP parse error:', e.message); return; }

    const id     = msg.id;
    const method = msg.method;

    if ( id === undefined ) {
      // MCP notification (e.g. notifications/initialized) — no response.
      return;
    }

    try {
      if ( method === 'initialize' ) {
        mcpResult(id, {
          protocolVersion: '2024-11-05',
          capabilities:    { tools: {} },
          serverInfo:      { name: 'foam-lsp', version: '0.2.0' }
        });
        return;
      }
      if ( method === 'tools/list' ) {
        mcpResult(id, { tools: tools });
        return;
      }
      if ( method === 'tools/call' ) {
        const name = msg.params && msg.params.name;
        const args = msg.params && msg.params.arguments;
        try {
          const out = await callTool(lsp, projectRoot, name, args);
          mcpResult(id, toolContent(out));
        } catch (e) {
          log('tool error (' + name + '):', e.message);
          mcpResult(id, {
            content: [{ type: 'text', text: 'Error: ' + e.message }],
            isError: true
          });
        }
        return;
      }
      mcpError(id, -32601, 'Method not found: ' + method);
    } catch (e) {
      mcpError(id, -32603, 'Internal error: ' + e.message);
    }
  });

  rl.on('close', function() {
    log('stdin closed, shutting down');
    if ( lsp.child && ! lsp.child.killed ) lsp.child.kill();
    process.exit(0);
  });
}

// --- exports (for tests) + entrypoint guard ------------------------------

module.exports = {
  normalizeUri, uriToPath, relPath, kindName, severityName,
  shapeLocations, shapeHover, shapeDocumentSymbols, shapeWorkspaceSymbols,
  shapeDiagnostics, shapeItems, shapeCodeActions,
  toolSchemas, resolvePos, callTool, FoamLSPClient
};

if ( require.main === module ) main();
