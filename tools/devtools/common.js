/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Panel-side transport. Loaded as plain globals in every extension page
// (sidebar.html, later panel.html); exported for Node so rpcExpr is testable.
(function(exports) {
  // Evaluate an expression in the inspected page and parse the JSON string the
  // backend returns. Backend methods ALWAYS return strings; a raw non-string
  // result means the expression bypassed the backend — surfaced as an error.
  // Never rejects: every failure resolves to {error}.
  function foamEval(expr) {
    return new Promise(function(resolve) {
      chrome.devtools.inspectedWindow.eval(expr, function(result, exc) {
        if ( exc && ( exc.isException || exc.isError ) ) {
          resolve({ error: exc.value || exc.description || 'eval failed' });
          return;
        }
        if ( typeof result !== 'string' ) {
          resolve({ error: result === undefined ? 'no result — page mid-reload?' : 'non-string result' });
          return;
        }
        try { resolve(JSON.parse(result)); }
        catch (e) { resolve({ error: 'bad JSON: ' + e.message }); }
      });
    });
  }

  // Source of the one expression every view sends. argExprs are JS fragments
  // evaluated in the page: '$0' for the Elements-tab selection (a Command Line
  // API variable inside inspectedWindow.eval), JSON.stringify(v) for data.
  // Content scripts inject at document_idle, so a page opened before the
  // extension was loaded has no backend — the fallback names the fix.
  function rpcExpr(name, argExprs) {
    var args = [ JSON.stringify(name) ].concat(argExprs || []).join(', ');
    return 'window.__foamDevtools ? window.__foamDevtools.call(' + args + ') : ' +
      'JSON.stringify({error:"no backend — reload the inspected page (extension scripts inject on page load)"})';
  }

  function rpc(name, argExprs) { return foamEval(rpcExpr(name, argExprs)); }

  // Reveal a stack layer's DOM node in the Elements tab. Chrome's inspect()
  // is a Command Line API function that only exists inside inspectedWindow
  // .eval, so the call is composed here; node(i) is the backend's one raw
  // (non-JSON) accessor. inspect(undefined) is a no-op, so a stale index is
  // harmless. The index is coerced to an integer so nothing else can be
  // spliced into the expression.
  function revealExpr(i) { return 'inspect(window.__foamDevtools.node(' + ( parseInt(i, 10) || 0 ) + '))'; }

  function reveal(i) { return foamEval(revealExpr(i)); }

  exports.foamEval   = foamEval;
  exports.rpcExpr    = rpcExpr;
  exports.rpc        = rpc;
  exports.revealExpr = revealExpr;
  exports.reveal     = reveal;
})(typeof module !== 'undefined' ? module.exports : window);
