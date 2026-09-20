/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var S = window.__foamSidebarCore, E = window.__foamWhyExplain, T = window.__foamTreeCore, P = window.__foamShapers;

// All panel state in one object, one render(state) from it.
// tab: which tab is showing, remembered across panel reopens.
// why: the last why() response ({error} included); pollsLeft: re-polls
// still allowed for pending checks. tree: the last tree() snapshot, or
// {error}; selected: the page's selection uid; opened/closed: the tree
// nodes the user toggled, by $UID; expanded is derived from them plus the
// defaults on every snapshot. open: which Why sections are unfolded, by key.
// All survive re-renders because render rebuilds the DOM each time.
var TAB_KEY = 'foamDevtools.tab', WRAPPERS_KEY = 'foamDevtools.hideWrappers';
var state = { tab: readTab(), why: null, pollsLeft: 0, open: {}, updated: null,
              tree: null, expanded: new Set(), opened: new Set(), closed: new Set(), selected: null,
              hideWrappers: readPref(WRAPPERS_KEY, true) };

function readTab() {
  try { return localStorage.getItem(TAB_KEY) === 'tree' ? 'tree' : 'why'; } catch (e) { return 'why'; }
}
function readPref(key, dflt) {
  try { var v = localStorage.getItem(key); return v === null ? dflt : v === 'true'; } catch (e) { return dflt; }
}
function writePref(key, v) { try { localStorage.setItem(key, String(v)); } catch (e) {} }
// Switching tabs drops the tab's data and reloads it: only the showing tab
// loads, so what the other tab holds may be a previous screen. Leaving the
// Tree tab also releases the page side: render() is about to destroy the
// hovered row without a mouseleave, and the uid map pins every element of
// the last snapshot until the next tree() call.
function setTab(tab) {
  if ( state.tab === 'tree' && tab !== 'tree' ) rpc('treeRelease');
  state.tab = tab;
  writePref(TAB_KEY, tab);
  if ( tab === 'why' ) state.why = null; else state.tree = null;
  render(state);
  refresh();
}

// ---- DOM helpers (el() is in common.js) ----
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
function section(key, title, body, cls) {
  var s = el('details');
  s.open = state.open[key] !== false;
  s.appendChild(el('summary', cls, title));
  s.appendChild(body);
  s.addEventListener('toggle', function() { state.open[key] = s.open; });
  return s;
}
function permMark(r) { return r === 'pending' ? '…' : ( r === true ? '✓' : '✗' ); }

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
    body.appendChild(section('rw', 'and ' + rw.length + ' read-write', el('div', 'muted', rw.map(function(g) { return g.name; }).join(', ')), 'muted'));
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
    // the tick folds every gate the why column can name, anyVisible included
    root.appendChild(section('sections', 'Sections', table([ 'section', 'available', 'why' ], w.sections.map(function(s) {
      var ok = s.available === true && ( ! s.perm || s.perm.result === true ) && s.anyVisible !== false;
      var pending = s.available === 'pending' || ( s.perm && s.perm.result === 'pending' ) || s.anyVisible === 'pending';
      return [ s.name, ok ? ( pending ? '…' : '✓' ) : '✗', E.explainSection(s) ];
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
function treeOpts() { return { hideWrappers: state.hideWrappers }; }
// Wrapper = one of the framework's raw primitives (shapers.WRAPPER_CLASSES):
// what a view's render() emits, not a view someone wrote. The same list the
// sidebar folds. Named here once for every label that mentions it.
var WRAPPER_NAMES = P.WRAPPER_CLASSES.map(S.shortName).join(', ');
function tag(text, title) { var t = el('span', 'tag', text); t.title = title; return t; }

function renderTree() {
  var root = el('div'), tree = state.tree;
  if ( ! tree ) { root.appendChild(el('div', 'muted', 'loading…')); return root; }
  if ( tree.error ) { root.appendChild(el('div', 'err', tree.error)); return root; }
  if ( ! tree.root ) { root.appendChild(el('div', 'muted', 'no screen')); return root; }
  if ( tree.truncated ) root.appendChild(el('div', 'muted', 'showing ' + tree.count + ' nodes (capped)'));
  var selectedRow = T.shownUid(tree, state.selected, treeOpts());
  T.flatten(tree, state.expanded, treeOpts()).forEach(function(r) {
    var row = el('div', 'node' + ( r.uid === selectedRow ? ' selected' : '' ) + ( r.shown ? '' : ' hidden' ) + ( r.wrapper ? ' wrapper' : '' ));
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
        setOpen(ev.altKey ? T.subtreeUids(state.tree, r.uid) : [ r.uid ], ! r.open);
      });
    }
    row.appendChild(tog);
    row.appendChild(el('span', 'cls', r.cls));
    if ( r.binding ) row.appendChild(el('span', 'bind', r.binding));
    if ( r.wrapper ) row.appendChild(tag('wrapper', 'framework plumbing (' + WRAPPER_NAMES + '); folded away by "hide wrappers"'));
    if ( ! r.shown ) row.appendChild(tag('hidden', 'shown === false: rendered but not displayed'));
    row.addEventListener('click', function() { selectRow(r.uid); });
    root.appendChild(row);
  });
  return root;
}

// Open or close a set of nodes as a user toggle: recorded in opened/closed so
// the choice survives the next poll (effectiveExpanded re-applies it over
// the defaults), then re-rendered from the same snapshot.
function setOpen(uids, open) {
  uids.forEach(function(u) {
    if ( open ) { state.opened.add(u); state.closed.delete(u); }
    else        { state.closed.add(u); state.opened.delete(u); }
  });
  state.expanded = T.effectiveExpanded(state.tree, state.selected, state.opened, state.closed);
  render(state);
}

// Fold button: every branch open, or everything closed but the root, so the
// screen's top-level views stay listed and the tree is never a single row.
function foldAll() {
  if ( ! state.tree || ! state.tree.root ) return;
  var open = ! T.allOpen(state.tree, state.expanded, treeOpts());
  var uids = T.subtreeUids(state.tree, state.tree.root.uid);
  setOpen(open ? uids : uids.slice(1), open);
}

// A row click hands the element to the page's selection owner, so the
// sidebar, Why and $v follow — without inspect(), which would switch
// DevTools to the Elements tab; that is the Reveal button's job. The row is
// marked at once; the reload comes from the screen poll, which sees the
// selection generation change (one reload, not one here and one there).
function selectRow(uid) {
  rpc('selectUid', [ JSON.stringify(uid) ]).then(function(r) {
    if ( r.error ) { setStatus(r.error); return; }
    state.selected = uid;
    render(state);
    watchScreen();
  });
}

// Hover outline on the page; null clears it. Drawn by the page (see
// tree-backend.js) because Chrome gives extensions no overlay API. The page
// drops the box by itself unless it hears again within its TTL, so the
// heartbeat below is what keeps the outline up while a row stays hovered —
// and what ends it when the hovered row is re-rendered away (poll, toggle)
// or the panel is hidden, neither of which fires a mouseleave.
var hovered = null;
function highlight(uid) {
  hovered = uid;
  rpc('highlight', [ JSON.stringify(uid) ]);
}
setInterval(function() {
  if ( hovered !== null && document.visibilityState === 'visible' ) rpc('highlight', [ JSON.stringify(hovered) ]);
}, 1000);

function loadTree() {
  rpc('tree').then(function(r) {
    if ( r.error || r.foam === false ) { state.tree = { error: r.error || 'not a FOAM page' }; render(state); return; }
    // A new selection must be visible even under a branch the user closed:
    // its ancestors reopen, the node itself keeps the user's toggle.
    if ( r.selected !== state.selected ) T.pathTo(r.tree, r.selected).slice(0, -1).forEach(function(u) { state.closed.delete(u); });
    state.tree = r.tree; state.selected = r.selected; state.updated = stamp();
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
  document.getElementById('hint').textContent = ( state.hideWrappers ? '' : 'grey ·wrapper rows fold away when ticked · ' ) + 'alt-click ▸ opens a whole branch';
  var root = document.getElementById('root');
  root.textContent = '';
  root.appendChild(state.tab === 'tree' ? renderTree() : renderWhy(state.why));
  document.getElementById('reveal').disabled = state.selected === null || state.selected === undefined;
  if ( state.tab === 'tree' ) {
    var fold = document.getElementById('fold'), hasTree = !! ( state.tree && state.tree.root );
    fold.disabled = ! hasTree;
    fold.textContent = hasTree && ! T.allOpen(state.tree, state.expanded, treeOpts()) ? 'Expand all' : 'Collapse all';
  }
  document.getElementById('status').textContent =
    state.pollsLeft ? ( state.why && state.why.error ? 'waiting for the record to load…' : 'waiting for permission checks…' ) :
    state.why && state.why.error && state.tab === 'why' ? state.why.error :
    state.updated ? 'updated ' + state.updated : '';
  // A short highlight so a refresh that changes nothing is still visibly a refresh.
  root.classList.remove('flash'); void root.offsetWidth; root.classList.add('flash');
}

// ---- data flow ----
// One why() chain at a time: a new load cancels the pending re-poll and
// outranks any response still in flight (seq), so an answer for the previous
// screen cannot land on top of the current one.
var whyTimer = null, whySeq = 0;
function stopWhy() { clearTimeout(whyTimer); whyTimer = null; whySeq++; state.pollsLeft = 0; }
function loadWhy(pollsLeft) {
  stopWhy();
  var seq = whySeq;
  state.pollsLeft = pollsLeft;
  setStatus('refreshing…');
  rpc('why').then(function(w) {
    if ( seq !== whySeq ) return;
    state.why = w;
    state.updated = stamp();
    if ( E.shouldRepoll(w, pollsLeft) ) whyTimer = setTimeout(function() { loadWhy(pollsLeft - 1); }, 400);
    else state.pollsLeft = 0;
    render(state);
  });
}
// Only the showing tab loads: why() replays every gate and asks the app's
// auth for each permission, which is not worth doing behind the Tree tab.
function refresh() {
  if ( state.tab === 'why' ) { loadWhy(3); return; }
  stopWhy();
  loadTree();
}
function setStatus(msg) { document.getElementById('status').textContent = msg || ''; }

// Follow the app: poll the route + stack position + selection once a second
// while the panel is visible and reload when it changes, so opening a record
// in the app is enough — no Elements click, no Refresh.
var lastKey = null, keyInFlight = false;
function watchScreen() {
  if ( document.visibilityState !== 'visible' || keyInFlight ) return;
  keyInFlight = true;
  rpc('screenKey').then(function(r) {
    keyInFlight = false;
    if ( r && r.key !== undefined && r.key !== lastKey ) { lastKey = r.key; refresh(); }
  });
}
setInterval(watchScreen, 1000);
document.addEventListener('visibilitychange', function() { if ( document.visibilityState === 'visible' ) { lastKey = null; watchScreen(); } });

document.querySelectorAll('#tabs .tab').forEach(function(b) {
  b.addEventListener('click', function() { setTab(b.dataset.tab); });
});
document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('wrappers-label').title = 'fold ' + WRAPPER_NAMES + ' rows away; their children move up';
document.getElementById('wrappers').addEventListener('change', function(ev) {
  state.hideWrappers = ev.target.checked;
  writePref(WRAPPERS_KEY, state.hideWrappers);
  render(state);
});
// no index: the pointed-at element's own DOM node (see selection-backend.js)
document.getElementById('reveal').addEventListener('click', function() { reveal(); });
document.getElementById('fold').addEventListener('click', foldAll);
// the pointer can leave the panel without crossing a row's edge
document.getElementById('root').addEventListener('mouseleave', function() { highlight(null); });
// closing DevTools or the panel tears this page down with no mouseleave
window.addEventListener('pagehide', function() { rpc('treeRelease'); });
refresh();
