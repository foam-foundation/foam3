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
t(E.explainSection(W.sectionGate({ name: 'S', properties: [ 'a' ] }, data, env(), [ { name: 'a', ladder: 'HIDDEN', final: 'HIDDEN' } ])) === 'all 1 fields HIDDEN', 'explainSection: all hidden');
var noAct = W.actionGate({ name: 'no', isAvailable: function() { return false; } }, data, env(), false);
t(E.explainSection(W.sectionGate({ name: 'S', properties: [ 'a' ], actions: [ 'no' ] }, data, env(), [ { name: 'a', ladder: 'HIDDEN', final: 'HIDDEN' } ], null, [ noAct ])) === 'all 1 fields HIDDEN, all 1 actions unavailable', 'explainSection: fields and actions both named');
t(E.explainSection(W.sectionGate({ name: 'S', actions: [ 'no' ] }, data, env(), [], null, [ noAct ])) === 'all 1 actions unavailable', 'explainSection: no fields -> only the actions clause');
var pendAct = W.actionGate({ name: 'maybe', availablePermissions: [ 'p' ] }, data, env({}), false);
t(E.explainSection(W.sectionGate({ name: 'S', properties: [ 'a' ], actions: [ 'maybe' ] }, data, env(), [ { name: 'a', ladder: 'HIDDEN', final: 'HIDDEN' } ], null, [ pendAct ])) === 'no field visible; an action\'s isAvailable is pending', 'explainSection: pending action');
t(E.explainProp(W.propGate(prop({ name: 'a', hidden: true }), 'EDIT', data, env())) === 'hidden: true — dropped before the visibility ladder runs (Section.js:178)', 'explainProp: unlisted hidden axiom is the whole answer');
t(E.explainProp(W.propGate(prop({ name: 'a', hidden: true }), 'EDIT', data, env(), true)) === 'hidden: true, but a section lists it, so it renders (Section.js:161-175)', 'explainProp: listed hidden axiom names the section as the reason it shows');
t(E.explainProp(W.propGate(prop({ name: 'a', hidden: true, visibility: 'RO' }), 'EDIT', data, env(), true)) === 'hidden: true, but a section lists it, so it renders (Section.js:161-175); visibility → RO', 'explainProp: listed hidden axiom, then the ladder');
function noAuth() { var e = env(); e.perm = function() { return null; }; return e; }
t(E.explainProp(W.propGate(prop({ name: 'a', writePermissionRequired: true }), 'EDIT', data, noAuth())) === 'no auth in scope → HIDDEN (Element2.js:1888)', 'explainProp: no auth');
t(E.explainAction(W.actionGate({ name: 'x', availablePermissions: [ 'p.q' ] }, data, noAuth(), false)) === '', 'explainAction: no auth -> nothing to explain, the check is skipped');
t(E.explainSection(W.sectionGate({ name: 'S', permissionRequired: true }, data, noAuth())) === 'user.section.s unanswerable — no auth in scope', 'explainSection: no auth names the reason');

t(E.explainAction(W.actionGate({ name: 'x', isEnabled: function() { return false; } }, data, env(), false)) === 'enabled: isEnabled → false', 'explainAction: isEnabled');
t(E.explainAction(W.actionGate({ name: 'x', availablePermissions: [ 'p.q' ] }, data, env({ 'p.q': false }), false)) === 'available: p.q denied', 'explainAction: available perm');
t(E.explainAction(W.actionGate({ name: 'x' }, data, env(), true)) === 'enabled: running', 'explainAction: running');
t(E.explainAction(W.actionGate({ name: 'x', isAvailable: function() { throw new Error('nope'); } }, data, env(), false)) === 'available: isAvailable threw: nope', 'explainAction: throwing isAvailable named as threw, not false');
t(E.explainAction(W.actionGate({ name: 'x', enabledPermissions: [ 'e.p' ] }, data, env({ 'e.p': false }), false)) === 'enabled: e.p denied', 'explainAction: enabled perm');
t(E.explainAction(W.actionGate({ name: 'x', isEnabled: function() { throw new Error('bad'); } }, data, env(), false)) === 'enabled: isEnabled threw: bad', 'explainAction: isEnabled threw');
t(E.explainAction(W.actionGate({ name: 'x', confirmationRequired: function() { throw new Error('cr'); } }, data, env(), false)) === 'confirmationRequired threw: cr', 'explainAction: confirmationRequired threw is named, not silent');
t(E.explainSection(W.sectionGate({ name: 'S', isAvailable: function() { return false; } }, data, env())) === 'isAvailable → false', 'explainSection: isAvailable false');
t(E.explainSection(W.sectionGate({ name: 'S', isAvailable: function() { throw new Error('bad'); } }, data, env())) === 'isAvailable threw: bad', 'explainSection: isAvailable threw');
t(E.explainSection(W.sectionGate({ name: 'S', isAvailable: function() { return Promise.resolve(true); } }, data, env())) === 'isAvailable pending (async)', 'explainSection: isAvailable pending');
t(E.explainAction(W.actionGate({ name: 'x', confirmationRequired: function() { return true; } }, data, env(), false)) === 'confirm required', 'explainAction: confirm');
t(E.explainAction(W.actionGate({ name: 'x' }, data, env(), false)) === '', 'explainAction: all clear -> empty');

t(E.explainSection(W.sectionGate({ name: 'S', permissionRequired: true }, data, env({ 'user.section.s': false }))) === 'user.section.s denied', 'explainSection: perm');

t(E.shouldRepoll({ pending: 2 }, 3) === true && E.shouldRepoll({ pending: 0 }, 3) === false, 'shouldRepoll: pending checks');
t(E.shouldRepoll({ error: 'loading' }, 1) === true && E.shouldRepoll({ error: 'table', final: true }, 3) === false, 'shouldRepoll: error unless final');
t(E.shouldRepoll({ pending: 2 }, 0) === false && E.shouldRepoll(null, 3) === false, 'shouldRepoll: no polls left / no response');

console.log('why-explain-test:', passes, 'passed');
