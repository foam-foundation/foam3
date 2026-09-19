/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registers the two methods the Tree tab needs. Browser-only glue: the walk
// is shapers.treeOf (tested); this adds the root choice, the uid -> element
// map of the last snapshot, and the hand-off to selection-backend.js.
(function() {
  var D = window.__foamDevtools, P = window.__foamShapers;
  var CAP = 5000;

  // uid -> element for the last snapshot only: a cache of what the panel is
  // looking at, rebuilt on every tree() call, never the selection itself.
  var uidMap = new Map();

  D.register('tree', function() {
    if ( ! D.foamReady() ) return { foam: false };
    // Stack.push only hides the previous view, so the tree starts at the
    // navigation stack's current view, not at ctrl.
    var root = null;
    try { root = ( ctrl.stack && ctrl.stack.current ) || ctrl; } catch (e) { root = window.ctrl; }
    if ( ! root ) return { error: 'no screen' };
    uidMap = new Map();
    var tree = P.treeOf(root, CAP, function(el, uid) { uidMap.set(uid, el); });
    return { tree: tree, selected: D.selectionUid() };
  });

  D.register('selectUid', function(uid) {
    var el = uidMap.get(uid);
    if ( ! el ) return { error: 'stale tree — refresh' };
    // namedStack skips wrappers; a wrapper row still reveals its own DOM
    // node and becomes $v, so it is put in front of the named chain.
    var stack = P.namedStack(el);
    if ( stack[0] !== el ) stack.unshift(el);
    D.selectNode(el, stack);
    return { ok: true };
  });
})();
