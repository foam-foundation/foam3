/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
var W = require('../why-core.js');
var E = require('../why-explain.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

var data = { cls_: { name: 'User' } };
function prop(over) {
  return Object.assign({ createVisibility: { name: 'RW' }, readVisibility: { name: 'RO' }, updateVisibility: { name: 'RW' } }, over);
}
function env(perms) {
  return {
    evalFn: function(fn, d) { var r; try { r = fn.call(d, d); } catch (e) { return { err: e.message }; } return ( r && typeof r.then === 'function' ) ? 'pending' : r; },
    slotGet: function(s) { return s.get(); },
    perm: function(n) { return perms && n in perms ? perms[n] : 'pending'; }
  };
}

t(E.explainProp(W.propGate(prop({ name: 'a' }), 'EDIT', data, env())) === '', 'explainProp: RW -> empty');
t(E.explainProp(W.propGate(prop({ name: 'a' }), 'VIEW', data, env())) === 'readVisibility → RO', 'explainProp: VIEW default is readVisibility, not a clamp');
t(E.explainProp(W.propGate(prop({ name: 'a', visibility: function() { return 'RW'; } }), 'VIEW', data, env())) === 'VIEW clamps RW → RO', 'explainProp: clamp on a function result');
t(E.explainProp(W.propGate(prop({ name: 'a', visibility: function() { return 'HIDDEN'; } }), 'EDIT', data, env())) === 'visibility function → HIDDEN', 'explainProp: function');
t(E.explainProp(W.propGate(prop({ name: 'a', visibility: function() { throw new Error('x'); } }), 'EDIT', data, env())) === 'visibility fn threw: x', 'explainProp: ERR');
t(E.explainProp(W.propGate(prop({ name: 'a', writePermissionRequired: true }), 'EDIT', data, env({ 'user.rw.a': false }))) === 'user.rw.a denied → RO', 'explainProp: rw denied names rw');
t(E.explainProp(W.propGate(prop({ name: 'a', readPermissionRequired: true, writePermissionRequired: true }), 'EDIT', data, env({ 'user.rw.a': false, 'user.ro.a': false }))) === 'user.ro.a denied → HIDDEN', 'explainProp: ro denied names ro');
t(E.explainProp(W.propGate(prop({ name: 'a', readPermissionRequired: true }), 'EDIT', data, env({ 'user.rw.a': false }))) === 'user.rw.a denied but write not gated — no effect', 'explainProp: read-only gate quirk is called out');
t(E.explainProp(W.propGate(prop({ name: 'a', readPermissionRequired: true }), 'EDIT', data, env({}))) === 'permission check pending', 'explainProp: pending');
t(E.explainAction(W.actionGate({ name: 'x', isAvailable: function() { return Promise.resolve(true); } }, data, env(), false)) === 'available: isAvailable pending (async)', 'explainAction: async pending');
t(E.explainSection(W.sectionGate({ name: 'S', properties: [ 'a' ] }, data, env(), [ { name: 'a', final: 'HIDDEN' } ])) === 'all 1 fields HIDDEN', 'explainSection: all hidden');

t(E.explainAction(W.actionGate({ name: 'x', isEnabled: function() { return false; } }, data, env(), false)) === 'enabled: isEnabled → false', 'explainAction: isEnabled');
t(E.explainAction(W.actionGate({ name: 'x', availablePermissions: [ 'p.q' ] }, data, env({ 'p.q': false }), false)) === 'available: p.q denied', 'explainAction: available perm');
t(E.explainAction(W.actionGate({ name: 'x' }, data, env(), true)) === 'enabled: running', 'explainAction: running');
t(E.explainAction(W.actionGate({ name: 'x', confirmationRequired: function() { return true; } }, data, env(), false)) === 'confirm required', 'explainAction: confirm');
t(E.explainAction(W.actionGate({ name: 'x' }, data, env(), false)) === '', 'explainAction: all clear -> empty');

t(E.explainSection(W.sectionGate({ name: 'S', permissionRequired: true }, data, env({ 'user.section.s': false }))) === 'user.section.s denied', 'explainSection: perm');

console.log('why-explain-test:', passes, 'passed');
