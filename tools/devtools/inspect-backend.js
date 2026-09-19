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
    // The record on screen, the view that holds it, and the controllerMode
    // in force at the selected node (from its context — never the property
    // factory). Shared with other backends (why-backend.js) as D.selection,
    // and handed to the console as $v / $d, like React DevTools' $r.
    var picked = P.pickRecord(lastStack, pickEnv) || { data: null, view: null };
    // The nearest DAO above the record's view: what open-backend.js edits it in.
    var dao = null, from = picked.view ? lastStack.indexOf(picked.view) : -1;
    for ( var j = Math.max(from, 0) ; j < lastStack.length && ! dao ; j++ ) {
      var dd = P.dataOf(lastStack[j]);
      if ( dd && P.isDAO(dd) ) dao = dd;
    }
    D.selection = { data: picked.data, view: picked.view, dao: dao, mode: r.el ? P.modeOf(r.el) : null };
    window.$v = lastStack[0] || undefined;
    window.$d = D.selection.data || undefined;
    return { stack: stack, mapStats: mapStats };
  });

  // Page-side evaluators for the pure pickRecord (shapers.js). objData is
  // FOAM's "the object, not the value" export from PropertyBorder, DetailView
  // and TableCellFormatter (PropertyBorder.js:38, DetailView.js:35,
  // TableCellFormatter.js:281). A view or the navigation stack can be an
  // ActionView's data (DAOUpdateView.js:181,195) — neither is a record.
  var pickEnv = {
    isDAO: P.isDAO,
    isElement: function(v) {
      try {
        return foam.u2.Element.isInstance(v) ||
               ( foam.u2.stack && foam.u2.stack.Stack && foam.u2.stack.Stack.isInstance(v) );
      } catch (e) { return false; }
    },
    objDataOf: function(el) {
      try { var x = el.__context__; return ( x && x.objData && x.objData.cls_ ) ? x.objData : null; }
      catch (e) { return null; }
    },
    propertyNamesOf: function(rec) {
      try { return rec.cls_.getAxiomsByClass(foam.lang.Property).map(function(p) { return p.name; }); }
      catch (e) { return []; }
    }
  };

  // The one raw accessor outside the JSON contract: returns a live DOM node so
  // the panel can evaluate inspect(node(i)) and have Chrome reveal it in the
  // Elements tab. Installed directly, not via register(), so call() never
  // hands out a non-JSON value.
  D.node = function(i) {
    var el = lastStack[i];
    return el ? el.element_ : undefined;
  };
})();
