/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
var T = require('../tree-core.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

function N(uid, cls, kids, extra) {
  var layer = { cls: cls, dao: null, data: null, view: null, prop: null, modes: null };
  Object.assign(layer, ( extra && extra.layer ) || {});
  return { uid: uid, layer: layer, shown: extra && extra.shown === false ? false : true, kids: kids || [] };
}
//  1 Root
//  ├─ 2 DetailView (User #1)
//  │   ├─ 3 PropertyBorder (prop email)
//  │   │   └─ 4 TextField
//  │   └─ 5 Element (hidden)
//  └─ 6 Footer
var tree = { root: N(1, 'com.x.Root', [
  N(2, 'foam.u2.detail.DetailView', [
    N(3, 'foam.u2.PropertyBorder', [ N(4, 'foam.u2.TextField') ], { layer: { prop: 'email' } }),
    N(5, 'foam.u2.Element', [], { shown: false })
  ], { layer: { data: { cls: 'com.x.User', id: '1', summary: null } } }),
  N(6, 'com.x.Footer')
]), count: 6, truncated: false };

t(T.rowText(tree.root.kids[0].layer) === 'User #1', 'rowText: record binding');
t(T.rowText(tree.root.kids[0].kids[0].layer) === 'prop email', 'rowText: prop layer');
t(T.rowText({ cls: 'x', data: { cls: 'com.x.U', id: '2', summary: null }, prop: 'name' }) === 'U #2  prop name', 'rowText: binding then prop');

var all = T.flatten(tree, new Set([ 1, 2, 3 ]));
t(all.map(function(r) { return r.uid; }).join(',') === '1,2,3,4,5,6', 'flatten: pre-order');
t(all.map(function(r) { return r.depth; }).join(',') === '0,1,2,3,2,1', 'flatten: depth per row');
t(all[0].cls === 'Root' && all[1].binding === 'User #1' && all[2].binding === 'prop email', 'flatten: short class + binding');
t(all[1].hasKids === true && all[1].open === true && all[3].hasKids === false && all[5].open === false, 'flatten: hasKids / open flags');
t(all[4].shown === false && all[0].shown === true, 'flatten: shown carried');
var some = T.flatten(tree, new Set([ 1 ]));
t(some.map(function(r) { return r.uid; }).join(',') === '1,2,6', 'flatten: collapsed subtree skipped');
t(T.flatten(tree, new Set()).length === 1, 'flatten: collapsed root -> root row only');
t(T.flatten({ root: null }, new Set()).length === 0 && T.flatten(null, new Set()).length === 0, 'flatten: no root -> []');

t(T.pathTo(tree, 4).join(',') === '1,2,3,4', 'pathTo: root-first path');
t(T.pathTo(tree, 99).length === 0 && T.pathTo(tree, null).length === 0, 'pathTo: miss / null -> []');

var d0 = T.defaultExpanded(tree, null);
t(d0.has(1) && d0.has(2) && d0.has(3) && d0.has(5) && d0.has(6) && ! d0.has(4), 'defaultExpanded: depth 0-2 open, depth 3 not');
var d1 = T.defaultExpanded({ root: N(1, 'a', [ N(2, 'b', [ N(3, 'c', [ N(4, 'd', [ N(5, 'e') ]) ]) ]) ]) }, 5);
t(d1.has(3) && d1.has(4) && ! d1.has(5), 'defaultExpanded: ancestors of the selected node open, not the node');

var pruned = T.pruneExpanded(new Set([ 1, 2, 42 ]), tree);
t(pruned.size === 2 && pruned.has(1) && pruned.has(2) && ! pruned.has(42), 'pruneExpanded: uids gone from the tree dropped');

console.log('tree-core-test:', passes, 'passed');
