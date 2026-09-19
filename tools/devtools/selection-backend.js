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
  var pointed = { el: null, stack: [] };

  D.selectNode = function(el, stack) {
    pointed = { el: el, stack: stack || [] };
    window.$v = pointed.stack[0] || undefined;   // console handle, like React DevTools' $r
    window.$d = ( D.currentTarget() || {} ).data;
  };

  // The i-th layer's DOM node, for the panel's reveal (Chrome's inspect()).
  // The one raw, non-JSON accessor; installed directly, not via register().
  D.node = function(i) {
    var el = pointed.stack[i];
    return el ? el.element_ : undefined;
  };

  // The current target, in priority: the pointed-at element while its DOM
  // node is still in the document (element_ survives detach,
  // Element2.js:733-738); else the record the current screen is about; else
  // the table it lists. { data, view, dao, mode, source } | { table, source } | null.
  D.currentTarget = function() {
    try {
      if ( pointed.el && pointed.el.element_ && pointed.el.element_.isConnected ) {
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
