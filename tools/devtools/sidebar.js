/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var S = window.__foamSidebarCore;

// render(result) is a pure function of the inspect response: it builds DOM
// with el() (textContent only) and keeps no state between calls.
function mapLine(s) {
  return el('div', 'muted', 'map: ' + s.walked + ' elements, ' + s.withDom + ' with a DOM node, ' + s.ms + 'ms');
}

function modeText(m) {
  return ( m.controllerMode || '—' ) + ' / ' + ( m.displayMode || '—' );
}

// One row per layer, root first. Index i is the layer's position in the
// original (deepest-first) stack, which is what node(i) on the page expects.
// The modes are shown only where they change from the parent's.
function stackRow(l, i, depth, parentModes, selected) {
  var row = el('div', 'layer' + ( selected ? ' selected' : '' ));
  row.style.paddingLeft = ( 4 + depth * 12 ) + 'px';
  row.title = l.cls + ' — click to reveal in Elements';
  row.appendChild(el('span', 'cls', S.shortName(l.cls)));
  var b = S.layerText(l);
  if ( b ) row.appendChild(el('span', 'bind', b));
  var m = l.modes;
  if ( m && ! m.error && ( ! parentModes || modeText(m) !== modeText(parentModes) ) ) {
    row.appendChild(el('span', 'muted', modeText(m)));
  }
  if ( selected ) row.appendChild(el('span', 'muted', '← selected'));
  row.addEventListener('click', function() { reveal(i); });
  return row;
}

function render(r) {
  var root = document.getElementById('root');
  root.textContent = '';
  if ( r.error ) { root.appendChild(el('div', 'err', r.error)); return; }
  if ( r.foam === false ) { root.appendChild(el('div', null, 'not a FOAM page')); return; }
  if ( ! r.stack || ! r.stack.length ) {
    root.appendChild(el('div', null, 'no owning u2 Element found'));
    if ( r.mapStats ) root.appendChild(mapLine(r.mapStats));
    return;
  }
  var n = r.stack.length, parentModes = null;
  for ( var i = n - 1 ; i >= 0 ; i-- ) {
    var l = r.stack[i];
    root.appendChild(stackRow(l, i, n - 1 - i, parentModes, i === 0));
    if ( l.modes && ! l.modes.error ) parentModes = l.modes;
  }
  var path = el('input', 'path');
  path.type = 'text'; path.readOnly = true;
  path.value = S.pathOf(r.stack);
  path.title = 'FOAM path — click to select';
  path.addEventListener('click', function() { path.select(); });
  root.appendChild(path);
  root.appendChild(el('div', 'muted', 'console: $v = the selected element, $d = the current target\'s record'));
  root.appendChild(mapLine(r.mapStats));
}

function refresh() { rpc('inspect', [ '$0' ]).then(render); }

chrome.devtools.panels.elements.onSelectionChanged.addListener(refresh);
refresh();
