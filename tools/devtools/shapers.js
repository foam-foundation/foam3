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

  // The u2.Element that owns a DOM node is usually a plain wrapper (Element,
  // SlotNode) inside the view a developer actually wrote. Climb parentNode
  // past wrappers so the sidebar names "TableView", not "foam.u2.Element".
  // Falls back to the input when every ancestor is a wrapper.
  exports.namedOwner = function(el) {
    var e = el, hops = 0;
    while ( e && e.cls_ && exports.isWrapper(e.cls_.id) && e.parentNode && hops < 50 ) {
      e = e.parentNode; hops++;
    }
    return ( e && e.cls_ ) ? e : el;
  };

  // Every rendered u2.Element keeps its DOM node on element_; children live in
  // childNodes and, for SlotNode, in instance_.node. Walk the tree under root
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
      var d = el.element_;
      if ( d && d.nodeType === 1 && ! map.has(d) ) { map.set(d, el); withDom++; }
      var kids = el.childNodes || [];
      for ( var i = 0 ; i < kids.length ; i++ ) if ( kids[i] && kids[i].cls_ ) stack.push(kids[i]);
      var n = el.instance_ && el.instance_.node;
      if ( n && n.cls_ ) stack.push(n);
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

  function str(v, max) {
    var s = String(v);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  // What one layer binds: a DAO (table, controller), a record (row, detail
  // view), a property (PropertyBorder, ValueView). Each read is guarded so a
  // throwing getter degrades to null instead of losing the whole stack.
  exports.layerOf = function(el) {
    var layer = { cls: el.cls_.id, dao: null, data: null, prop: null, modes: null };
    var d = exports.dataOf(el);
    if ( d && exports.isDAO(d) ) {
      var key = null;
      try { key = ( el.config && el.config.daoKey ) ? String(el.config.daoKey) : null; } catch (e) {}
      layer.dao = { of: ( d.of && d.of.id ) ? d.of.id : null, key: key };
    } else if ( d ) {
      var id = null, summary = null;
      try { id = ( d.id !== undefined && d.id !== null && d.id !== '' && d.id !== 0 ) ? str(d.id, 40) : null; } catch (e) {}
      try { summary = typeof d.toSummary === 'function' ? str(d.toSummary(), 60) : null; } catch (e) {}
      layer.data = { cls: d.cls_.id, id: id, summary: summary || null };
    }
    try { if ( el.prop && el.prop.name ) layer.prop = String(el.prop.name); } catch (e) {}
    // Own values only (instance_): reading el.controllerMode would run its
    // factory and write a value into a view that never asked for one
    // (Element2.js:569); el.mode is an expression on it. The effective mode
    // for the selection comes from modeOf() below instead.
    try {
      var inst = el.instance_ || {};
      layer.modes = { controllerMode: modeName(inst.controllerMode), displayMode: modeName(inst.mode) };
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
  exports.isPropertyValueOf = function(rec, d, env) {
    var names = env.propertyNamesOf(rec) || [];
    for ( var i = 0 ; i < names.length ; i++ ) {
      try { if ( rec[names[i]] === d ) return true; } catch (e) {}
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
  exports.pickRecord = function(stack, env) {
    for ( var i = 0 ; i < stack.length ; i++ ) {
      var L = stack[i], d = exports.dataOf(L);
      if ( ! d || env.isDAO(d) || env.isElement(d) ) continue;
      var w = L.instance_ && L.instance_.workingData;
      if ( w && w.cls_ ) return { data: w, view: L };
      var rec = env.objDataOf(L);
      if ( ! rec || rec === d ) return { data: d, view: L };
      if ( exports.isPropertyValueOf(rec, d, env) ) continue;
      if ( exports.insidePrimitivePropertyView(stack, i, rec) ) continue;
      return { data: d, view: L };
    }
    return null;
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamShapers = {} ));
