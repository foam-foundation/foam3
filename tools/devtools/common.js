/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Panel-side transport, plus the el() helper and the theme bootstrap every
// extension page (sidebar, panel) shares. Loaded as plain globals; exported
// for Node so the expression builders are testable.
(function(exports) {
  // Both pages: follow the DevTools theme, and build DOM with textContent
  // only (no innerHTML, so class ids need no escaping).
  if ( typeof document !== 'undefined' ) {
    try {
      if ( chrome.devtools.panels.themeName === 'dark' ) document.documentElement.classList.add('dark');
    } catch (e) {}
    exports.el = function(tag, cls, text) {
      var d = document.createElement(tag);
      if ( cls ) d.className = cls;
      if ( text !== undefined ) d.textContent = text;
      return d;
    };
  }

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

  // Reveal a DOM node in the Elements tab: the i-th named layer's, or with i
  // null/undefined the pointed-at element's own. Chrome's inspect() is a Command Line
  // API function that only exists inside inspectedWindow.eval, so the call is
  // composed here; node(i) is the backend's one raw (non-JSON) accessor.
  // inspect(undefined) is a no-op, so a stale index is harmless. The index is
  // coerced to an integer so nothing else can be spliced into the expression.
  function revealExpr(i) {
    return 'inspect(window.__foamDevtools.node(' + ( i == null ? '' : ( parseInt(i, 10) || 0 ) ) + '))';
  }

  function reveal(i) { return foamEval(revealExpr(i)); }

  exports.foamEval   = foamEval;
  exports.rpcExpr    = rpcExpr;
  exports.rpc        = rpc;
  exports.revealExpr = revealExpr;
  exports.reveal     = reveal;
})(typeof module !== 'undefined' ? module.exports : window);
