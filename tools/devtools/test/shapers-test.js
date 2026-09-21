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
// element_, config and data are FOAM properties (data has a factory on
// detail views), so the code reads them from instance_ only; the fixture
// stores them there like FOAM does.
function u2(id, extra) {
  var e = { cls_: { id: id }, parentNode: null, childNodes: [], instance_: {} };
  extra = extra || {};
  Object.keys(extra).forEach(function(k) {
    if ( k === 'element_' || k === 'config' || k === 'data' ) e.instance_[k] = extra[k];
    else if ( k === 'instance_' ) Object.assign(e.instance_, extra[k]);
    else e[k] = extra[k];
  });
  return e;
}
function dom(parent) { return { nodeType: 1, parentElement: parent || null }; }
var getterReads = 0; // bumped by every data getter trap below; asserted zero at the end

// isWrapper / own / describeRecord
t(P.isWrapper('foam.u2.SlotNode') && ! P.isWrapper('com.x.MyView'), 'isWrapper basics');
var lazy = u2('x', { instance_: { config: 'own' } });
Object.defineProperty(lazy, 'config', { get: function() { throw new Error('factory ran'); } });
t(P.own(lazy, 'config') === 'own' && P.own(lazy, 'element_') === undefined, 'own: reads instance_ only, never the getter');
t(P.describeRecord({ cls_: { id: 'a.B' }, id: 0 }).id === null && P.describeRecord({ cls_: { id: 'a.B' }, id: 'k', toSummary: function() { throw new Error('x'); } }).summary === null,
  'describeRecord: unset id sentinel and throwing toSummary -> null');

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

// layerOf — `data` is a FOAM property, so a set value lives in instance_
var ctrlLayer = P.layerOf(u2('foam.comics.v2.DAOBrowseControllerView', { data: fakeDao, config: { daoKey: 'recDAO' } }));
t(ctrlLayer.dao && ctrlLayer.dao.of === 'com.x.Rec' && ctrlLayer.dao.key === 'recDAO' && ctrlLayer.data === null,
  'layerOf: DAO-bound layer reports of + config.daoKey');
var rec = { cls_: { id: 'com.x.Rec' }, id: 123, toSummary: function() { return 'Ajeet Gill'; } };
var rowLayer = P.layerOf(u2('foam.u2.table.UnstyledTableRow', { data: rec }));
t(rowLayer.data && rowLayer.data.cls === 'com.x.Rec' && rowLayer.data.id === '123' && rowLayer.data.summary === 'Ajeet Gill' && rowLayer.dao === null,
  'layerOf: FObject-bound layer reports cls + id + summary');
// A real PropertyBorder imports data: a prototype getter over the exporter's
// slot in the context (ImportsExports.js:110-125), never in instance_. The
// exporter's own value is read; neither getter runs (imp() below throws from both).
var propLayer = P.layerOf(imp(u2('foam.u2.PropertyBorder', { prop: { name: 'email' } }), rec));
t(propLayer.prop === 'email' && propLayer.data.id === '123', 'layerOf: prop name + imported data, read off the exporter\'s instance_');
var unsetDetail = u2('foam.u2.detail.SectionedDetailView'), factoryRuns = 0;
Object.defineProperty(unsetDetail, 'data', { get: function() { factoryRuns++; return { cls_: { id: 'com.x.Created' } }; } });
t(P.dataOf(unsetDetail) === null && factoryRuns === 0, 'dataOf: unset detail view -> null, its data factory is not run');
P.treeOf(unsetDetail);
t(factoryRuns === 0, 'treeOf: an unset detail view walks without running its data factory');
var unsetExporter = imp(u2('foam.u2.PropertyBorder', { prop: { name: 'email' } }), rec);
unsetExporter.__context__.data$.obj.instance_ = {};
t(P.dataOf(unsetExporter) === null && getterReads === 0, 'dataOf: import whose exporter has not set data -> null, no getter run');
var asExport = u2('foam.u2.PropertyBorder');
asExport.cls_.getAxiomByName = function(n) { return n === 'data' ? { cls_: { id: 'foam.lang.Import' } } : null; };
asExport.__context__ = { data$: { cls_: { id: 'foam.lang.ConstantSlot' }, instance_: { value: rec } } };
t(P.dataOf(asExport) === rec, 'dataOf: an `as data` export (ConstantSlot) is read from its own value');
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
// An imported `data`: the Import axiom, the exporter's PropertySlot in the
// context, and getters that must never be called. The traps count instead of
// throwing: dataOf catches, so a throwing trap that IS read still yields
// null and a null-expecting assertion would pass on the wrong code.
function imp(el, data) {
  el.cls_.getAxiomByName = function(n) { return n === 'data' ? { cls_: { id: 'foam.lang.Import' } } : null; };
  var exporter = { instance_: { data: data } };
  Object.defineProperty(exporter, 'data', { get: function() { getterReads++; return data; } });
  el.__context__ = { data$: { obj: exporter, prop: { name: 'data' } } };
  Object.defineProperty(el, 'data', { get: function() { getterReads++; return data; } });
  return el;
}
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
var lazyRec = { cls_: { id: 'com.x.User' } };
Object.defineProperty(lazyRec, 'address', { get: function() { throw new Error('factory ran'); }, enumerable: true });
t(P.isPropertyValueOf(lazyRec, address, env({ propertyNamesOf: function() { return [ 'address' ]; } })) === false, 'isPropertyValueOf: unset property is never read (no factory)');
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
t(P.layerOf(u2('foam.u2.ActionView', { data: v3 })).view === 'foam.comics.v3.DetailView', 'layerOf: element-bound data reported as view, not data');

// findScreenViews
var screenDao = fakeDao;
var tableView = u2('foam.comics.v2.DAOBrowseControllerView', { data: screenDao, config: { dao: screenDao } });
var v3detail = u2('foam.comics.v3.DetailView', { instance_: { currentData_: orig } });
var nullBorder = u2('foam.u2.borders.NullBorder', { childNodes: [ v3detail ] });
var stackRoot2 = u2('foam.core.u2.navigation.Stack', { childNodes: [ u2('foam.u2.Element', { childNodes: [ nullBorder ] }) ] });
var sv = P.findScreenViews(stackRoot2, env());
t(sv.record && sv.record.data === orig && sv.record.view === v3detail, 'findScreenViews: finds the v3 detail view under the stack');
sv = P.findScreenViews(u2('root', { childNodes: [ tableView ] }), env());
t(sv.record === null && sv.table && sv.table.dao === screenDao, 'findScreenViews: table screen -> no record, table reported');
var v2summary = u2('foam.comics.v2.DAOSummaryView', { data: orig, config: { dao: screenDao } });
sv = P.findScreenViews(u2('root', { childNodes: [ v2summary ] }), env());
t(sv.record && sv.record.data === orig, 'findScreenViews: v2 summary view (record + config) counts as a record screen');
// A screen that is neither comics nor a table still holds a record: the
// sign-in view's data is a SignIn object with no DAO config (issue #5538).
var signIn = { cls_: { id: 'foam.nanos.auth.login.SignIn' }, id: undefined };
var loginView = u2('foam.u2.view.LoginView', { data: signIn, childNodes: [ u2('foam.u2.detail.VerticalDetailView', { data: signIn }) ] });
var loginBtn = u2('foam.u2.ActionView', { data: loginView }); loginView.childNodes.push(loginBtn);
sv = P.findScreenViews(u2('root', { childNodes: [ loginView ] }), env());
t(sv.record && sv.record.data === signIn && sv.record.view === loginView && sv.table === null, 'findScreenViews: plain record view (LoginView -> SignIn) counts as a record screen');
// The sign-in screen has no stack, so the root is the controller and its
// header comes first: ActionViews bound to the controller (an element,
// DAOUpdateView.js:181,195 shape) must not lock in the plain candidate.
var navBtn = u2('foam.u2.ActionView', { data: u2('foam.core.u2.ApplicationController', { isEl: true }) });
sv = P.findScreenViews(u2('root', { childNodes: [ u2('foam.u2.Element', { childNodes: [ navBtn ] }), loginView ] }), env());
t(sv.record && sv.record.data === signIn && sv.record.view === loginView, 'findScreenViews: an ActionView bound to a view before the record view is not the plain candidate');
var rowsTable = u2('foam.comics.v2.DAOBrowseControllerView', { data: screenDao, config: { dao: screenDao }, childNodes: [ u2('foam.u2.table.UnstyledTableRow', { data: orig }) ] });
sv = P.findScreenViews(u2('root', { childNodes: [ rowsTable ] }), env());
t(sv.record === null && sv.table && sv.table.dao === screenDao, 'findScreenViews: rows under a table are not the screen record — still a table screen (pins pre-existing behaviour)');
var wizard = u2('com.x.WizardView', { data: signIn, childNodes: [ rowsTable ] });
sv = P.findScreenViews(u2('root', { childNodes: [ wizard ] }), env());
t(sv.record && sv.record.data === signIn && sv.record.view === wizard, 'findScreenViews: a record view above an embedded table wins');
var enumOnly = u2('foam.u2.view.ReadOnlyEnumView', { data: ACTIVE, ctxObjData: user });
sv = P.findScreenViews(u2('root', { childNodes: [ enumOnly ] }), env());
t(sv.record === null, 'findScreenViews: a value view (enum of an objData record) is not a record screen — pickRecord rules apply (pins pre-existing behaviour)');
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

// resolveRecord / screenTarget
var rr = P.resolveRecord(null, [ u2('foam.u2.table.UnstyledTableRowComponent', { data: row }), u2('foam.u2.table.UnstyledTableRow', { data: row }), tableView ], env());
t(rr && rr.data === row && rr.dao === screenDao && rr.mode === null, 'resolveRecord: pick + nearest DAO above; no mode in scope -> null');
var hdrBtn = u2('foam.u2.ButtonGroup', { __context__: { detailView: v3, controllerMode: 'VIEW' } });
v3.instance_.currentData_ = orig; v3.instance_.config = { dao: screenDao };
rr = P.resolveRecord(hdrBtn, [ hdrBtn, u2('foam.core.u2.navigation.Stack') ], env());
t(rr && rr.data === orig && rr.view === v3 && rr.dao === screenDao && rr.mode === 'VIEW', 'resolveRecord: header element -> detailView export, config dao, context mode');
v3.instance_.currentData_ = work; v3.instance_.controllerMode = { name: 'EDIT' };
var body = u2('x', { __context__: { controllerMode: { name: 'EDIT' } } }); // exported by the v3 view
rr = P.resolveRecord(body, [ imp(u2('foam.u2.PropertyBorder', { prop: { name: 'a' }, ctxObjData: work }), work), v3 ], env());
t(rr && rr.data === work && rr.mode === 'EDIT', 'resolveRecord: recomputed after Edit -> working copy + EDIT from context');
t(P.resolveRecord(null, [ tableView ], env()) === null, 'resolveRecord: nothing -> null');
var st2 = P.screenTarget(stackRoot2, env());
t(st2 && st2.data === orig && st2.view === v3detail, 'screenTarget: record screen');
st2 = P.screenTarget(u2('root', { childNodes: [ tableView ] }), env());
t(st2 && st2.table && st2.table.dao === screenDao, 'screenTarget: table screen');

// childrenOf / treeOf
var tA = u2('com.x.A', { $UID: 1, element_: dom() });
var tB = u2('com.x.B', { $UID: 2, instance_: { shown: false } });
var tSlotKid = u2('com.x.SlotKid', { $UID: 4 });
var tSlot = u2('foam.u2.SlotNode', { $UID: 3, instance_: { node: tSlotKid } });
tA.childNodes = [ tB, 'text child', tSlot ];
t(P.childrenOf(tA).length === 2 && P.childrenOf(tA)[0] === tB && P.childrenOf(tA)[1] === tSlot, 'childrenOf: FObject childNodes only, strings skipped');
t(P.childrenOf(tSlot).length === 1 && P.childrenOf(tSlot)[0] === tSlotKid, 'childrenOf: SlotNode instance_.node is a child');
t(P.childrenOf(null).length === 0, 'childrenOf: null -> []');

var visited = [];
var tree = P.treeOf(tA, 5000, function(el, uid) { visited.push(uid); });
t(tree.root.uid === 1 && tree.root.kids.length === 2 && tree.root.kids[0].uid === 2 && tree.root.kids[1].uid === 3 && tree.root.kids[1].kids[0].uid === 4,
  'treeOf: pre-order nodes keyed by $UID, SlotNode child walked');
t(tree.count === 4 && tree.truncated === false, 'treeOf: count = nodes included, not truncated');
t(tree.root.shown === true && tree.root.kids[0].shown === false, 'treeOf: shown from instance_ only; unset = shown');
t(tree.root.layer.cls === 'com.x.A' && tree.root.kids[0].layer.cls === 'com.x.B', 'treeOf: each node carries layerOf(el)');
t(tree.root.wrapper === false && tree.root.kids[1].wrapper === true, 'treeOf: wrapper flag from isWrapper');
t(visited.join(',') === '1,2,3,4', 'treeOf: visit(el, uid) once per included node, in order');

var cappedSeen = [];
var capped = P.treeOf(tA, 2, function(el, uid) { cappedSeen.push(uid); });
t(capped.count === 2 && capped.truncated === true && capped.root.kids.length === 1 && capped.root.kids[0].uid === 2,
  'treeOf: cap stops adding nodes, truncated flagged');
t(cappedSeen.join(',') === '1,2', 'treeOf: visit never fires for a node the cap left out');

t(P.WRAPPER_CLASSES.length === 4 && P.WRAPPER_CLASSES.every(P.isWrapper) && Object.isFrozen(P.WRAPPER_CLASSES), 'WRAPPER_CLASSES: the isWrapper list, read-only');
t(P.str('abcdef', 4) === 'abcd…' && P.str('abcd', 4) === 'abcd' && P.str(12, 5) === '12', 'str: cut at max with an ellipsis, shorter untouched');
var longId = { cls_: { id: 'com.x.L' }, id: 'x'.repeat(50), toSummary: function() { return 'y'.repeat(70); } };
var desc = P.describeRecord(longId);
t(desc.id.length === 41 && desc.summary.length === 61, 'describeRecord: id cut at 40, summary at 60');

var tCyc = u2('com.x.Cyc', { $UID: 9 });
tCyc.childNodes = [ tCyc ];
var cycTree = P.treeOf(tCyc);
t(cycTree.count === 1 && cycTree.root.kids.length === 0, 'treeOf: cycle terminates, node once');
t(P.treeOf(null).root === null && P.treeOf(null).count === 0, 'treeOf: null root -> root null');

var shownLazy = u2('com.x.Lazy', { $UID: 10 });
Object.defineProperty(shownLazy, 'shown', { get: function() { throw new Error('factory ran'); } });
t(P.treeOf(shownLazy).root.shown === true, 'treeOf: never reads the shown getter');

t(getterReads === 0, 'no test above read a data getter');

console.log('shapers-test:', passes, 'passed');
