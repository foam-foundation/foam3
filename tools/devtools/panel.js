/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

try {
  if ( chrome.devtools.panels.themeName === 'dark' ) document.documentElement.classList.add('dark');
} catch (e) {}

var S = window.__foamSidebarCore, E = window.__foamWhyExplain, T = window.__foamTreeCore;

// All panel state in one object, one render(state) from it.
// tab: which tab is showing, remembered across panel reopens.
// open: which Why sections are expanded, by key. opened/closed: the tree
// nodes the user toggled, by $UID; expanded is derived from them plus the
// defaults on every snapshot. All survive re-renders because render rebuilds
// the DOM each time.
var TAB_KEY = 'foamDevtools.tab', WRAPPERS_KEY = 'foamDevtools.hideWrappers';
var state = { tab: readTab(), why: null, pollsLeft: 0, open: {}, updated: null,
              tree: null, treeError: null, expanded: new Set(), opened: new Set(), closed: new Set(), selected: null,
              hideWrappers: readPref(WRAPPERS_KEY, true) };

function readTab() {
  try { return localStorage.getItem(TAB_KEY) === 'tree' ? 'tree' : 'why'; } catch (e) { return 'why'; }
}
function readPref(key, dflt) {
  try { var v = localStorage.getItem(key); return v === null ? dflt : v === 'true'; } catch (e) { return dflt; }
}
function writePref(key, v) { try { localStorage.setItem(key, String(v)); } catch (e) {} }
function setTab(tab) {
  state.tab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch (e) {}
  render(state);
  if ( tab === 'tree' && ! state.tree ) loadTree();
}

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

// ---- Tree tab ----
function renderTree(st) {
  var root = el('div');
  if ( st.treeError ) { root.appendChild(el('div', 'err', st.treeError)); return root; }
  if ( ! st.tree ) { root.appendChild(el('div', 'muted', 'loading…')); return root; }
  if ( ! st.tree.root ) { root.appendChild(el('div', 'muted', 'no screen')); return root; }
  if ( st.tree.truncated ) root.appendChild(el('div', 'muted', 'showing ' + st.tree.count + ' nodes (capped)'));
  T.flatten(st.tree, st.expanded, { hideWrappers: st.hideWrappers }).forEach(function(r) {
    var row = el('div', 'node' + ( r.uid === st.selected ? ' selected' : '' ) + ( r.shown ? '' : ' hidden' ));
    row.style.paddingLeft = ( 4 + r.depth * 12 ) + 'px';
    row.title = 'click to select — sidebar, Why and $v follow; hover outlines it on the page';
    row.addEventListener('mouseenter', function() { highlight(r.uid); });
    row.addEventListener('mouseleave', function() { highlight(null); });
    var tog = el('span', 'tog', r.hasKids ? ( r.open ? '▾' : '▸' ) : '');
    if ( r.hasKids ) {
      tog.title = r.open ? 'collapse (alt-click: whole branch)' : 'expand (alt-click: whole branch)';
      tog.addEventListener('click', function(ev) {
        ev.stopPropagation();
        // alt-click toggles the whole branch, as in Chrome's Elements tab
        var uids = ev.altKey ? T.subtreeUids(st.tree, r.uid) : [ r.uid ];
        uids.forEach(function(u) {
          if ( r.open ) { st.closed.add(u); st.opened.delete(u); }
          else          { st.opened.add(u); st.closed.delete(u); }
        });
        st.expanded = T.effectiveExpanded(st.tree, st.selected, st.opened, st.closed);
        render(state);
      });
    }
    row.appendChild(tog);
    row.appendChild(el('span', 'cls', r.cls));
    if ( r.binding ) row.appendChild(el('span', 'bind', r.binding));
    if ( ! r.shown ) row.appendChild(el('span', 'muted', 'hidden'));
    row.addEventListener('click', function() { selectRow(r.uid); });
    root.appendChild(row);
  });
  return root;
}

// A row click hands the element to the page's selection owner, so the
// sidebar, Why and $v follow — without inspect(), which would switch
// DevTools to the Elements tab; that is the Reveal button's job.
function selectRow(uid) {
  rpc('selectUid', [ JSON.stringify(uid) ]).then(function(r) {
    if ( r.error ) { setStatus(r.error); return; }
    state.selected = uid;
    refresh();
  });
}

// Hover outline on the page; null clears it. Drawn by the page (see
// tree-backend.js) because Chrome gives extensions no overlay API.
function highlight(uid) { rpc('highlight', [ JSON.stringify(uid) ]); }

function loadTree() {
  rpc('tree').then(function(r) {
    if ( r.error || r.foam === false ) {
      state.treeError = r.error || 'not a FOAM page'; state.tree = null; render(state); return;
    }
    state.treeError = null; state.tree = r.tree; state.selected = r.selected;
    state.opened = T.pruneExpanded(state.opened, r.tree);
    state.closed = T.pruneExpanded(state.closed, r.tree);
    state.expanded = T.effectiveExpanded(r.tree, r.selected, state.opened, state.closed);
    render(state);
  });
}

function stamp() { return new Date().toTimeString().slice(0, 8); }

function render(state) {
  document.querySelectorAll('#tabs .tab').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === state.tab); });
  document.body.classList.toggle('tree-tab', state.tab === 'tree');
  document.getElementById('wrappers').checked = state.hideWrappers;
  var root = document.getElementById('root');
  root.textContent = '';
  root.appendChild(state.tab === 'tree' ? renderTree(state) : renderWhy(state.why));
  document.getElementById('reveal').disabled = state.selected === null || state.selected === undefined;
  document.getElementById('status').textContent =
    state.pollsLeft ? 'waiting for permission checks…' :
    state.why && state.why.error && state.tab === 'why' ? state.why.error :
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
// Both tabs reload together: the Why tab always (it re-polls pending
// permission checks), the tree only while it is showing.
function refresh() {
  state.pollsLeft = 3;
  loadWhy();
  if ( state.tab === 'tree' ) loadTree();
}
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

document.querySelectorAll('#tabs .tab').forEach(function(b) {
  b.addEventListener('click', function() { setTab(b.dataset.tab); });
});
document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('wrappers').addEventListener('change', function(ev) {
  state.hideWrappers = ev.target.checked;
  writePref(WRAPPERS_KEY, state.hideWrappers);
  render(state);
});
// stack[0] is the selected element itself (selectUid puts it there), so
// node(0) is its DOM node.
document.getElementById('reveal').addEventListener('click', function() { reveal(0); });
// the pointer can leave the panel without crossing a row's edge
document.getElementById('root').addEventListener('mouseleave', function() { highlight(null); });
refresh();
