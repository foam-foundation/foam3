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
function env(perms) {
  return {
    evalFn: function(fn, d) { try { return fn.call(d, d); } catch (e) { return { err: e.message }; } },
    slotGet: function(s) { return s.get(); },
    perm: function(n) { return perms && n in perms ? perms[n] : 'pending'; }
  };
}

// combine / clampFor
t(W.combine('RO', 'RW') === 'RO' && W.combine('RW', 'RO') === 'RO' && W.combine('HIDDEN', 'RW') === 'HIDDEN',
  'combine: HIDDEN wins, RW yields');
t(W.clampFor('VIEW', 'RW') === 'RO' && W.clampFor('EDIT', 'RW') === 'RW', 'clampFor: only VIEW clamps RW');

// propGate ladder
var g = W.propGate({ name: 'email' }, 'EDIT', data, env());
t(g.base.source === 'default' && g.base.mode === 'RW' && g.final === 'RW' && g.perm === null, 'propGate: no visibility, no perms -> RW');
g = W.propGate({ name: 'email', readVisibility: 'RO' }, 'VIEW', data, env());
t(g.base.source === 'readVisibility' && g.base.mode === 'RO' && g.final === 'RO', 'propGate: mode-specific visibility string');
g = W.propGate({ name: 'email' }, 'VIEW', data, env());
t(g.base.mode === 'RW' && g.clamp === 'RO' && g.final === 'RO', 'propGate: VIEW clamps default RW to RO');
g = W.propGate({ name: 'email', visibility: function() { return { name: 'HIDDEN' }; } }, 'EDIT', data, env());
t(g.base.kind === 'function' && g.base.mode === 'HIDDEN' && g.final === 'HIDDEN', 'propGate: visibility function returning a DisplayMode');
g = W.propGate({ name: 'email', visibility: function() { throw new Error('boom'); } }, 'EDIT', data, env());
t(g.base.mode === 'ERR' && g.base.err === 'boom' && g.final === 'ERR', 'propGate: throwing visibility -> ERR, no throw');
g = W.propGate({ name: 'email', visibility: { get: function() { return 'DISABLED'; } } }, 'EDIT', data, env());
t(g.base.kind === 'slot' && g.final === 'DISABLED', 'propGate: slot visibility');

// permissions
g = W.propGate({ name: 'Salary', writePermissionRequired: true }, 'EDIT', data, env({ 'user.rw.salary': false }));
t(g.perm.rw.name === 'user.rw.salary' && g.perm.ro === null && g.perm.mode === 'RO' && g.final === 'RO',
  'propGate: rw denied, read free -> RO, ro never asked');
g = W.propGate({ name: 'salary', readPermissionRequired: true, writePermissionRequired: true }, 'EDIT', data, env({ 'user.rw.salary': false, 'user.ro.salary': false }));
t(g.perm.ro.name === 'user.ro.salary' && g.final === 'HIDDEN', 'propGate: rw and ro denied -> HIDDEN');
g = W.propGate({ name: 'salary', readPermissionRequired: true }, 'EDIT', data, env({ 'user.rw.salary': false }));
t(g.perm.allowCreate === true && g.final === 'RW', 'propGate: FOAM quirk — read gate alone never restricts (allowCreate stays true)');
g = W.propGate({ name: 'salary', readPermissionRequired: true }, 'EDIT', data, env({ 'user.rw.salary': true }));
t(g.final === 'RW', 'propGate: rw granted -> RW');
g = W.propGate({ name: 'salary', readPermissionRequired: true }, 'EDIT', data, env({}));
t(g.perm.mode === 'pending' && g.final === 'pending', 'propGate: unresolved permission -> pending');
g = W.propGate({ name: 'salary', updatePermissionRequired: true }, 'CREATE', data, env({ 'user.rw.salary': false }));
t(g.perm.allowCreate === true && g.final === 'RW', 'propGate: updatePermissionRequired does not gate CREATE');
g = W.propGate({ name: 'salary', readVisibility: 'HIDDEN', readPermissionRequired: true }, 'VIEW', data, env({ 'user.rw.salary': true }));
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

// sectionGate
var s = W.sectionGate({ name: 'Admin', permissionRequired: true, isAvailable: function() { return true; } }, data, env({ 'user.section.admin': false }));
t(s.available === true && s.perm.name === 'user.section.admin' && s.perm.result === false, 'sectionGate: perm name + result');

console.log('why-core-test:', passes, 'passed');
