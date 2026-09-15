/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.rail',
  name: 'RailDemo',
  extends: 'foam.u2.View',

  documentation: `
    Mounts the railroad viewer with typed grammar text enabled (dev only), the
    window.__rail debug hook, and the toy preset loaded. Query parameters load
    files instead of the preset: ?grammar=URL (a symbols() body as text) and
    ?input=URL (the text to parse), both fetched relative to the page; add
    &doc to open the document view.
  `,

  requires: [ 'foam.parse.rail.RailDiagramView' ],

  methods: [
    function render() {
      var view = this.RailDiagramView.create({ allowTypedGrammar: true, debugHook: true });
      this.add(view);
      var q = new URLSearchParams(location.search), g = q.get('grammar'), i = q.get('input');
      if ( ! g && ! i ) { view.usePreset('comma list (toy)'); return; }
      var get = function(url) { return url ? fetch(url).then(function(r) { if ( ! r.ok ) throw new Error(r.status + ' ' + url); return r.text(); }) : Promise.resolve(null); };
      Promise.all([ get(g), get(i) ]).then(function(a) {
        if ( a[0] !== null ) { view.grammarText = a[0]; view.loadTyped(); }
        if ( a[1] !== null ) view.setInput(a[1]);
        if ( q.has('doc') ) view.documentShown = true;
      }).catch(function(x) { view.status = 'load failed: ' + x.message; });
    }
  ]
});
