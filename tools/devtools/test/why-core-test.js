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

// sectionGate
var s = W.sectionGate({ name: 'Admin', permissionRequired: true, isAvailable: function() { return true; } }, data, env({ 'user.section.admin': false }));
t(s.available === true && s.perm.name === 'user.section.admin' && s.perm.result === false, 'sectionGate: perm name + result');
var gates = [ { name: 'a', final: 'HIDDEN' }, { name: 'b', final: 'HIDDEN' }, { name: 'c', final: 'RW' } ];
s = W.sectionGate({ name: 'Hidden', properties: [ 'a', 'b' ] }, data, env(), gates);
t(s.fields === 2 && s.anyVisible === false, 'sectionGate: explicit properties all HIDDEN -> anyVisible false');
s = W.sectionGate({ name: 'Main' }, data, env(), gates, function(n) { return n === 'c' ? 'Main' : 'Other'; });
t(s.fields === 1 && s.anyVisible === true, 'sectionGate: members by property.section');

console.log('why-core-test:', passes, 'passed');
