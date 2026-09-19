/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registers the methods the Elements sidebar needs. Browser-only glue: the
// walk and the per-layer shaping are in shapers.js (tested); this adds FOAM
// readiness, timing and the response shape, and hands the pointed-at
// element to selection-backend.js.
(function() {
  var D = window.__foamDevtools, P = window.__foamShapers;

  D.register('ping', function() {
    var ready = D.foamReady();
    return { foam: ready, classes: ready ? Object.keys(foam.__context__.__cache__).length : 0 };
  });

  D.register('inspect', function(node) {
    if ( ! D.foamReady() ) return { foam: false };
    if ( ! node || node.nodeType !== 1 ) return { error: 'no element selected' };
    var t0 = performance.now();
    var r  = P.resolveOwner(window.ctrl, node);
    var mapStats = { walked: r.walked, withDom: r.withDom, ms: Math.round((performance.now() - t0) * 10) / 10 };
    var stack = r.el ? P.namedStack(r.el) : [];
    D.selectNode(r.el, stack);
    return { stack: stack.map(P.layerOf), mapStats: mapStats };
  });
})();
