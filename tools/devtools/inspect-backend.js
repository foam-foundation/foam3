/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registers the methods the Elements sidebar needs. Browser-only glue: the
// walk and the per-layer shaping are in shapers.js (tested); this adds FOAM
// readiness, timing, the response shape and the page-side selection state.
(function() {
  var D = window.__foamDevtools, P = window.__foamShapers;

  D.register('ping', function() {
    var ready = D.foamReady();
    return { foam: ready, classes: ready ? Object.keys(foam.__context__.__cache__).length : 0 };
  });

  // The last resolved stack, deepest first. Kept so the panel can ask for a
  // layer's DOM node by index (node(i), below) and so the console gets $v/$d
  // — the panel cannot hold page objects, only the page can.
  var lastStack = [];

  D.register('inspect', function(node) {
    if ( ! D.foamReady() ) return { foam: false };
    if ( ! node || node.nodeType !== 1 ) return { error: 'no element selected' };
    var t0 = performance.now();
    var r  = P.resolveOwner(window.ctrl, node);
    var mapStats = { walked: r.walked, withDom: r.withDom, ms: Math.round((performance.now() - t0) * 10) / 10 };
    lastStack = r.el ? P.namedStack(r.el) : [];
    var stack = lastStack.map(P.layerOf);
    // The record on screen and the view that holds it (that view's
    // controllerMode is the mode the record is shown in). Shared with other
    // backends (why-backend.js) as D.selection, and handed to the console as
    // $v / $d, like React DevTools' $r.
    D.selection = { data: null, view: null };
    for ( var i = 0 ; i < lastStack.length ; i++ ) {
      var d = P.dataOf(lastStack[i]);
      if ( d && ! P.isDAO(d) ) { D.selection = { data: d, view: lastStack[i] }; break; }
    }
    window.$v = lastStack[0] || undefined;
    window.$d = D.selection.data || undefined;
    return { stack: stack, mapStats: mapStats };
  });

  // The one raw accessor outside the JSON contract: returns a live DOM node so
  // the panel can evaluate inspect(node(i)) and have Chrome reveal it in the
  // Elements tab. Installed directly, not via register(), so call() never
  // hands out a non-JSON value.
  D.node = function(i) {
    var el = lastStack[i];
    return el ? el.element_ : undefined;
  };
})();
