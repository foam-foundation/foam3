/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

try {
  if ( chrome.devtools.panels.themeName === 'dark' ) document.documentElement.classList.add('dark');
} catch (e) {}

var S = window.__foamSidebarCore, E = window.__foamWhyExplain;

// All panel state in one object, one render(state) from it. Tabs added later
// put their response under their own key and their own render function.
var state = { tab: 'why', why: null, pollsLeft: 0 };

// ---- DOM helpers (textContent only) ----
function el(tag, cls, text) {
  var d = document.createElement(tag);
  if ( cls ) d.className = cls;
  if ( text !== undefined ) d.textContent = text;
  return d;
}
function table(headers, rows) {
  var t = el('table'), tr = el('tr');
  headers.forEach(function(h) { tr.appendChild(el('th', null, h)); });
  t.appendChild(tr);
  rows.forEach(function(r) {
    var tr = el('tr');
    r.forEach(function(c) { tr.appendChild(typeof c === 'string' ? el('td', null, c) : el('td', c.cls, c.text)); });
    t.appendChild(tr);
  });
  return t;
}
function section(title, body) {
  var s = el('section');
  s.appendChild(el('h3', null, title));
  s.appendChild(body);
  return s;
}
function permMark(r) { return r === 'pending' ? '…' : ( r ? '✓' : '✗' ); }

// ---- Why tab ----
var MODE_ORDER = { HIDDEN: 0, RO: 1, DISABLED: 2, ERR: 3, pending: 4, RW: 5 };

function renderWhy(w) {
  var root = el('div');
  if ( ! w ) { root.appendChild(el('div', 'muted', 'select an element in the Elements tab, then Refresh')); return root; }
  if ( w.error ) { root.appendChild(el('div', 'err', w.error)); return root; }
  if ( w.foam === false ) { root.appendChild(el('div', null, 'not a FOAM page')); return root; }

  var head = S.shortName(w.cls) + ( w.id ? ' #' + w.id : '' ) + ( w.summary ? ' — ' + w.summary : '' ) +
             '   mode ' + w.mode + ( w.modeDefaulted ? ' (none in scope → FOAM default)' : '' ) +
             ( w.pending ? '   ' + w.pending + ' permission check(s) pending' : '' );
  root.appendChild(el('div', 'record', head));

  var props = w.properties.slice().sort(function(a, b) { return MODE_ORDER[a.final] - MODE_ORDER[b.final]; });
  var notRW = props.filter(function(g) { return g.final !== 'RW'; });
  var rw    = props.filter(function(g) { return g.final === 'RW'; });
  var body = el('div');
  body.appendChild(table([ 'field', 'final', 'why' ], notRW.map(function(g) {
    return [ g.name + ( g.hidden ? ' (hidden axiom)' : '' ), { text: g.final, cls: 'mode ' + g.final }, E.explainProp(g) ];
  })));
  if ( rw.length ) {
    var det = el('details');
    det.appendChild(el('summary', 'muted', 'and ' + rw.length + ' read-write'));
    det.appendChild(el('div', 'muted', rw.map(function(g) { return g.name; }).join(', ')));
    body.appendChild(det);
  }
  root.appendChild(section('Fields (' + notRW.length + ' not RW)', body));

  root.appendChild(section('Validation (' + w.validation.length + ' failing)',
    w.validation.length
      ? table([ 'field', 'value', 'message' ], w.validation.map(function(v) { return [ v.name, { text: v.value, cls: 'val' }, v.message ]; }))
      : el('div', 'muted', 'no errors')));

  var blocked = w.actions.filter(function(a) { return a.available.value !== true || a.enabled.value !== true; });
  root.appendChild(section('Actions (' + blocked.length + ' blocked of ' + w.actions.length + ')',
    w.actions.length
      ? table([ 'action', 'available', 'enabled', 'why' ], w.actions.map(function(a) {
          return [ a.name, permMark(a.available.value), permMark(a.enabled.value), E.explainAction(a) ];
        }))
      : el('div', 'muted', 'no actions')));

  if ( w.sections.length ) {
    root.appendChild(section('Sections', table([ 'section', 'available', 'why' ], w.sections.map(function(s) {
      var ok = s.available && ( ! s.perm || s.perm.result === true );
      return [ s.name, ok ? '✓' : ( s.perm && s.perm.result === 'pending' ? '…' : '✗' ), E.explainSection(s) ];
    }))));
  }

  var denied = w.permissions.filter(function(p) { return p.result === false; });
  var pbody = el('div');
  pbody.appendChild(table([ '', 'permission' ], w.permissions.map(function(p) {
    return [ { text: permMark(p.result), cls: p.result === false ? 'err' : '' }, p.perm ];
  })));
  if ( denied.length ) {
    var ta = el('textarea', 'copy'); ta.readOnly = true; ta.rows = Math.min(6, denied.length + 1);
    ta.value = denied.map(function(p) { return p.perm; }).join('\n');
    ta.title = 'denied permissions — click to select';
    ta.addEventListener('click', function() { ta.select(); });
    pbody.appendChild(el('div', 'muted', 'denied (copy):'));
    pbody.appendChild(ta);
  }
  root.appendChild(section('Permissions checked (' + w.permissions.length + ', ' + denied.length + ' denied)', pbody));
  return root;
}

function render(state) {
  var root = document.getElementById('root');
  root.textContent = '';
  if ( state.tab === 'why' ) root.appendChild(renderWhy(state.why));
  document.getElementById('status').textContent = state.pollsLeft ? 'waiting for permission checks…' : '';
}

// ---- data flow ----
function loadWhy() {
  rpc('why').then(function(w) {
    state.why = w;
    if ( w && w.pending > 0 && state.pollsLeft > 0 ) {
      state.pollsLeft--;
      setTimeout(loadWhy, 400);
    } else {
      state.pollsLeft = 0;
    }
    render(state);
  });
}
function refresh() { state.pollsLeft = 3; loadWhy(); }

document.getElementById('refresh').addEventListener('click', refresh);
refresh();
