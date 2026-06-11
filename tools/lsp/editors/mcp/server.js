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
// Environment:
//   FOAM_PROJECT_ROOT  — absolute path to the FOAM project root (the dir
//                        containing pom.js and the foam3/ submodule).
//                        Falls back to process.cwd() if unset.

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
  if ( uri.startsWith('file://') ) return decodeURIComponent(uri.slice(7));
  return uri;
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
    const text   = fs.readFileSync(fsPath, 'utf8');
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

// --- MCP tool schemas -----------------------------------------------------

function toolSchemas() {
  const pos = {
    uri: {
      type:        'string',
      description: 'Absolute path, project-relative path, or file:// URI'
    },
    line:      { type: 'integer', description: '0-based line number' },
    character: { type: 'integer', description: '0-based column' }
  };
  return [
    {
      name:        'foam_hover',
      description: 'FOAM-aware hover at a cursor position. Returns class docs, property types, method signatures, and short-name resolution from the live FOAM registry.',
      inputSchema: {
        type: 'object', required: ['uri','line','character'], properties: pos
      }
    },
    {
      name:        'foam_definition',
      description: 'Go-to-definition for FOAM classes, property types, or require references at a cursor position.',
      inputSchema: {
        type: 'object', required: ['uri','line','character'], properties: pos
      }
    },
    {
      name:        'foam_references',
      description: 'Find FOAM references: subclasses of a class or implementors of an interface at a cursor position.',
      inputSchema: {
        type: 'object', required: ['uri','line','character'], properties: pos
      }
    },
    {
      name:        'foam_document_symbols',
      description: 'Outline of a FOAM file: classes, properties, methods, actions. Good for quickly understanding a model.',
      inputSchema: {
        type: 'object', required: ['uri'], properties: { uri: pos.uri }
      }
    },
    {
      name:        'foam_workspace_symbols',
      description: 'Search all FOAM classes across the workspace by name (substring match against the full class id).',
      inputSchema: {
        type:     'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Class name or substring, e.g. "MCIFee" or "Fee"' }
        }
      }
    },
    {
      name:        'foam_diagnostics',
      description: 'FOAM-aware diagnostics for a file or the whole workspace: unknown class references, wrong foam.nanos.* imports, CSS-token violations, invalid getters/setters in javaCode blocks.',
      inputSchema: {
        type: 'object', properties: { uri: pos.uri }
      }
    },
    {
      name:        'foam_code_actions',
      description: 'Quick fixes for FOAM diagnostics in a file: extract hardcoded display strings to messages: entries (i18n), replace raw colors with $css-tokens, correct wrong Java import packages, did-you-mean class suggestions. Returns LSP code actions with ready-to-apply workspace edits. Optionally scope to one 0-based line.',
      inputSchema: {
        type:     'object',
        required: ['uri'],
        properties: {
          uri:  pos.uri,
          line: { type: 'integer', description: 'Optional 0-based line — only return actions for diagnostics touching this line' }
        }
      }
    }
  ];
}

// --- Tool dispatch --------------------------------------------------------

async function callTool(lsp, projectRoot, name, args) {
  args = args || {};
  switch ( name ) {
    case 'foam_hover': {
      const uri = normalizeUri(args.uri, projectRoot);
      await lsp.ensureOpen(uri);
      const res = await lsp.request('textDocument/hover', {
        textDocument: { uri: uri },
        position:     { line: args.line | 0, character: args.character | 0 }
      });
      return res || { contents: null };
    }
    case 'foam_definition': {
      const uri = normalizeUri(args.uri, projectRoot);
      await lsp.ensureOpen(uri);
      const res = await lsp.request('textDocument/definition', {
        textDocument: { uri: uri },
        position:     { line: args.line | 0, character: args.character | 0 }
      });
      return res || [];
    }
    case 'foam_references': {
      const uri = normalizeUri(args.uri, projectRoot);
      await lsp.ensureOpen(uri);
      const res = await lsp.request('textDocument/references', {
        textDocument: { uri: uri },
        position:     { line: args.line | 0, character: args.character | 0 },
        context:      { includeDeclaration: false }
      });
      return res || [];
    }
    case 'foam_document_symbols': {
      const uri = normalizeUri(args.uri, projectRoot);
      await lsp.ensureOpen(uri);
      const res = await lsp.request('textDocument/documentSymbol', {
        textDocument: { uri: uri }
      });
      return res || [];
    }
    case 'foam_workspace_symbols': {
      const res = await lsp.request('workspace/symbol', {
        query: String(args.query || '')
      });
      return res || [];
    }
    case 'foam_diagnostics': {
      const uri = args.uri ? normalizeUri(args.uri, projectRoot) : null;
      return await lsp.getDiagnostics(uri);
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
      if ( scoped.length === 0 ) return [];
      const res = await lsp.request('textDocument/codeAction', {
        textDocument: { uri: uri },
        range:        scoped[0].range,
        context:      { diagnostics: scoped }
      });
      return res || [];
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
function toolContent(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

(async function main() {
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
          serverInfo:      { name: 'foam-lsp', version: '0.1.0' }
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
})();
