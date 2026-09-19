/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure DOM -> u2 ownership logic. No window.foam, no DOM API calls, no timers:
// the same file loads in the page as window.__foamShapers (manifest lists it
// before backend.js) and under plain Node for the unit tests.
(function(exports) {
  var WRAPPERS = {
    'foam.u2.Element': 1, 'foam.u2.SlotNode': 1,
    'foam.u2.HTMLView': 1, 'foam.u2.Text': 1
  };

  exports.isWrapper = function(clsId) { return !! WRAPPERS[clsId]; };

  // A FOAM property read can run its factory and store the result (element_
  // creates a DOM node, config creates a controller config, controllerMode
  // defaults to CREATE — Element2.js:546, :569). Everything this file learns
  // about an element comes from values it already holds.
  function own(el, key) {
    var inst = el && el.instance_;
    return inst ? inst[key] : undefined;
  }
  exports.own = own;

  function str(v, max) {
    var s = String(v);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  // { cls, id, summary } for a record, each read guarded. id is null for the
  // unset sentinels FOAM uses ('' / 0 / null / undefined).
  exports.describeRecord = function(d) {
    var id = null, summary = null;
    try { id = ( d.id !== undefined && d.id !== null && d.id !== '' && d.id !== 0 ) ? str(d.id, 40) : null; } catch (e) {}
    try { summary = typeof d.toSummary === 'function' ? str(d.toSummary(), 60) : null; } catch (e) {}
    return { cls: d.cls_.id, id: id, summary: summary || null };
  };

  // A u2 element's FOAM children: the FObject entries of childNodes (strings
  // are text) plus, for SlotNode, the element it currently renders in
  // instance_.node. The one child rule for every walk in this file.
  exports.childrenOf = function(el) {
    var out = [], kids = ( el && el.childNodes ) || [];
    for ( var i = 0 ; i < kids.length ; i++ ) if ( kids[i] && kids[i].cls_ ) out.push(kids[i]);
    var n = el && el.instance_ && el.instance_.node;
    if ( n && n.cls_ ) out.push(n);
    return out;
  };

  // Every rendered u2.Element keeps its DOM node on element_; children come
  // from childrenOf. Walk the tree under root
  // once into a WeakMap(DOM node -> u2.Element), then climb the selected DOM
  // node's parentElement chain until a mapped node appears. Caps: 50000
  // elements and a Set of visited elements, so a cyclic tree still terminates.
  exports.resolveOwner = function(root, domNode) {
    var map = new WeakMap(), seen = new Set();
    var stack = [ root ], walked = 0, withDom = 0;
    while ( stack.length ) {
      var el = stack.pop();
      if ( ! el || ! el.cls_ || seen.has(el) || walked >= 50000 ) continue;
      seen.add(el); walked++;
      var d = own(el, 'element_');
      if ( d && d.nodeType === 1 && ! map.has(d) ) { map.set(d, el); withDom++; }
      var kids = exports.childrenOf(el);
      for ( var i = 0 ; i < kids.length ; i++ ) stack.push(kids[i]);
    }
    var node = domNode;
    while ( node && ! map.has(node) ) node = node.parentElement;
    return { el: node ? map.get(node) : null, walked: walked, withDom: withDom };
  };

  exports.dataOf = function(el) {
    try {
      if ( el.instance_ && el.instance_.data && el.instance_.data.cls_ ) return el.instance_.data;
      if ( el.data && el.data.cls_ ) return el.data;
    } catch (e) {}
    return null;
  };

  // Every non-wrapper element from el up to the root, deepest first. This is
  // the "component stack" the sidebar renders: one row per view a developer
  // wrote, wrappers folded away.
  exports.namedStack = function(el) {
    var out = [], cur = el, hops = 0;
    while ( cur && cur.cls_ && hops < 200 ) {
      if ( ! exports.isWrapper(cur.cls_.id) ) out.push(cur);
      try { cur = cur.parentNode; } catch (e) { break; }
      hops++;
    }
    return out;
  };

  // DAOs are FObjects too (ProxyDAO has cls_), so the class alone can't tell
  // a bound DAO from a bound record; the three DAO methods can.
  exports.isDAO = function(v) {
    return !! v && typeof v.select === 'function' && typeof v.find === 'function' && typeof v.put === 'function';
  };

  // What one layer binds: a DAO (table, controller), a record (row, detail
  // view), a property (PropertyBorder, ValueView). Each read is guarded so a
  // throwing getter degrades to null instead of losing the whole stack.
  exports.layerOf = function(el) {
    var layer = { cls: el.cls_.id, dao: null, data: null, view: null, prop: null, modes: null };
    var d = exports.dataOf(el);
    if ( d && Array.isArray(d.childNodes) ) {
      // bound to another u2 element (ActionView under startContext({ data: self }))
      layer.view = d.cls_.id;
    } else if ( d && exports.isDAO(d) ) {
      var cfg = own(el, 'config'), key = null;
      try { key = ( cfg && cfg.daoKey ) ? String(cfg.daoKey) : null; } catch (e) {}
      layer.dao = { of: ( d.of && d.of.id ) ? d.of.id : null, key: key };
    } else if ( d ) {
      layer.data = exports.describeRecord(d);
    }
    try { if ( el.prop && el.prop.name ) layer.prop = String(el.prop.name); } catch (e) {}
    // Own values only (instance_): reading el.controllerMode would run its
    // factory and write a value into a view that never asked for one
    // (Element2.js:569); el.mode is an expression on it. The effective mode
    // for the selection comes from modeOf() below instead.
    try {
      layer.modes = { controllerMode: modeName(own(el, 'controllerMode')), displayMode: modeName(own(el, 'mode')) };
    } catch (e) { layer.modes = { error: str(e.message, 40) }; }
    return layer;
  };

  function modeName(v) { return v && v.name ? v.name : ( v === undefined || v === null ? null : String(v).toUpperCase() ); }

  // The controllerMode in force where the selected DOM node sits: whatever
  // the nearest context carries (an enum from a comics controller export, or a
  // plain string pushed by startContext — table cells push 'VIEW',
  // UnstyledTableRow.js:189). null = nothing in scope, which FOAM treats as
  // CREATE (Element2.js:569). Never reads the property, so no factory runs.
  exports.modeOf = function(el) {
    try {
      var x = el && el.__context__;
      return x ? modeName(x.controllerMode) : null;
    } catch (e) { return null; }
  };

  // Is d the value of one of rec's properties? That is exactly the relation a
  // property view has to the record above it (Element2.js:1816:
  // el.data$ = X.data$.dot(prop.name)), which is how an enum badge or a nested
  // FObject gets told apart from the record itself.
  // Only values the record already holds are compared: reading an unset
  // property would run its factory and write into the record under
  // inspection (User.address creates an Address, Property.js:520-530). A
  // value view has already read its property, so the value is stored
  // whenever the relation holds. FObject.hasOwnProperty is an instance_ check
  // (FObject.js:449-456), no factory.
  exports.isPropertyValueOf = function(rec, d, env) {
    var names = env.propertyNamesOf(rec) || [];
    for ( var i = 0 ; i < names.length ; i++ ) {
      try { if ( rec.hasOwnProperty(names[i]) && rec[names[i]] === d ) return true; } catch (e) {}
    }
    return false;
  };

  // A Reference field renders its target record as a child citation, and the
  // target is not a property value of the row (the row holds the id). Detect
  // it by the primitive-valued property view (ReadReferenceView: has prop or
  // prop_, dataOf null) sitting between the layer and the objData owner.
  exports.insidePrimitivePropertyView = function(stack, i, rec) {
    for ( var j = i + 1 ; j < stack.length ; j++ ) {
      var u = stack[j], du = exports.dataOf(u), hasProp = false;
      if ( du === rec ) return false;
      try { hasProp = !! ( ( u.prop && u.prop.name ) || ( u.prop_ && u.prop_.name ) ); } catch (e) {}
      if ( hasProp && du === null ) return true;
    }
    return false;
  };

  // The record on screen for a stack (deepest first). Rules, in order:
  // skip layers bound to a DAO or to a view/stack (ActionView under
  // startContext({ data: self }), DAOUpdateView.js:195); an edit screen's
  // own workingData wins over its original (DAOUpdateView.js:83-93); with
  // no objData in scope the layer holds the record (table row, summary view);
  // objData === data means the layer IS the border/detail view of the
  // record; a layer whose data is a property value of objData is a value
  // view (enum, nested FObject) — skip; a citation under a primitive property
  // view is a foreign record — skip; anything else (embedded-table row) is a
  // record of its own.
  // env = { isDAO(v), isElement(v), objDataOf(el), propertyNamesOf(rec) }.
  // The record a detail-type view is currently showing, from its own state:
  // comics v3 DetailView keeps it in currentData_ (data in VIEW, the
  // workingData clone in EDIT, DetailView.js:215-221); comics v2
  // DAOUpdateView edits workingData (DAOUpdateView.js:83-93). Own values
  // only, so nothing is computed on the view's behalf.
  exports.recordOfView = function(el) {
    var cd = own(el, 'currentData_'), wd = own(el, 'workingData');
    if ( cd && cd.cls_ ) return cd;
    if ( wd && wd.cls_ ) return wd;
    return null;
  };

  // The record the current screen is about, with no selection at all: walk
  // the u2 tree under root (the navigation stack's current view) and return
  // the first detail-type view — one holding currentData_/workingData
  // (comics v3 / v2 edit) or a record plus a comics config (v2 summary).
  // Second value: the first DAO-bound view with a config, for table screens.
  exports.findScreenViews = function(root, env) {
    var stack = [ root ], seen = new Set(), walked = 0, record = null, table = null;
    while ( stack.length && walked < 20000 ) {
      var el = stack.pop();
      if ( ! el || ! el.cls_ || seen.has(el) ) continue;
      seen.add(el); walked++;
      if ( ! record ) {
        var held = exports.recordOfView(el);
        var d = held ? null : exports.dataOf(el);
        var cfg = own(el, 'config');
        if ( held ) record = { view: el, data: held };
        else if ( d && ! env.isDAO(d) && cfg && cfg.dao ) record = { view: el, data: d };
        else if ( d && env.isDAO(d) && ! table && cfg ) table = { view: el, dao: d };
      }
      if ( record ) break;
      var kids = el.childNodes || [];
      // push in reverse so the first child is visited first (DFS, document order)
      for ( var i = kids.length - 1 ; i >= 0 ; i-- ) if ( kids[i] && kids[i].cls_ ) stack.push(kids[i]);
      var n = el.instance_ && el.instance_.node;
      if ( n && n.cls_ ) stack.push(n);
    }
    return { record: record, table: table };
  };

  exports.pickRecord = function(stack, env) {
    for ( var i = 0 ; i < stack.length ; i++ ) {
      var L = stack[i], d = exports.dataOf(L);
      if ( ! d || env.isDAO(d) ) continue;
      if ( env.isElement(d) ) {
        // An ActionView bound to its detail view (startContext({ data: self }))
        // stands for that view's record; a Stack or scroll element for nothing.
        var held = exports.recordOfView(d);
        if ( held ) return { data: held, view: L };
        continue;
      }
      var w = exports.recordOfView(L);
      if ( w ) return { data: w, view: L };
      var rec = env.objDataOf(L);
      if ( ! rec || rec === d ) return { data: d, view: L };
      if ( exports.isPropertyValueOf(rec, d, env) ) continue;
      if ( exports.insidePrimitivePropertyView(stack, i, rec) ) continue;
      return { data: d, view: L };
    }
    return null;
  };

  // The nearest DAO to a view: first DAO-bound layer at or above it in the
  // stack, else the view's own comics config (v2 DAOUpdateView, v3 DetailView).
  function daoFor(view, stack, env) {
    var from = stack.indexOf(view);
    for ( var j = Math.max(from, 0) ; j < stack.length ; j++ ) {
      var d = exports.dataOf(stack[j]);
      if ( d && env.isDAO(d) ) return d;
    }
    try { var cfg = own(view, 'config'); if ( cfg && env.isDAO(cfg.dao) ) return cfg.dao; } catch (e) {}
    return null;
  }

  // The controllerMode for a target: the context in force at the element the
  // user pointed at, else the record holder's own (comics views set theirs).
  function modeFor(el, view) {
    var m = exports.modeOf(el);
    if ( m ) return m;
    try { var m2 = own(view, 'controllerMode'); return m2 ? modeName(m2) : null; } catch (e) { return null; }
  }

  // THE one answer to "which record, in which view, in which DAO, in which
  // mode" for a pointed-at element and its named stack. Every page-side
  // caller (sidebar, Why, Open in FOAM) goes through this, so the ladder is
  // written once: pickRecord over the stack; else the detail view the
  // element's context exports (comics v3 puts title and buttons in the
  // navigation stack header, out of the u2 chain — DetailView.js:51,236);
  // then the DAO and the mode for whatever was found. Recomputed on every
  // call, never cached: the same element can move from VIEW to EDIT and from
  // the original record to its working copy after it was pointed at.
  exports.resolveRecord = function(el, stack, env) {
    var picked = exports.pickRecord(stack, env);
    if ( ! picked ) {
      var dv = null;
      try { dv = el && el.__context__ && el.__context__.detailView; } catch (e) {}
      if ( dv ) {
        var d = exports.dataOf(dv);
        var held = exports.recordOfView(dv) || ( d && ! env.isDAO(d) ? d : null );
        if ( held ) picked = { data: held, view: dv };
      }
    }
    if ( ! picked ) return null;
    return { data: picked.data, view: picked.view, dao: daoFor(picked.view, stack, env), mode: modeFor(el, picked.view) };
  };

  // The same answer with nothing pointed at: the record the current screen
  // is about, or the table it lists.
  exports.screenTarget = function(root, env) {
    var found = exports.findScreenViews(root, env);
    if ( found.record ) {
      var v = found.record.view;
      return { data: found.record.data, view: v, dao: daoFor(v, [], env), mode: modeFor(v, v) };
    }
    if ( found.table ) return { table: found.table };
    return null;
  };

  // Snapshot of the u2 tree under root for the Tree tab: pre-order, one node
  // per element, keyed by $UID (stable for the object's life, lib.js:18-28).
  // shown is read from instance_ only (Element2.js:605: Boolean, value true),
  // so an unset shown means visible. cap bounds the snapshot; count is the
  // number of nodes included. visit(el, uid), when given, is called once per
  // included node so the caller can keep its own uid -> element map without
  // a second walk.
  exports.treeOf = function(root, cap, visit) {
    cap = cap || 5000;
    var seen = new Set(), count = 0, truncated = false;
    function node(el) {
      if ( ! el || ! el.cls_ || seen.has(el) ) return null;
      if ( count >= cap ) { truncated = true; return null; }
      seen.add(el); count++;
      var n = { uid: el.$UID, layer: exports.layerOf(el), shown: own(el, 'shown') !== false, kids: [] };
      if ( visit ) visit(el, n.uid);
      var kids = exports.childrenOf(el);
      for ( var i = 0 ; i < kids.length ; i++ ) { var k = node(kids[i]); if ( k ) n.kids.push(k); }
      return n;
    }
    return { root: node(root), count: count, truncated: truncated };
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamShapers = {} ));
