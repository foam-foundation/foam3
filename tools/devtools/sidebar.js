/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

try {
  if ( chrome.devtools.panels.themeName === 'dark' ) document.documentElement.classList.add('dark');
} catch (e) {}

// render(result) is a pure function of the inspect response: it builds DOM
// with textContent only (no innerHTML, so class ids need no escaping) and
// keeps no state between calls.
function line(text, cls) {
  var d = document.createElement('div');
  if ( cls ) d.className = cls;
  d.textContent = text;
  return d;
}

function row(label, value, strong) {
  var d = document.createElement('div');
  var k = document.createElement('span');
  k.className = 'muted'; k.textContent = label + ' ';
  d.appendChild(k);
  var v = document.createElement(strong ? 'b' : 'span');
  v.textContent = value;
  d.appendChild(v);
  return d;
}

function mapLine(s) {
  return line('map: ' + s.walked + ' elements, ' + s.withDom + ' with a DOM node, ' + s.ms + 'ms', 'muted');
}

function render(r) {
  var root = document.getElementById('root');
  root.textContent = '';
  if ( r.error ) { root.appendChild(line(r.error, 'err')); return; }
  if ( r.foam === false ) { root.appendChild(line('not a FOAM page')); return; }
  if ( ! r.owner ) {
    root.appendChild(line('no owning u2 Element found'));
    if ( r.mapStats ) root.appendChild(mapLine(r.mapStats));
    return;
  }
  root.appendChild(row('element:', r.owner.cls));
  root.appendChild(row('view:', r.owner.named.cls, true));
  root.appendChild(r.owner.named.dataCls
    ? row('data:', r.owner.named.dataCls)
    : line('no data object', 'muted'));
  var m = r.owner.modes;
  if ( m && ! m.error ) root.appendChild(row('mode:', ( m.controllerMode || '—' ) + ' / ' + ( m.displayMode || '—' )));
  root.appendChild(mapLine(r.mapStats));
}

function refresh() { rpc('inspect', [ '$0' ]).then(render); }

chrome.devtools.panels.elements.onSelectionChanged.addListener(refresh);
refresh();
