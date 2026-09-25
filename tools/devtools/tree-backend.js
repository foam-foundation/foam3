/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registers the Tree tab's methods. Browser-only glue: the walk is
// shapers.treeOf (tested); this adds the uid -> element map of the last
// snapshot, the hand-off to selection-backend.js and the hover overlay.
(function() {
  var D = window.__foamDevtools, P = window.__foamShapers;
  var CAP = 5000;

  // uid -> element for the last snapshot only: a cache of what the panel is
  // looking at, rebuilt on every tree() call, never the selection itself.
  // It pins up to CAP elements (and their records and DAOs) until the next
  // tree() or treeRelease, which the panel sends when it leaves the Tree tab.
  var uidMap = new Map();

  D.register('tree', function() {
    if ( ! D.foamReady() ) return { foam: false };
    uidMap = new Map();
    var tree = P.treeOf(D.screenRoot(), CAP, function(el, uid) { uidMap.set(uid, el); });
    return { tree: tree, selected: D.selectionUid() };
  });

  D.register('selectUid', function(uid) {
    var el = uidMap.get(uid);
    if ( ! el ) return { error: 'stale tree — refresh' };
    D.selectNode(el);
    return { ok: true };
  });

  // Hover highlight. Chrome gives extensions no overlay API, so the page
  // draws it: one fixed div over the element's box with a class-name tag,
  // moved on every call and removed by highlight(null). The only DOM the
  // extension adds to the page, and it never outlives the hover; box is the
  // handle to remove it.
  // The box expires by itself TTL_MS after the last highlight call: the panel
  // repeats the call once a second while a row stays hovered, so a panel that
  // is hidden or torn down ends the outline by going quiet. A uid that no
  // longer resolves (element re-rendered on the page) clears it on the spot
  // below. A panel row re-rendered under the pointer is the panel's to notice
  // (panel.js syncHover): from here that uid still resolves.
  var box = null, expiry = null, TTL_MS = 2500;
  function overlay() {
    if ( box && box.isConnected ) return box;
    box = document.createElement('div');
    box.setAttribute('data-foam-devtools', 'highlight');
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;' +
      'background:rgba(111,168,220,.4);outline:1px solid rgba(26,115,232,.9);';
    var tag = document.createElement('span');
    tag.style.cssText = 'position:absolute;left:0;bottom:100%;background:#1a73e8;color:#fff;' +
      'font:11px system-ui,sans-serif;padding:1px 4px;border-radius:2px;white-space:nowrap;';
    box.appendChild(tag);
    document.documentElement.appendChild(box);
    return box;
  }
  function clearHighlight() {
    clearTimeout(expiry); expiry = null;
    if ( box ) { box.remove(); box = null; }
  }

  // The panel is done with the snapshot: drop the pins and any hover outline.
  D.register('treeRelease', function() {
    uidMap = new Map();
    clearHighlight();
    return { ok: true };
  });

  D.register('highlight', function(uid) {
    var el = ( uid === null || uid === undefined ) ? null : uidMap.get(uid);
    var d = el && P.own(el, 'element_');
    if ( ! d || d.nodeType !== 1 || ! d.isConnected ) { clearHighlight(); return { shown: false }; }
    var r = d.getBoundingClientRect(), b = overlay();
    clearTimeout(expiry); expiry = setTimeout(clearHighlight, TTL_MS);
    b.style.left = r.left + 'px'; b.style.top = r.top + 'px';
    b.style.width = r.width + 'px'; b.style.height = r.height + 'px';
    b.firstChild.textContent = el.cls_.id.split('.').pop() + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
    return { shown: true };
  });
})();
