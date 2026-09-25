/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure Tree-tab logic: turn a tree() snapshot plus the set of expanded uids
// into the flat row list the panel renders. Dual-exported so every rule has
// a Node test; panel.js stays browser glue.
(function(exports, S) {
  // Pre-order rows; a collapsed node's subtree is left out. depth is the
  // indent level, open whether the node's uid is in expanded. With
  // opts.hideWrappers a wrapper node (Element, SlotNode, Text...) gets no
  // row: its children take its place at its depth, as if it were open — so
  // the tree reads as the views someone wrote. The root is always shown.
  exports.flatten = function(tree, expanded, opts) {
    var rows = [], hide = !! ( opts && opts.hideWrappers );
    function walk(n, depth, isRoot) {
      if ( hide && n.wrapper && ! isRoot ) {
        for ( var j = 0 ; j < n.kids.length ; j++ ) walk(n.kids[j], depth, false);
        return;
      }
      var open = expanded.has(n.uid);
      rows.push({ uid: n.uid, depth: depth, cls: S.shortName(n.layer.cls), binding: S.layerText(n.layer),
                  shown: n.shown, wrapper: n.wrapper, hasKids: exports.hasVisibleKids(n, hide), open: open });
      if ( open ) for ( var i = 0 ; i < n.kids.length ; i++ ) walk(n.kids[i], depth + 1, false);
    }
    if ( tree && tree.root ) walk(tree.root, 0, true);
    return rows;
  };

  // Would this node show any row below it? With wrappers hidden, a wrapper
  // child counts only if something non-wrapper sits under it.
  exports.hasVisibleKids = function(n, hide) {
    for ( var i = 0 ; i < n.kids.length ; i++ ) {
      var k = n.kids[i];
      if ( ! hide || ! k.wrapper || exports.hasVisibleKids(k, hide) ) return true;
    }
    return false;
  };

  // Is every toggle on screen open? Decides whether the fold button reads
  // "Collapse all" or "Expand all": one collapsed row anywhere means there is
  // still something to expand. A collapsed row is always in the row list
  // (only its subtree is left out), so the visible rows are enough.
  exports.allOpen = function(tree, expanded, opts) {
    return exports.flatten(tree, expanded, opts).every(function(r) { return ! r.hasKids || r.open; });
  };

  // Every uid in the subtree rooted at uid (the node itself included), for
  // alt-click open/close of a whole branch. [] when uid is not in the tree.
  exports.subtreeUids = function(tree, uid) {
    var out = [];
    function collect(n) { out.push(n.uid); for ( var i = 0 ; i < n.kids.length ; i++ ) collect(n.kids[i]); }
    function find(n) {
      if ( n.uid === uid ) { collect(n); return true; }
      for ( var i = 0 ; i < n.kids.length ; i++ ) if ( find(n.kids[i]) ) return true;
      return false;
    }
    if ( tree && tree.root ) find(tree.root);
    return out;
  };

  // The row that stands for uid on screen: uid itself, or — when it is a
  // wrapper and wrappers are hidden — its nearest ancestor that gets a row.
  // null when uid is not in the tree. So a selection made in Elements (where
  // every div is a foam.u2.Element) still highlights something.
  exports.shownUid = function(tree, uid, opts) {
    var hide = !! ( opts && opts.hideWrappers ), path = exports.pathTo(tree, uid);
    if ( ! path.length ) return null;
    if ( ! hide ) return uid;
    var byUid = {};
    (function index(n) { byUid[n.uid] = n; for ( var i = 0 ; i < n.kids.length ; i++ ) index(n.kids[i]); })(tree.root);
    for ( var i = path.length - 1 ; i > 0 ; i-- ) if ( ! byUid[path[i]].wrapper ) return path[i];
    return path[0];
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

  // First view of a screen: the root and two levels below it open; below
  // that, a chain of only children stays open until it branches (one row of
  // wrapping per level would otherwise cost one click per level); plus every
  // ancestor of the selected node so its row is on screen.
  exports.defaultExpanded = function(tree, selectedUid) {
    var set = new Set();
    function open(n, depth) {
      set.add(n.uid);
      for ( var i = 0 ; i < n.kids.length ; i++ ) {
        if ( depth + 1 <= 2 || n.kids.length === 1 ) open(n.kids[i], depth + 1);
      }
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

  // What is open for this snapshot: the defaults (recomputed every time, so a
  // detail view that rendered after the first poll, or a new screen, still
  // starts open) plus the nodes the user opened, minus the ones the user
  // closed. opened/closed are the user's toggles, kept across polls.
  exports.effectiveExpanded = function(tree, selectedUid, opened, closed) {
    var set = exports.defaultExpanded(tree, selectedUid);
    opened.forEach(function(u) { set.add(u); });
    closed.forEach(function(u) { set.delete(u); });
    return set;
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamTreeCore = {} ),
   typeof module !== 'undefined' ? require('./sidebar-core.js') : window.__foamSidebarCore);
