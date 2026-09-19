/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registers the two methods the Elements sidebar needs. Browser-only glue:
// the walk itself is in shapers.js (tested); this adds FOAM readiness, timing
// and the response shape.
(function() {
  var D = window.__foamDevtools, P = window.__foamShapers;

  D.register('ping', function() {
    var ready = D.foamReady();
    return { foam: ready, classes: ready ? Object.keys(foam.__context__.__cache__).length : 0 };
  });

  // controllerMode / displayMode are enums with a .name; unset reads as
  // undefined on the element and is reported as null.
  function modeName(v) { return v && v.name ? v.name : ( v === undefined ? null : String(v) ); }

  D.register('inspect', function(node) {
    if ( ! D.foamReady() ) return { foam: false };
    if ( ! node || node.nodeType !== 1 ) return { error: 'no element selected' };
    var t0 = performance.now();
    var r  = P.resolveOwner(window.ctrl, node);
    var mapStats = { walked: r.walked, withDom: r.withDom, ms: Math.round((performance.now() - t0) * 10) / 10 };
    if ( ! r.el ) return { owner: null, mapStats: mapStats };
    var named = P.namedOwner(r.el);
    var data  = P.dataOwner(named);
    var modes;
    try {
      modes = { controllerMode: modeName(named.controllerMode), displayMode: modeName(named.displayMode) };
    } catch (e) { modes = { error: String(e.message).slice(0, 40) }; }
    return {
      owner: {
        cls: r.el.cls_.id,
        named: { cls: named.cls_.id, dataCls: data ? data.cls_.id : null },
        modes: modes
      },
      mapStats: mapStats
    };
  });
})();
