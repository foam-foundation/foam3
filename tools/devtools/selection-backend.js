/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// The one owner of page-side selection state. inspect-backend.js tells it
// which element the user pointed at; why-backend.js and open-backend.js ask
// it what the current target is. Nothing else holds a record, view or mode.
(function() {
  var D = window.__foamDevtools, P = window.__foamShapers;

  // Page-side evaluators for the pure resolvers in shapers.js. objData is
  // FOAM's "the object, not the value" export from PropertyBorder, DetailView
  // and TableCellFormatter (PropertyBorder.js:38, DetailView.js:35,
  // TableCellFormatter.js:281). A view or the navigation stack can be an
  // ActionView's data (DAOUpdateView.js:181,195) — neither is a record.
  var env = {
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

  // What the user last pointed at in Elements: the owning u2 element and its
  // named stack (deepest first). Only the pointer is stored; the record, DAO
  // and mode are resolved on every ask, because the same element can move
  // from VIEW to EDIT and from the original record to its working copy.
  var pointed = { el: null, stack: [] }, gen = 0;

  D.NO_RECORD = 'no record on this screen — open a record, or select one of its elements in Elements';

  D.selectNode = function(el, stack) {
    pointed = { el: el, stack: stack || [] };
    gen++;
    D.publishHandles(D.currentTarget());
  };

  // Bumps on every Elements click; folded into screenKey so the panel's poll
  // notices a new selection without a manual Refresh.
  D.selectionGen = function() { return gen; };

  // The console handles, like React DevTools' $r: $v = the pointed-at view,
  // $d = the record of the current target. One writer, called by whoever
  // resolved last (selectNode here, why in why-backend.js).
  D.publishHandles = function(target) {
    window.$v = pointed.stack[0] || undefined;
    window.$d = ( target && target.data ) || undefined;
  };

  // "Still on screen" for a hide-based stack: Stack.push only hide()s the
  // previous view (Stack.js:165-171, Element2.js:608-613 toggles a class), so
  // a table row stays in the document after its record is opened.
  // isConnected alone would keep answering with the row; the node must also
  // sit inside the navigation stack's current view.
  function onScreen(el) {
    var d = P.own(el, 'element_');
    if ( ! d || ! d.isConnected ) return false;
    var host = null;
    try { var cur = ctrl.stack && ctrl.stack.current; host = cur && P.own(cur, 'element_'); } catch (e) {}
    return host ? host.contains(d) : true;
  }

  // The i-th layer's DOM node, for the panel's reveal (Chrome's inspect()).
  // The one raw, non-JSON accessor; installed directly, not via register().
  D.node = function(i) {
    return P.own(pointed.stack[i], 'element_');
  };

  // The current target, in priority: the pointed-at element while it is on
  // screen (see onScreen); else the record the current screen is about; else
  // the table it lists. { data, view, dao, mode, source } | { table, source } | null.
  // No side effects: publishing $v/$d is the caller's call.
  D.currentTarget = function() {
    try {
      if ( pointed.el && onScreen(pointed.el) ) {
        var r = P.resolveRecord(pointed.el, pointed.stack, env);
        if ( r ) { r.source = 'selection'; return r; }
      }
    } catch (e) {}
    var root = null;
    try { root = ( ctrl.stack && ctrl.stack.current ) || ctrl; } catch (e) { root = ctrl; }
    var s = P.screenTarget(root, env);
    if ( s ) s.source = 'screen';
    return s;
  };
})();
