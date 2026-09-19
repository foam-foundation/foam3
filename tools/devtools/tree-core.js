/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure Tree-tab logic: turn a tree() snapshot plus the set of expanded uids
// into the flat row list the panel renders. Dual-exported so every rule has
// a Node test; panel.js stays browser glue.
(function(exports, S) {
  // Row label after the class name: the binding (record / dao / view) and
  // the property, when the layer has one.
  exports.rowText = function(layer) {
    var b = S.bindingText(layer), p = layer.prop ? 'prop ' + layer.prop : '';
    return [ b, p ].filter(Boolean).join('  ');
  };

  // Pre-order rows; a collapsed node's subtree is left out. depth is the
  // indent level, open whether the node's uid is in expanded.
  exports.flatten = function(tree, expanded) {
    var rows = [];
    function walk(n, depth) {
      var open = expanded.has(n.uid);
      rows.push({ uid: n.uid, depth: depth, cls: S.shortName(n.layer.cls), binding: exports.rowText(n.layer),
                  shown: n.shown, hasKids: n.kids.length > 0, open: open });
      if ( open ) for ( var i = 0 ; i < n.kids.length ; i++ ) walk(n.kids[i], depth + 1);
    }
    if ( tree && tree.root ) walk(tree.root, 0);
    return rows;
  };

  // Root-first uids from the root down to uid; [] when uid is not in the tree.
  exports.pathTo = function(tree, uid) {
    var path = [];
    function find(n) {
      path.push(n.uid);
      if ( n.uid === uid ) return true;
      for ( var i = 0 ; i < n.kids.length ; i++ ) if ( find(n.kids[i]) ) return true;
      path.pop();
      return false;
    }
    return ( tree && tree.root && uid !== null && uid !== undefined && find(tree.root) ) ? path : [];
  };

  // First view of a screen: the root and two levels below it open, plus every
  // ancestor of the selected node so its row is on screen.
  exports.defaultExpanded = function(tree, selectedUid) {
    var set = new Set();
    function open(n, depth) {
      if ( depth > 2 ) return;
      set.add(n.uid);
      for ( var i = 0 ; i < n.kids.length ; i++ ) open(n.kids[i], depth + 1);
    }
    if ( tree && tree.root ) open(tree.root, 0);
    exports.pathTo(tree, selectedUid).slice(0, -1).forEach(function(u) { set.add(u); });
    return set;
  };

  // The expanded set with uids that left the tree (navigation, re-render)
  // removed, so the set cannot grow without bound across polls.
  exports.pruneExpanded = function(expanded, tree) {
    var live = new Set();
    function walk(n) { live.add(n.uid); for ( var i = 0 ; i < n.kids.length ; i++ ) walk(n.kids[i]); }
    if ( tree && tree.root ) walk(tree.root);
    var out = new Set();
    expanded.forEach(function(u) { if ( live.has(u) ) out.add(u); });
    return out;
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamTreeCore = {} ),
   typeof module !== 'undefined' ? require('./sidebar-core.js') : window.__foamSidebarCore);
