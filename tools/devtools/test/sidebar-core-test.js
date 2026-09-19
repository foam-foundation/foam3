/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var assert = require('assert');
var S = require('../sidebar-core.js');
var passes = 0;
function t(cond, msg) { assert(cond, msg); passes++; console.log('  ok', msg); }

t(S.shortName('foam.u2.view.TableView') === 'TableView', 'shortName: last segment');

function L(cls, extra) { var l = { cls: cls, dao: null, data: null, prop: null, modes: null }; Object.assign(l, extra || {}); return l; }

// stack is deepest first, as inspect returns it
var stack = [
  L('foam.u2.PropertyBorder', { prop: 'email' }),
  L('foam.u2.table.UnstyledTableRow', { data: { cls: 'com.x.User', id: '123', summary: 'Ajeet' } }),
  L('foam.u2.table.TableView', { dao: { of: 'com.x.User', key: null } }),
  L('foam.comics.v2.DAOBrowseControllerView', { dao: { of: 'com.x.User', key: 'userDAO' } }),
  L('foam.core.ApplicationController')
];
t(S.pathOf(stack) === 'ctrl › DAOBrowseControllerView[userDAO] › TableView[User] › UnstyledTableRow[123] › email',
  'pathOf: root as ctrl, key > of > id brackets, prop layer by name');
t(S.pathOf([ L('com.x.Plain'), L('foam.core.ApplicationController') ]) === 'ctrl › Plain',
  'pathOf: layer with nothing bound -> bare short name');
t(S.pathOf([]) === '', 'pathOf: empty stack -> empty string');

t(S.bindingText(L('x', { view: 'foam.u2.stack.Stack' })) === 'bound to Stack', 'bindingText: view');
t(S.bindingText(L('x', { dao: { key: 'userDAO', of: 'com.x.User' } })) === 'dao userDAO', 'bindingText: dao key wins');
t(S.bindingText(L('x', { dao: { key: null, of: 'com.x.User' } })) === 'dao of User', 'bindingText: dao of');
t(S.bindingText(L('x', { data: { cls: 'com.x.User', id: '1', summary: 'Ajeet' } })) === 'User #1 — Ajeet', 'bindingText: record');
t(S.bindingText(L('x', { prop: 'email' })) === '', 'bindingText: prop alone is not a binding');

t(S.layerText({ cls: 'x', data: { cls: 'com.x.User', id: '1', summary: null }, prop: null }) === 'User #1', 'layerText: record binding');
t(S.layerText({ cls: 'x', prop: 'email' }) === 'prop email', 'layerText: prop only');
t(S.layerText({ cls: 'x', data: { cls: 'com.x.U', id: '2', summary: null }, prop: 'name' }) === 'U #2  prop name', 'layerText: binding then prop');
t(S.bindingText({ cls: 'x', dao: {} }) === 'dao', 'bindingText: dao with neither key nor of');
t(S.pathOf([ { cls: 'foam.u2.Element' } ]) === 'ctrl', 'pathOf: one-layer stack is just ctrl');

console.log('sidebar-core-test:', passes, 'passed');
