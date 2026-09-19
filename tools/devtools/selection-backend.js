/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// The one owner of page-side selection state. inspect-backend.js and
// tree-backend.js tell it which element the user pointed at; why-backend.js
// and open-backend.js ask it what the current target is. Nothing else holds
// a record, view or mode. Also answers "which screen is this" (screenRoot,
// screenKey), since the selection is only meaningful against a screen.
(function() {
  var D = window.__foamDevtools, P = window.__foamShapers;

  // Page-side evaluators for the pure resolvers in shapers.js. objData is
  // FOAM's "the object, not the value" export from PropertyBorder and
  // TableCellFormatter (PropertyBorder.js:38, TableCellFormatter.js:281,305).
  // A view or the navigation stack can be an ActionView's data
  // (DAOUpdateView.js:181,195) — neither is a record.
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

  // The screen: the navigation stack's current view, since Stack.push only
  // hides the previous one (Stack.js:165-171); ctrl itself for an app with
  // no stack. Every walk that means "what is on screen" starts here.
  D.screenRoot = function() {
    try { return ( ctrl.stack && ctrl.stack.current ) || ctrl; } catch (e) { return window.ctrl; }
  };

  // What the user last pointed at, from Elements or from the Tree tab: the
  // element itself and its named stack (deepest first, wrappers folded — the
  // same list the sidebar shows). Only the pointer is stored; the record, DAO
  // and mode are resolved on every ask, because the same element can move
  // from VIEW to EDIT and from the original record to its working copy.
  var pointed = { el: null, stack: [] }, gen = 0;

  D.NO_RECORD = 'no record on this screen — open a record, or select one of its elements in Elements';

  // Returns the named stack so the caller can describe it without a second walk.
  D.selectNode = function(el) {
    pointed = { el: el || null, stack: el ? P.namedStack(el) : [] };
    gen++;
    D.publishHandles(D.currentTarget());
    return pointed.stack;
  };

  // The pointed-at element's $UID, so the Tree tab can highlight its row.
  D.selectionUid = function() { return pointed.el ? pointed.el.$UID : null; };

  // What the panel polls to notice navigation: the route plus the stack
  // position (a push/back within the same hash still changes pos) plus the
  // selection generation, so a new selection reloads without a Refresh.
  D.register('screenKey', function() {
    if ( ! D.foamReady() ) return { foam: false };
    var pos = -1;
    try { pos = ctrl.stack ? ctrl.stack.pos : -1; } catch (e) {}
    return { key: location.hash + '|' + pos + '|' + gen };
  });

  // The console handles, like React DevTools' $r: $v = the pointed-at
  // element, $d = the record of the current target. One writer, called by
  // whoever resolved last (selectNode here, why in why-backend.js).
  D.publishHandles = function(target) {
    window.$v = pointed.el || undefined;
    window.$d = ( target && target.data ) || undefined;
  };

  // "Still on screen" for a hide-based stack: Stack.push only hide()s the
  // previous view (Stack.js:165-171, Element2.js:608-613 toggles a class), so
  // a table row stays in the document after its record is opened.
  // isConnected alone would keep answering with the row; the node must also
  // sit inside the screen's DOM.
  function onScreen(el) {
    var d = P.own(el, 'element_');
    if ( ! d || ! d.isConnected ) return false;
    var host = P.own(D.screenRoot(), 'element_');
    return host ? host.contains(d) : true;
  }

  // A DOM node for the panel's reveal (Chrome's inspect()): the i-th named
  // layer's, or with no index the pointed-at element's own — which differs
  // when a wrapper was pointed at, since the named stack folds wrappers.
  // The one raw, non-JSON accessor; installed directly, not via register().
  D.node = function(i) {
    return P.own(i === undefined ? pointed.el : pointed.stack[i], 'element_');
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
    var s = P.screenTarget(D.screenRoot(), env);
    if ( s ) s.source = 'screen';
    return s;
  };
})();
