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

console.log('sidebar-core-test:', passes, 'passed');
