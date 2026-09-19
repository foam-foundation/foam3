/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
var P = require('../shapers.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

// Fake u2 elements: { cls_: { id }, parentNode, childNodes, element_, instance_ }
// Fake DOM nodes: { nodeType: 1, parentElement }
function u2(id, extra) { var e = { cls_: { id: id }, parentNode: null, childNodes: [] }; Object.assign(e, extra || {}); return e; }
function dom(parent) { return { nodeType: 1, parentElement: parent || null }; }

// namedOwner / isWrapper
var view = u2('com.x.MyView');
var slot = u2('foam.u2.SlotNode', { parentNode: view });
var el   = u2('foam.u2.Element', { parentNode: slot });
t(P.namedOwner(el) === view, 'namedOwner: climbs Element->SlotNode->MyView');
t(P.namedOwner(view) === view, 'namedOwner: non-wrapper returns itself');
var orphan = u2('foam.u2.Element');
t(P.namedOwner(orphan) === orphan, 'namedOwner: all-wrapper chain falls back to input');
t(P.isWrapper('foam.u2.SlotNode') && ! P.isWrapper('com.x.MyView'), 'isWrapper basics');

// resolveOwner
var rootDom = dom(), childDom = dom(rootDom), grandDom = dom(childDom);
var child = u2('com.x.Child', { element_: childDom });
var root  = u2('com.x.Root', { element_: rootDom, childNodes: [ child ] });
child.parentNode = root;
var r1 = P.resolveOwner(root, childDom);
t(r1.el === child && r1.walked === 2 && r1.withDom === 2, 'resolveOwner: node mapped directly');
var r2 = P.resolveOwner(root, grandDom);
t(r2.el === child, 'resolveOwner: unmapped node climbs parentElement to nearest mapped ancestor');
var r3 = P.resolveOwner(root, dom());
t(r3.el === null && r3.walked === 2, 'resolveOwner: no mapped ancestor -> el null, stats still reported');
var cyc = u2('com.x.Cyc', { element_: dom() });
cyc.childNodes = [ cyc ];
var r4 = P.resolveOwner(cyc, dom());
t(r4.walked === 1, 'resolveOwner: cycle in childNodes terminates, counted once');
var slotDom = dom(rootDom);
var slotNode = u2('com.x.SlotChild', { element_: slotDom });
var slotHolder = u2('foam.u2.SlotNode', { instance_: { node: slotNode } });
var root2 = u2('com.x.Root2', { element_: rootDom, childNodes: [ slotHolder ] });
var r5 = P.resolveOwner(root2, slotDom);
t(r5.el === slotNode, 'resolveOwner: walks instance_.node children (SlotNode)');

// dataOwner
var rec = { cls_: { id: 'com.x.Rec' } };
var withData = u2('com.x.DetailView', { instance_: { data: rec } });
t(P.dataOwner(withData) === rec, 'dataOwner: data on the named owner itself');
var input = u2('com.x.Input', { parentNode: u2('com.x.Border', { parentNode: withData }) });
t(P.dataOwner(input) === rec, 'dataOwner: climbs parentNode to an ancestor with data');
var deep = u2('com.x.L0'), cur = deep;
for ( var i = 1 ; i <= 16 ; i++ ) { var p = u2('com.x.L' + i); cur.parentNode = p; cur = p; }
cur.data = rec;
t(P.dataOwner(deep) === null, 'dataOwner: gives up after 15 hops');

console.log('shapers-test:', passes, 'passed');
