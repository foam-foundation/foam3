/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailCacheTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.Outcome',
    'foam.parse.rail.ParseTrace',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailScene'
  ],

  documentation: 'Strips are cached bitmaps; a trace change inside a strip invalidates only that strip; unfolding re-caches; the toggle uncaches.',

  methods: [
    async function runTest(x) {
      var g = this.Grammar.create({ symbols: function(seq, sym, literal, eof) { return { START: seq(sym('a'), eof()), a: literal('a'), b: literal('b') }; } });
      var s = this.RailScene.create({ viewWidth: 400, viewHeight: 300, measure: foam.graphics.TextUtil.estimateMeasurer(7), motion: false });
      var b = this.RailBuilder.create({ grammar: g, theme: s.theme, measure: s.measure });
      s.setStrips(b.buildStrips());
      x.test(s.strips.every(function(st) { return st.cached_; }), 'every strip is cached by default');

      // Paint once through a real context so bitmaps exist.
      var canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 300;
      var ctx = canvas.getContext('2d');
      s.paint(ctx);
      x.test(s.strips.every(function(st) { return !! st.cacheCanvas_; }), 'first paint renders each strip\'s bitmap');

      // Between two snapshots of a trace over START and a, only those two strips change; b (never
      // reached in either) keeps its bitmap. (The first snapshot fades b to NEVER, which is a real
      // visual change, so the comparison starts after that paint.)
      var tr = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: 'a' }).record();
      s.applyTrace(tr.at(tr.length()));
      s.paint(ctx);
      var bBitmap = s.strips[2].cacheCanvas_;
      s.applyTrace(tr.at(tr.length() - 1));
      x.test(! s.strips[0].cacheCanvas_ && ! s.strips[1].cacheCanvas_, 'changed strips dropped their bitmaps');
      x.test(s.strips[2].cacheCanvas_ === bBitmap,                         'untouched strip keeps its bitmap');
      s.paint(ctx);
      x.test(!! s.strips[0].cacheCanvas_, 'repaint re-renders the changed strip once');

      // Unfold adds children the cache did not subscribe to: the scene re-caches that strip.
      var ref = s.strips[0].track.items[0];
      ref.unfold();
      s.recacheStrip(s.strips[0]);
      s.paint(ctx);
      var before = s.strips[0].cacheCanvas_;
      ref.inner.outcome = this.Outcome.MATCHED;
      x.test(s.strips[0].cacheCanvas_ !== before || ! s.strips[0].cacheCanvas_, 'a change inside the unfolded content invalidates the strip after recache');

      s.cacheStrips = false;
      x.test(s.strips.every(function(st) { return ! st.cached_; }), 'turning caching off uncaches every strip');
    }
  ]
});
