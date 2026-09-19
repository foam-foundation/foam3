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

// namedStack
var stackRoot = u2('com.x.Root');
var stackView = u2('com.x.MyView', { parentNode: stackRoot });
var stackSlot = u2('foam.u2.SlotNode', { parentNode: stackView });
var stackEl   = u2('foam.u2.Element', { parentNode: stackSlot });
var st = P.namedStack(stackEl);
t(st.length === 2 && st[0] === stackView && st[1] === stackRoot, 'namedStack: wrappers skipped, deepest first');
t(P.namedStack(stackRoot).length === 1 && P.namedStack(stackRoot)[0] === stackRoot, 'namedStack: root alone');

// isDAO
var fakeDao = { cls_: { id: 'foam.dao.ProxyDAO' }, of: { id: 'com.x.Rec' }, select: function() {}, find: function() {}, put: function() {} };
t(P.isDAO(fakeDao) === true, 'isDAO: select/find/put functions -> true');
t(P.isDAO({ cls_: { id: 'com.x.Rec' } }) === false, 'isDAO: plain FObject -> false');

// layerOf
var ctrlLayer = P.layerOf(u2('foam.comics.v2.DAOBrowseControllerView', { data: fakeDao, config: { daoKey: 'recDAO' } }));
t(ctrlLayer.dao && ctrlLayer.dao.of === 'com.x.Rec' && ctrlLayer.dao.key === 'recDAO' && ctrlLayer.data === null,
  'layerOf: DAO-bound layer reports of + config.daoKey');
var rec = { cls_: { id: 'com.x.Rec' }, id: 123, toSummary: function() { return 'Ajeet Gill'; } };
var rowLayer = P.layerOf(u2('foam.u2.table.UnstyledTableRow', { data: rec }));
t(rowLayer.data && rowLayer.data.cls === 'com.x.Rec' && rowLayer.data.id === '123' && rowLayer.data.summary === 'Ajeet Gill' && rowLayer.dao === null,
  'layerOf: FObject-bound layer reports cls + id + summary');
var propLayer = P.layerOf(u2('foam.u2.PropertyBorder', { prop: { name: 'email' }, instance_: { data: rec } }));
t(propLayer.prop === 'email' && propLayer.data.id === '123', 'layerOf: prop name + data from instance_.data');
var badRec = { cls_: { id: 'com.x.Bad' }, toSummary: function() { throw new Error('nope'); } };
var badLayer = P.layerOf(u2('com.x.V', { data: badRec }));
t(badLayer.data.summary === null && badLayer.data.id === null, 'layerOf: throwing toSummary / unset id -> nulls, no throw');

console.log('shapers-test:', passes, 'passed');
