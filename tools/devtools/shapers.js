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

  // The data object is normally on the named owner, but a bare input inside a
  // PropertyBorder inherits it from an ancestor: climb up to 15 parents.
  exports.dataOwner = function(named) {
    var cur = named, hops = 0;
    while ( cur && cur.cls_ && hops < 15 ) {
      var data = exports.dataOf(cur);
      if ( data ) return data;
      try { cur = cur.parentNode; } catch (e) { return null; }
      hops++;
    }
    return null;
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamShapers = {} ));
