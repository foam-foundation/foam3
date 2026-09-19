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
// A real PropertyBorder imports data: a prototype getter, never in instance_ (ImportsExports.js:117-125)
var border = u2('foam.u2.PropertyBorder', { prop: { name: 'email' } });
Object.defineProperty(border, 'data', { get: function() { return rec; } });
var propLayer = P.layerOf(border);
t(propLayer.prop === 'email' && propLayer.data.id === '123', 'layerOf: prop name + imported (getter) data');
var modeLayer = P.layerOf(u2('com.x.V', { instance_: { controllerMode: { name: 'EDIT' }, mode: { name: 'RW' } } }));
t(modeLayer.modes.controllerMode === 'EDIT' && modeLayer.modes.displayMode === 'RW', 'layerOf: modes from own instance_ values only');
t(P.layerOf(u2('com.x.V', { controllerMode: { name: 'EDIT' } })).modes.controllerMode === null, 'layerOf: prototype-level controllerMode is not read (no factory run)');

// modeOf
t(P.modeOf({ __context__: { controllerMode: { name: 'VIEW' } } }) === 'VIEW', 'modeOf: enum in context');
t(P.modeOf({ __context__: { controllerMode: 'view' } }) === 'VIEW', 'modeOf: string pushed by startContext, upper-cased');
t(P.modeOf({ __context__: {} }) === null && P.modeOf(null) === null, 'modeOf: nothing in scope -> null');

// pickRecord
function env(over) {
  return Object.assign({
    isDAO: P.isDAO,
    isElement: function(v) { return !! ( v && v.isEl ); },
    objDataOf: function(el) { return el.ctxObjData || null; },
    propertyNamesOf: function(r) { return Object.keys(r).filter(function(k) { return k !== 'cls_'; }); }
  }, over || {});
}
function imp(el, data) { Object.defineProperty(el, 'data', { get: function() { return data; } }); return el; }
var ACTIVE = { cls_: { id: 'com.x.Status' }, label: 'Active' };
var user = { cls_: { id: 'com.x.User' }, id: 1, status: ACTIVE, group: 7 };
var pr = P.pickRecord([
  u2('foam.u2.view.ReadOnlyEnumView', { data: ACTIVE, ctxObjData: user }),
  u2('foam.u2.view.EnumView', { prop: { name: 'status' }, data: ACTIVE, ctxObjData: user }),
  imp(u2('foam.u2.PropertyBorder', { prop: { name: 'status' }, ctxObjData: user }), user)
], env());
t(pr.data === user && pr.view.cls_.id === 'foam.u2.PropertyBorder', 'pickRecord: enum value under PropertyBorder picks the record');
var address = { cls_: { id: 'com.x.Address' }, street: 'x' };
user.address = address;
pr = P.pickRecord([ imp(u2('foam.u2.PropertyBorder', { prop: { name: 'street' }, ctxObjData: address }), address) ], env());
t(pr.data === address, 'pickRecord: field inside a nested FObject picks the nested object');
pr = P.pickRecord([
  u2('foam.u2.view.FObjectView', { data: address, ctxObjData: user }),
  u2('foam.u2.view.FObjectPropertyView', { prop: { name: 'address' }, data: address, ctxObjData: user }),
  imp(u2('foam.u2.PropertyBorder', { prop: { name: 'address' }, ctxObjData: user }), user)
], env());
t(pr.data === user, 'pickRecord: FObjectView chooser picks the outer record');
var orig = { cls_: { id: 'com.x.User' } }, work = { cls_: { id: 'com.x.User' } };
var updateView = u2('foam.comics.v2.DAOUpdateView', { instance_: { data: orig, workingData: work } });
pr = P.pickRecord([ u2('foam.u2.ActionView', { data: { cls_: { id: 'foam.comics.v2.DAOUpdateView' }, isEl: true } }), updateView ], env());
t(pr.data === work && pr.view === updateView, 'pickRecord: ActionView bound to a view is skipped; workingData wins');
var v3 = u2('foam.comics.v3.DetailView', { isEl: true, instance_: { data: orig, workingData: work, currentData_: orig } });
pr = P.pickRecord([ u2('foam.u2.ActionView', { data: v3 }), u2('foam.u2.WrapperNode'), u2('foam.core.u2.navigation.Stack') ], env());
t(pr.data === orig && pr.view.cls_.id === 'foam.u2.ActionView', 'pickRecord: header ActionView bound to a v3 DetailView yields its currentData_');
v3.instance_.currentData_ = work;
t(P.recordOfView(v3) === work, 'recordOfView: currentData_ (v3) beats workingData (v2)');
t(P.recordOfView(u2('x')) === null, 'recordOfView: plain view -> null');
var group = { cls_: { id: 'com.x.Group' }, id: 7 };
pr = P.pickRecord([
  u2('foam.u2.view.ReferenceCitationView', { data: group, ctxObjData: user }),
  u2('foam.u2.view.ReadReferenceView', { prop: { name: 'group' }, data: 7, ctxObjData: user }),
  imp(u2('foam.u2.PropertyBorder', { prop: { name: 'group' }, ctxObjData: user }), user)
], env());
t(pr.data === user, 'pickRecord: reference citation target is skipped');
var row = { cls_: { id: 'com.x.User' }, id: 2 };
pr = P.pickRecord([ u2('foam.u2.table.UnstyledTableRowComponent', { data: row }), u2('foam.u2.table.UnstyledTableRow', { data: row }), u2('foam.u2.table.TableView', { data: fakeDao }) ], env());
t(pr.data === row && pr.view.cls_.id === 'foam.u2.table.UnstyledTableRowComponent', 'pickRecord: table row with no objData is the record');
var parent = { cls_: { id: 'com.x.Parent' }, kids: fakeDao }, child = { cls_: { id: 'com.x.Kid' } };
pr = P.pickRecord([
  u2('foam.u2.table.UnstyledTableRow', { data: child, ctxObjData: parent }),
  u2('foam.u2.table.TableView', { data: fakeDao, ctxObjData: parent }),
  u2('foam.u2.view.EmbeddedTableView', { prop: { name: 'kids' }, data: fakeDao, ctxObjData: parent }),
  imp(u2('foam.u2.PropertyBorder', { prop: { name: 'kids' }, ctxObjData: parent }), parent)
], env());
t(pr.data === child, 'pickRecord: embedded table row under a border wins');
t(P.pickRecord([ u2('foam.u2.table.TableView', { data: fakeDao }) ], env()) === null, 'pickRecord: DAO-only stack -> null');
var badRec = { cls_: { id: 'com.x.Bad' }, toSummary: function() { throw new Error('nope'); } };
var badLayer = P.layerOf(u2('com.x.V', { data: badRec }));
t(badLayer.data.summary === null && badLayer.data.id === null, 'layerOf: throwing toSummary / unset id -> nulls, no throw');

console.log('shapers-test:', passes, 'passed');
