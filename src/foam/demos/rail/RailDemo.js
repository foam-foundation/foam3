/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.demos.rail',
  name: 'Mood',
  values: [ 'CALM', 'CURIOUS', 'BUSY' ]
});

foam.CLASS({
  package: 'foam.demos.rail',
  name: 'Country',
  documentation: 'Spike stand-in for foam.core.auth.Country (not loaded by this demo page): a DAO-backed reference target.',
  ids: [ 'code' ],
  properties: [
    { class: 'String', name: 'code' },
    { class: 'String', name: 'name' }
  ],
  methods: [ function toSummary() { return this.name; } ]
});

foam.CLASS({
  package: 'foam.demos.rail',
  name: 'U2Sample',
  documentation: 'Throwaway model for the ?u2 spike: one property of each common type, edited through a DetailView placed inside the scene.',
  properties: [
    { class: 'Int',     name: 'id',     documentation: 'Set by the demo on save.' },
    { class: 'String',  name: 'name',   value: 'alex' },
    { class: 'Int',     name: 'count',  value: 3 },
    { class: 'Boolean', name: 'active', value: true },
    { class: 'Date',    name: 'since',  factory: function() { return new Date(); } },
    { class: 'Enum',    of: 'foam.demos.rail.Mood', name: 'mood' },
    { class: 'String',  name: 'notes',  view: { class: 'foam.u2.tag.TextArea', rows: 2 } },
    { class: 'Reference', of: 'foam.demos.rail.Country', name: 'country', targetDAOKey: 'countryDAO', documentation: 'Picker fed by the countryDAO found in the view\'s context.' }
  ]
});

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
    grammars can sit in the dropdown without living in this repo; &doc opens
    the document view.

    Grammar text is JavaScript, and a dev build serves this page on the same
    origin as the running app. So a link must not run code on its own: every
    URL has to be same-origin, ?grammar= text waits in the editor until Load
    is pressed, and a presets file cannot replace a built-in preset (the toy
    one loads on open).
  `,

  requires: [ 'foam.parse.rail.RailDiagramView', 'foam.demos.rail.U2Sample', 'foam.demos.rail.Country', 'foam.dao.MDAO', 'foam.u2.ControllerMode' ],

  constants: {
    SAVED_TOP: 620,      // scene y of the first saved-object card, under the editor card
    SAVED_STEP: 250      // vertical distance between saved cards
  },

  methods: [
    function addU2Card(view) {
      /**
       * Spike: ordinary u2 inside the DOM scene. A card with an input, a button and a live
       * DerivationPanel is placed in the world at scene coordinates; it pans and zooms
       * with the strips and its widgets keep working. Open the page with ?u2.
       */
      var self = this, E = foam.u2.Element, count = 0, countEl, sample = this.U2Sample.create();
      // Saved objects: a client-side DAO of U2Sample; each put() renders one more card on the canvas.
      var savedDAO = this.MDAO.create({ of: this.U2Sample }), seq = 0, savedCount = 0, statusEl;
      // A client-side DAO in the card's context: the Reference property's picker finds it by targetDAOKey.
      var countryDAO = this.MDAO.create({ of: this.Country });
      [ [ 'CA', 'Canada' ], [ 'US', 'United States' ], [ 'GB', 'United Kingdom' ], [ 'IN', 'India' ], [ 'DE', 'Germany' ] ]
        .forEach(function(c) { countryDAO.put(this.Country.create({ code: c[0], name: c[1] })); }, this);
      var panel = view.panel.cls_.create({ onSelect: function(p) { view.highlight(p); } }, view);
      panel.snapshot$.follow(view.panel.snapshot$);            // live: every step the page shows reaches this copy too
      var card = E.create({ nodeName: 'div' })
        .style({ width: '300px', padding: '10px', border: '2px solid #0072B2', borderRadius: '8px', background: '#fff', font: '13px sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' })
        .start('b').add('u2 inside the canvas').end()
        .start('div').style({ margin: '6px 0' })
          .start('input').attrs({ placeholder: 'type here — it is a real <input>' }).style({ width: '100%' }).end()
        .end()
        .start('button').add('clicked ').call(function() { countEl = this.start('span').add('0'); countEl.end(); }).add(' times')
          .on('click', function() { countEl.removeAllChildren().add(String(++count)); }).end()
        .start('div').style({ marginTop: '8px', maxHeight: '220px', overflow: 'auto', borderTop: '1px solid #ddd' })
          .add(panel)
        .end()
        // Save: clone the edited model into savedDAO and render the stored object as its own card on the canvas.
        .start('button').add('Save to savedDAO').style({ marginTop: '6px' })
          .on('click', function() {
            var obj = sample.clone(); obj.id = ++seq;
            savedDAO.put(obj).then(function(stored) {
              statusEl.removeAllChildren().add('saved #' + stored.id + ' (' + ( ++savedCount ) + ' in DAO)');
              self.addSavedCard(view, stored, sample, savedCount - 1, countryDAO);
            });
          })
        .end()
        .call(function() { statusEl = this.start('span').style({ marginLeft: '8px', font: '11px monospace', color: '#555' }); statusEl.end(); })
        // A FOAM model edited through its property views (text, number, checkbox, date, enum chooser, textarea), all inside the camera.
        .start('div').style({ marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '6px' })
          .start('b').add('property views of a model').end()
          .startContext({ data: sample, controllerMode: foam.u2.ControllerMode.EDIT, countryDAO: countryDAO })
            .forEach([ sample.NAME, sample.COUNT, sample.ACTIVE, sample.SINCE, sample.MOOD, sample.COUNTRY, sample.NOTES ], function(p) {
              this.start('label').style({ display: 'flex', gap: '6px', alignItems: 'center', margin: '3px 0', font: '12px sans-serif' })
                .start('span').style({ width: '50px', color: '#555' }).add(p.label).end()
                .add(p)
              .end();
            })
          .endContext()
          .start('div').style({ font: '11px monospace', color: '#555', marginTop: '4px' })
            .add('live: ', sample.name$, ' · ', sample.count$.map(String), ' · ', sample.active$.map(String), ' · ', sample.mood$.map(function(m) { return m ? m.name : ''; }), ' · ', sample.country$)
          .end()
        .end();
      view.scene.addOverlay(card, 'right', 40);
    },

    function addSavedCard(view, obj, editor, n, countryDAO) {
      /**
       * One card per object that came back from savedDAO.put(): read-only property views of the
       * stored object (controllerMode VIEW), and a Load button that copies it back into the editor.
       */
      var card = foam.u2.Element.create({ nodeName: 'div' })
        .style({ width: '300px', padding: '8px 10px', border: '2px solid #009E73', borderRadius: '8px', background: '#fff', font: '12px sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' })
        .start('b').add('saved #' + obj.id + ' · ' + obj.cls_.name).end()
        .startContext({ data: obj, controllerMode: foam.u2.ControllerMode.VIEW, countryDAO: countryDAO })   // the read-only reference view still needs the DAO to show the name
          .forEach([ obj.NAME, obj.COUNT, obj.ACTIVE, obj.SINCE, obj.MOOD, obj.COUNTRY, obj.NOTES ], function(p) {
            this.start('div').style({ display: 'flex', gap: '6px', margin: '2px 0' })
              .start('span').style({ width: '50px', color: '#555' }).add(p.label).end()
              .start('span').add(p).end()
            .end();
          })
        .endContext()
        .start('button').add('Load into editor').style({ marginTop: '4px' })
          .on('click', function() { editor.copyFrom(obj); })
        .end();
      view.scene.addOverlay(card, 'right', this.SAVED_TOP + n * this.SAVED_STEP);
    },

    function render() {
      var self = this, q = new URLSearchParams(location.search), g = q.get('grammar'), i = q.get('input'), p = q.get('presets');
      var get = function(url) {
        if ( ! url ) return Promise.resolve(null);
        if ( new URL(url, location.href).origin !== location.origin ) return Promise.reject(new Error('only same-origin URLs are loaded: ' + url));
        return fetch(url).then(function(r) { if ( ! r.ok ) throw new Error(r.status + ' ' + url); return r.text(); });
      };
      // Extra presets come first: the preset list is built when the view renders.
      get(p).then(function(json) {
        var D = self.RailDiagramView.DEFAULT_PRESETS;
        var presets = Object.assign({}, D, json ? JSON.parse(json) : {}, D);   // built-ins keep their text: the toy one runs on open
        var view = self.RailDiagramView.create({ allowTypedGrammar: true, debugHook: true, presets: presets });
        self.add(view);
        if ( q.has('u2') ) self.addU2Card(view);
        if ( ! g && ! i ) { view.usePreset('comma list (toy)'); if ( q.has('doc') ) view.documentShown = true; return; }
        return Promise.all([ get(g), get(i) ]).then(function(a) {
          if ( a[1] !== null ) view.setInput(a[1]);
          if ( a[0] !== null ) {
            // Shown, not run: Load is the user's decision to execute it.
            view.grammarText = a[0]; view.syncGrammarEl(); view.grammarShown = true;
            view.status = 'grammar from ?grammar= is in the editor; read it, then press Load to run it';
          }
          if ( q.has('doc') ) view.documentShown = true;
        }).catch(function(x) { view.status = 'load failed: ' + x.message; });
      }).catch(function(x) { self.add('presets load failed: ' + x.message); });
    }
  ]
});
