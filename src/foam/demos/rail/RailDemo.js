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
    ?input=URL (the text to parse); ?presets=URL merges a JSON object of
    { name: { input, grammar } } into the preset list, so local or private
    grammars can sit in the dropdown without living in this repo. All URLs are
    fetched relative to the page; &doc opens the document view.
  `,

  requires: [ 'foam.parse.rail.RailDiagramView' ],

  methods: [
    function render() {
      var self = this, q = new URLSearchParams(location.search), g = q.get('grammar'), i = q.get('input'), p = q.get('presets');
      var get = function(url) { return url ? fetch(url).then(function(r) { if ( ! r.ok ) throw new Error(r.status + ' ' + url); return r.text(); }) : Promise.resolve(null); };
      // Extra presets come first: the preset list is built when the view renders.
      get(p).then(function(json) {
        var presets = Object.assign({}, self.RailDiagramView.DEFAULT_PRESETS, json ? JSON.parse(json) : {});
        var view = self.RailDiagramView.create({ allowTypedGrammar: true, debugHook: true, presets: presets });
        self.add(view);
        if ( ! g && ! i ) { view.usePreset('comma list (toy)'); if ( q.has('doc') ) view.documentShown = true; return; }
        return Promise.all([ get(g), get(i) ]).then(function(a) {
          if ( a[0] !== null ) { view.grammarText = a[0]; view.loadTyped(); }
          if ( a[1] !== null ) view.setInput(a[1]);
          if ( q.has('doc') ) view.documentShown = true;
        }).catch(function(x) { view.status = 'load failed: ' + x.message; });
      }).catch(function(x) { self.add('presets load failed: ' + x.message); });
    }
  ]
});
