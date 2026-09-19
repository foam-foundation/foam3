/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

try {
  if ( chrome.devtools.panels.themeName === 'dark' ) document.documentElement.classList.add('dark');
} catch (e) {}

var S = window.__foamSidebarCore, E = window.__foamWhyExplain;

// All panel state in one object, one render(state) from it. A second tab,
// when one exists, adds its own key and render function.
// open: which collapsible sections are expanded, by key; survives re-renders
// (Refresh, permission re-polls) because render rebuilds the DOM each time.
var state = { why: null, pollsLeft: 0, open: {}, updated: null };

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
// A collapsible block. Default open; the user's toggle is remembered in
// state.open[key] so a re-render does not snap it back.
function section(key, title, body) {
  var s = el('details');
  s.open = state.open[key] !== false;
  s.appendChild(el('summary', null, title));
  s.appendChild(body);
  s.addEventListener('toggle', function() { state.open[key] = s.open; });
  return s;
}
function permMark(r) { return r === 'pending' ? '…' : ( r ? '✓' : '✗' ); }

// ---- Why tab ----
var MODE_ORDER = { HIDDEN: 0, RO: 1, DISABLED: 2, ERR: 3, pending: 4, RW: 5 };

function renderWhy(w) {
  var root = el('div');
  if ( ! w ) { root.appendChild(el('div', 'muted', 'loading…')); return root; }
  if ( w.error ) { root.appendChild(el('div', 'err', w.error)); return root; }
  if ( w.foam === false ) { root.appendChild(el('div', null, 'not a FOAM page')); return root; }
  if ( ! w.properties ) { root.appendChild(el('div', 'err', 'unexpected response')); return root; }

  var head = S.shortName(w.cls) + ( w.id ? ' #' + w.id : '' ) + ( w.summary ? ' — ' + w.summary : '' ) +
             '   mode ' + w.mode + ( w.modeDefaulted ? ' (none in scope → FOAM default)' : '' ) +
             ( w.source === 'selection' ? '   (from Elements selection)' : '   (record on screen)' ) +
             ( w.pending ? '   ' + w.pending + ' permission check(s) pending' : '' );
  var rec = el('div', 'record', head);
  var openBtn = el('button', null, 'Open in FOAM');
  openBtn.title = 'push the comics edit view for this record onto the app\'s own navigation stack';
  openBtn.addEventListener('click', function() {
    rpc('openRecord').then(function(r) { if ( r.error ) setStatus(r.error); });
  });
  rec.appendChild(openBtn);
  root.appendChild(rec);

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
  root.appendChild(section('fields', 'Fields (' + notRW.length + ' not RW; class axioms, per-view overrides not replayed)', body));

  root.appendChild(section('validation', 'Validation (' + w.validation.length + ' failing)',
    w.validation.length
      ? table([ 'field', 'value', 'message' ], w.validation.map(function(v) { return [ v.name, { text: v.value, cls: 'val' }, v.message ]; }))
      : el('div', 'muted', 'no errors')));

  var blocked = w.actions.filter(function(a) { return a.available.value !== true || a.enabled.value !== true; });
  root.appendChild(section('actions', 'Actions (' + blocked.length + ' blocked of ' + w.actions.length + ')',
    w.actions.length
      ? table([ 'action', 'available', 'enabled', 'why' ], w.actions.map(function(a) {
          return [ a.name, permMark(a.available.value), permMark(a.enabled.value), E.explainAction(a) ];
        }))
      : el('div', 'muted', 'no actions')));

  if ( w.sections.length ) {
    root.appendChild(section('sections', 'Sections', table([ 'section', 'available', 'why' ], w.sections.map(function(s) {
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
  root.appendChild(section('permissions', 'Permissions checked by the page or this panel (' + w.permissions.length + ', ' + denied.length + ' denied)', pbody));
  return root;
}

function stamp() { return new Date().toTimeString().slice(0, 8); }

function render(state) {
  var root = document.getElementById('root');
  root.textContent = '';
  root.appendChild(renderWhy(state.why));
  document.getElementById('status').textContent =
    state.pollsLeft ? 'waiting for permission checks…' :
    state.why && state.why.error ? state.why.error :
    state.updated ? 'updated ' + state.updated : '';
  // A short highlight so a refresh that changes nothing is still visibly a refresh.
  root.classList.remove('flash'); void root.offsetWidth; root.classList.add('flash');
}

// ---- data flow ----
function loadWhy() {
  setStatus('refreshing…');
  rpc('why').then(function(w) {
    state.why = w;
    state.updated = stamp();
    // An error right after navigation usually means the detail view has not
    // loaded its record yet (DetailView.loadData is idled + a find), so it
    // gets the same re-polls as pending permission checks.
    if ( w && ( w.pending > 0 || w.error ) && state.pollsLeft > 0 ) {
      state.pollsLeft--;
      setTimeout(loadWhy, 400);
    } else {
      state.pollsLeft = 0;
    }
    render(state);
  });
}
function refresh() { state.pollsLeft = 3; loadWhy(); }
function setStatus(msg) { document.getElementById('status').textContent = msg || ''; }

// Follow the app: poll the route + stack position once a second while the
// panel is visible and reload when it changes, so opening a record in the
// app is enough — no Elements click, no Refresh.
var lastKey = null;
function watchScreen() {
  if ( document.visibilityState !== 'visible' ) return;
  rpc('screenKey').then(function(r) {
    if ( r && r.key !== undefined && r.key !== lastKey ) { lastKey = r.key; refresh(); }
  });
}
setInterval(watchScreen, 1000);
document.addEventListener('visibilitychange', function() { if ( document.visibilityState === 'visible' ) { lastKey = null; watchScreen(); } });

document.getElementById('refresh').addEventListener('click', refresh);
refresh();
