/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
var W = require('../why-core.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

var data = { cls_: { name: 'User' }, status: 'DONE' };
// Real properties always carry the three mode visibilities from factories
// (Element2.js:1736-1748: CREATE RW, VIEW RO, EDIT RW); a test property
// without them describes nothing FOAM produces.
function prop(over) {
  return Object.assign({ createVisibility: { name: 'RW' }, readVisibility: { name: 'RO' }, updateVisibility: { name: 'RW' } }, over);
}
function env(perms, fnResults) {
  return {
    evalFn: function(fn, d) {
      var r;
      try { r = fn.call(d, d); } catch (e) { return { err: e.message }; }
      if ( r && typeof r.then === 'function' ) return fnResults && fnResults.has(r) ? fnResults.get(r) : 'pending';
      return r;
    },
    slotGet: function(s) { return s.get(); },
    perm: function(n) { return perms && n in perms ? perms[n] : 'pending'; }
  };
}

// combine / clampFor
t(W.combine('RO', 'RW') === 'RO' && W.combine('RW', 'RO') === 'RO' && W.combine('HIDDEN', 'RW') === 'HIDDEN',
  'combine: HIDDEN wins, RW yields');
t(W.clampFor('VIEW', 'RW') === 'RO' && W.clampFor('EDIT', 'RW') === 'RW', 'clampFor: only VIEW clamps RW');

// propGate ladder
var g = W.propGate(prop({ name: 'email' }), 'EDIT', data, env());
t(g.base.source === 'updateVisibility' && g.base.mode === 'RW' && g.final === 'RW' && g.perm === null, 'propGate: factory defaults, EDIT -> RW');
g = W.propGate(prop({ name: 'email' }), 'VIEW', data, env());
t(g.base.source === 'readVisibility' && g.base.mode === 'RO' && g.clamp === 'RO' && g.final === 'RO', 'propGate: factory defaults, VIEW -> RO via readVisibility (not a clamp)');
g = W.propGate(prop({ name: 'email', visibility: { name: 'RW' } }), 'VIEW', data, env());
t(g.base.source === 'visibility' && g.clamp === 'RW' && g.final === 'RW', 'propGate: constant visibility RW is NOT clamped in VIEW (Element2.js:1841)');
g = W.propGate(prop({ name: 'email', visibility: function() { return { name: 'RW' }; } }), 'VIEW', data, env());
t(g.base.kind === 'function' && g.clamp === 'RO' && g.final === 'RO', 'propGate: visibility FUNCTION result is clamped in VIEW (Element2.js:1854)');
g = W.propGate(prop({ name: 'email', visibility: function() { return { name: 'HIDDEN' }; } }), 'EDIT', data, env());
t(g.base.kind === 'function' && g.base.mode === 'HIDDEN' && g.final === 'HIDDEN', 'propGate: visibility function returning a DisplayMode');
g = W.propGate(prop({ name: 'email', visibility: function() { throw new Error('boom'); } }), 'EDIT', data, env());
t(g.base.mode === 'ERR' && g.base.err === 'boom' && g.final === 'ERR', 'propGate: throwing visibility -> ERR, no throw');
g = W.propGate(prop({ name: 'email', visibility: { get: function() { return 'DISABLED'; } } }), 'EDIT', data, env());
t(g.base.kind === 'slot' && g.final === 'DISABLED', 'propGate: slot visibility');

// permissions
g = W.propGate(prop({ name: 'Salary', writePermissionRequired: true }), 'EDIT', data, env({ 'user.rw.salary': false }));
t(g.perm.rw.name === 'user.rw.salary' && g.perm.ro === null && g.perm.mode === 'RO' && g.final === 'RO',
  'propGate: rw denied, read free -> RO, ro never asked');
g = W.propGate(prop({ name: 'salary', readPermissionRequired: true, writePermissionRequired: true }), 'EDIT', data, env({ 'user.rw.salary': false, 'user.ro.salary': false }));
t(g.perm.ro.name === 'user.ro.salary' && g.final === 'HIDDEN', 'propGate: rw and ro denied -> HIDDEN');
g = W.propGate(prop({ name: 'salary', readPermissionRequired: true }), 'EDIT', data, env({ 'user.rw.salary': false }));
t(g.perm.allowCreate === true && g.final === 'RW', 'propGate: FOAM quirk — read gate alone never restricts (allowCreate stays true)');
g = W.propGate(prop({ name: 'salary', readPermissionRequired: true }), 'EDIT', data, env({ 'user.rw.salary': true }));
t(g.final === 'RW', 'propGate: rw granted -> RW');
g = W.propGate(prop({ name: 'salary', readPermissionRequired: true }), 'EDIT', data, env({}));
t(g.perm.mode === 'pending' && g.final === 'pending', 'propGate: unresolved permission -> pending');
g = W.propGate(prop({ name: 'salary', updatePermissionRequired: true }), 'CREATE', data, env({ 'user.rw.salary': false }));
t(g.perm.allowCreate === true && g.final === 'RW', 'propGate: updatePermissionRequired does not gate CREATE');
g = W.propGate(prop({ name: 'salary', readVisibility: 'HIDDEN', readPermissionRequired: true }), 'VIEW', data, env({ 'user.rw.salary': true }));
t(g.final === 'HIDDEN', 'propGate: base HIDDEN beats granted permission');

// actionGate
var act = { name: 'approve', isEnabled: function() { return this.status === 'PENDING'; }, enabledPermissions: [ 'user.approve' ] };
var a = W.actionGate(act, data, env({ 'user.approve': true }), false);
t(a.available.value === true && a.enabled.fn === false && a.enabled.value === false, 'actionGate: isEnabled false -> disabled');
a = W.actionGate({ name: 'del', availablePermissions: [ 'user.delete' ] }, data, env({ 'user.delete': false }), false);
t(a.available.value === false && a.available.perms[0].result === false, 'actionGate: permission denied -> unavailable');
a = W.actionGate({ name: 'save' }, data, env(), true);
t(a.enabled.running === true && a.enabled.value === false && a.available.value === true, 'actionGate: running -> disabled');
a = W.actionGate({ name: 'x', availablePermissions: [ 'p' ] }, data, env({}), false);
t(a.available.value === 'pending', 'actionGate: unresolved permission -> pending');

var pr = Promise.resolve(false);
var asyncAct = { name: 'ship', isAvailable: function() { return pr; } };
a = W.actionGate(asyncAct, data, env(), false);
t(a.available.fn === 'pending' && a.available.value === 'pending', 'actionGate: async isAvailable -> pending, never ✓ (PromiseSlot semantics)');
var fr = new Map(); fr.set(pr, false);
a = W.actionGate(asyncAct, data, env(null, fr), false);
t(a.available.value === false, 'actionGate: async isAvailable resolved false -> unavailable');

a = W.actionGate({ name: 'x', isAvailable: function() { throw new Error('nope'); } }, data, env(), false);
t(a.available.fn.err === 'nope' && a.available.value === false, 'actionGate: throwing isAvailable -> {err} kept, unavailable');
a = W.actionGate({ name: 'x', enabledPermissions: [ 'e.p' ] }, data, env({ 'e.p': false }), false);
t(a.available.value === true && a.enabled.value === false && a.enabled.perms[0].result === false, 'actionGate: enabledPermissions denied -> disabled only');

var eg = W.errGate({ name: 'q', get label() { throw new Error('label getter'); }, get hidden() { throw new Error('hidden getter'); } }, 'boom');
t(eg.name === 'q' && eg.label === 'q' && eg.hidden === false && eg.final === 'ERR' && eg.base.err === 'boom' && eg.clamp === 'ERR', 'errGate: propGate shape with ERR everywhere; reads only name, so a throwing label/hidden getter cannot throw again');

// sectionGate
var s = W.sectionGate({ name: 'Admin', permissionRequired: true, isAvailable: function() { return true; } }, data, env({ 'user.section.admin': false }));
t(s.available === true && s.perm.name === 'user.section.admin' && s.perm.result === false, 'sectionGate: perm name + result');
s = W.sectionGate({ name: 'S', isAvailable: function() { throw new Error('bad'); } }, data, env());
t(s.available.err === 'bad', 'sectionGate: throwing isAvailable -> {err}');
function pg(name, ladder) { return { name: name, ladder: ladder, final: ladder }; }
s = W.sectionGate({ name: 'S', properties: [ 'a', { name: 'b' }, { name: 'c.d' } ] }, data, env(), [ pg('a', 'RW'), pg('b', 'HIDDEN'), pg('d', 'HIDDEN') ]);
t(s.fields === 2 && s.anyVisible === true, 'sectionGate: explicit members by string or {name}; a dotted path (another class) is not a member');
var gates = [ pg('a', 'HIDDEN'), pg('b', 'HIDDEN'), pg('c', 'RW') ];
s = W.sectionGate({ name: 'Hidden', properties: [ 'a', 'b' ] }, data, env(), gates);
t(s.fields === 2 && s.anyVisible === false, 'sectionGate: explicit properties all HIDDEN -> anyVisible false');
s = W.sectionGate({ name: 'Main' }, data, env(), gates, function(n) { return n === 'c' ? 'Main' : 'Other'; });
t(s.fields === 1 && s.anyVisible === true, 'sectionGate: members by property.section');

// hidden: true is dropped before the ladder when a section collects it by
// `section` (Section.js:178), but the section's own check runs the ladder
// on it anyway (SectionAxiom.js:124-135)
g = W.propGate(prop({ name: 'secret', hidden: true }), 'EDIT', data, env());
t(g.hidden === true && g.listed === false && g.ladder === 'RW' && g.final === 'HIDDEN', 'propGate: unlisted hidden axiom -> final HIDDEN, ladder kept (RW)');
s = W.sectionGate({ name: 'S', properties: [ 'secret' ] }, data, env(), [ g ]);
t(s.anyVisible === true, 'sectionGate: a hidden property with a visible ladder still keeps its section available (FOAM does not filter hidden there)');
// a section that lists the property keeps it, hidden or not (Section.js:161-175)
g = W.propGate(prop({ name: 'secret', hidden: true }), 'EDIT', data, env(), true);
t(g.hidden === true && g.listed === true && g.final === 'RW', 'propGate: listed hidden axiom -> final follows the ladder');
g = W.propGate(prop({ name: 'secret', hidden: true, visibility: 'RO' }), 'EDIT', data, env(), true);
t(g.final === 'RO', 'propGate: listed hidden axiom still answers to visibility');
// listedProps: the explicit names across all sections, own-property only
function sec(props) { var s = { name: 'S' }; if ( props !== undefined ) s.properties = props; return s; }
var L = W.listedProps([ sec([ 'a', { name: 'b' }, 'x.y', { name: 'p.q' }, null ]), sec(), sec([ 'c' ]) ]);
t(L.a === true && L.b === true && L.c === true && ! L.x && ! L.y && ! L.q && Object.keys(L).length === 3, 'listedProps: strings and { name } entries, dotted paths and blanks skipped');
var inherited = Object.create({ properties: [ 'z' ] }); inherited.name = 'S';
t(Object.keys(W.listedProps([ inherited ])).length === 0, 'listedProps: an inherited `properties` is not the axiom\'s own list (hasOwnProperty, as Section.js:161)');
t(Object.keys(W.listedProps(null)).length === 0 && Object.keys(W.listedProps([ { name: 'S', properties: 'a' } ])).length === 0, 'listedProps: no axioms / non-array list -> nothing');

// actions are folded into the section's availability (SectionAxiom.js:137-164)
var okAct = W.actionGate({ name: 'go' }, data, env(), false);
var noAct = W.actionGate({ name: 'no', isAvailable: function() { return false; } }, data, env(), false);
var pendAct = W.actionGate({ name: 'maybe', availablePermissions: [ 'p' ] }, data, env({}), false);
s = W.sectionGate({ name: 'S', properties: [ 'a' ], actions: [ 'go' ] }, data, env(), gates, null, [ okAct, noAct ]);
t(s.fields === 1 && s.actions === 1 && s.anyVisible === true, 'sectionGate: all fields HIDDEN but an explicit action available -> anyVisible true');
s = W.sectionGate({ name: 'S', properties: [ 'a' ] }, data, env(), gates, null, [ okAct, noAct ], function(n) { return n === 'no' ? 'S' : 'Other'; });
t(s.actions === 1 && s.anyVisible === false, 'sectionGate: actions by action.section; the one member is unavailable -> false');
s = W.sectionGate({ name: 'S', properties: [ 'a' ], actions: [ 'maybe' ] }, data, env(), gates, null, [ pendAct ]);
t(s.anyVisible === 'pending', 'sectionGate: no field visible, an action pending -> pending');
s = W.sectionGate({ name: 'S' }, data, env(), null, null, [ okAct ], function() { return 'S'; });
t(s.fields === null && s.actions === 1 && s.anyVisible === true, 'sectionGate: action gates alone still answer anyVisible');

// no auth in scope: env.perm answers null. Property HIDDEN (Element2.js:1888),
// action skips the check (Action.js:218), section permSlot stays false (SectionAxiom.js:87-95).
function noAuth() { var e = env(); e.perm = function() { return null; }; return e; }
g = W.propGate(prop({ name: 'salary', writePermissionRequired: true }), 'EDIT', data, noAuth());
t(g.perm.rw.result === null && g.perm.ro === null && g.perm.mode === 'HIDDEN' && g.final === 'HIDDEN', 'propGate: no auth -> HIDDEN, ro never asked');
g = W.propGate(prop({ name: 'name' }), 'EDIT', data, noAuth());
t(g.perm === null && g.final === 'RW', 'propGate: no auth, no permission gate -> untouched');
a = W.actionGate({ name: 'del', availablePermissions: [ 'user.delete' ], enabledPermissions: [ 'user.x' ] }, data, noAuth(), false);
t(a.available.value === true && a.enabled.value === true && a.available.perms[0].result === null, 'actionGate: no auth -> permission checks skipped, action allowed');
s = W.sectionGate({ name: 'Admin', permissionRequired: true }, data, noAuth());
t(s.perm.result === false && s.perm.noAuth === true, 'sectionGate: no auth -> permissionRequired section blocked (permSlot never set)');

console.log('why-core-test:', passes, 'passed');
