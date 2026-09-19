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
          resolve(result === undefined ? {} : { error: 'non-string result' });
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

  exports.foamEval = foamEval;
  exports.rpcExpr  = rpcExpr;
  exports.rpc      = rpc;
})(typeof module !== 'undefined' ? module.exports : window);
