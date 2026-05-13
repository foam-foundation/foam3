/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// LSPMaker - starts FOAM LSP server after all models are loaded.

var path_ = require('path');

exports.description = 'starts FOAM LSP server for IDE integration';

exports.init = function() {
  console.error('[LSP] init');
  flags.loadFiles = true;
  flags.java      = true;
  flags.js        = true;
};

exports.end = function() {
  console.error('[LSP] Loading LSP models...');

  // Load LSP source files
  var lspPom = path_.join(__dirname, 'lsp/pom');
  foam.require(lspPom, false, true);

  // Promote all UNUSED Models to USED so FoamIndex can see them
  for ( var i = 0 ; i < 2 ; i++ ) {
    for ( var key in foam.UNUSED ) {
      try { foam.maybeLookup(key); } catch (x) {}
    }
  }

  // Build file index for go-to-definition
  var index = foam.parse.lsp.FoamIndex.create();
  index.buildFileIndex();
  globalThis.__foamLSPIndex__ = index;

  console.error('[LSP] ' + Object.keys(foam.USED).length + ' models loaded. Starting server...');
  require('./lsp/server').start();
};
