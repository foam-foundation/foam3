/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

try {
  if ( chrome.devtools.panels.themeName === 'dark' ) document.documentElement.classList.add('dark');
} catch (e) {}

var S = window.__foamSidebarCore;

// render(result) is a pure function of the inspect response: it builds DOM
// with textContent only (no innerHTML, so class ids need no escaping) and
// keeps no state between calls.
function line(text, cls) {
  var d = document.createElement('div');
  if ( cls ) d.className = cls;
  d.textContent = text;
  return d;
}

function span(text, cls) {
  var s = document.createElement('span');
  if ( cls ) s.className = cls;
  s.textContent = text;
  return s;
}

function mapLine(s) {
  return line('map: ' + s.walked + ' elements, ' + s.withDom + ' with a DOM node, ' + s.ms + 'ms', 'muted');
}

function bindingText(l) {
  if ( l.dao ) return l.dao.key ? 'dao ' + l.dao.key : ( l.dao.of ? 'dao of ' + S.shortName(l.dao.of) : 'dao' );
  if ( l.data ) {
    var s = S.shortName(l.data.cls);
    if ( l.data.id ) s += ' #' + l.data.id;
    if ( l.data.summary ) s += ' — ' + l.data.summary;
    return s;
  }
  return '';
}

function modeText(m) {
  return ( m.controllerMode || '—' ) + ' / ' + ( m.displayMode || '—' );
}

// One row per layer, root first. Index i is the layer's position in the
// original (deepest-first) stack, which is what node(i) on the page expects.
function stackRow(l, i, depth, parentModes, selected) {
  var row = document.createElement('div');
  row.className = 'layer' + ( selected ? ' selected' : '' );
  row.style.paddingLeft = ( 4 + depth * 12 ) + 'px';
  row.title = l.cls + ' — click to reveal in Elements';
  row.appendChild(span(S.shortName(l.cls), 'cls'));
  var b = bindingText(l);
  if ( b ) row.appendChild(span(b, 'bind'));
  if ( l.prop ) row.appendChild(span('prop ' + l.prop, 'bind'));
  var m = l.modes;
  if ( m && ! m.error && ( ! parentModes || parentModes.error || modeText(m) !== modeText(parentModes) ) ) {
    row.appendChild(span(modeText(m), 'muted'));
  }
  if ( selected ) row.appendChild(span('← selected', 'muted'));
  row.addEventListener('click', function() { reveal(i); });
  return row;
}

function render(r) {
  var root = document.getElementById('root');
  root.textContent = '';
  if ( r.error ) { root.appendChild(line(r.error, 'err')); return; }
  if ( r.foam === false ) { root.appendChild(line('not a FOAM page')); return; }
  if ( ! r.stack || ! r.stack.length ) {
    root.appendChild(line('no owning u2 Element found'));
    if ( r.mapStats ) root.appendChild(mapLine(r.mapStats));
    return;
  }
  var n = r.stack.length, parentModes = null;
  for ( var i = n - 1 ; i >= 0 ; i-- ) {
    var l = r.stack[i];
    root.appendChild(stackRow(l, i, n - 1 - i, parentModes, i === 0));
    if ( l.modes && ! l.modes.error ) parentModes = l.modes;
  }
  var path = document.createElement('input');
  path.type = 'text'; path.readOnly = true; path.className = 'path';
  path.value = S.pathOf(r.stack);
  path.title = 'FOAM path — click to select';
  path.addEventListener('click', function() { path.select(); });
  root.appendChild(path);
  root.appendChild(line('console: $v = selected view, $d = its data', 'muted'));
  root.appendChild(mapLine(r.mapStats));
}

function refresh() { rpc('inspect', [ '$0' ]).then(render); }

chrome.devtools.panels.elements.onSelectionChanged.addListener(refresh);
refresh();
