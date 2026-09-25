/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailDomSceneTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.ParseTrace',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailScene'
  ],

  documentation: 'The camera is a CSS transform on the world div; zoomAt keeps the point under the pointer; off-screen strips are not rendered.',

  methods: [
    async function runTest(x) {
      var g = this.Grammar.create({ symbols: function(seq, sym, literal, eof) {
        return { START: seq(sym('a'), eof()), a: literal('x') };
      } });
      var s = this.RailScene.create({ viewWidth: 400, viewHeight: 300, measure: foam.graphics.TextUtil.estimateMeasurer(7), motion: false });
      s.setStrips(this.RailBuilder.create({ grammar: g, theme: s.theme, measure: s.measure }).buildStrips());
      s.write();
      var world = s.world_.element_;

      s.fitWidth();
      x.test(world.style.transform === 'translate(' + s.x + 'px, ' + s.y + 'px) scale(' + s.zoom + ')', 'world transform mirrors the camera: ' + world.style.transform);

      // zoomAt keeps the scene point under (100, 100) fixed.
      var p0 = s.toSceneFromView(100, 100), z0 = s.zoom;
      s.zoomAt(100, 100, 2);
      var p1 = s.toSceneFromView(100, 100);
      x.test(Math.abs(p0.x - p1.x) < 1e-6 && Math.abs(p0.y - p1.y) < 1e-6, 'zoomAt keeps the point under the pointer');
      x.test(s.zoom === Math.min(s.maxZoom, z0 * 2), 'zoom doubled (within limits)');

      // Trace state reaches the DOM.
      var tr = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: 'x' }).record();
      s.applyTrace(tr.at(tr.length()));
      var term = s.strips[1].track.g_.element_;
      x.test(/outcome-MATCHED/.test(term.getAttribute('class')), 'applyTrace writes the outcome class');
      x.test(term.querySelector('text.value').textContent === 'x', 'value tag shows the matched text');
      x.test(s.strips[1].laneEl_.element_.textContent === '', 'lane empty while lanes are off');
      s.showLanes = true;
      x.test(s.strips[1].laneEl_.element_.textContent === '⇒ x' && s.strips[0].laneEl_.element_.textContent === '⇒ x', 'lanes list what each rule matched: ' + s.strips[1].laneEl_.element_.textContent);
      x.test(s.strips[1].y - s.strips[0].y === s.strips[0].height + s.theme.STRIP_GAP + s.strips[0].LANE_GAP, 'lanes add room between strips');
      x.test(/\blanes\b/.test(s.element_.getAttribute('class')) && /\bvalues\b/.test(s.element_.getAttribute('class')), 'toggle classes on the scene root');
      s.applyTrace(null);
      x.test(/outcome-NONE/.test(term.getAttribute('class')), 'applyTrace(null) clears it');

      // Culling: a strip far below the viewport is not rendered until the camera reaches it.
      s.strips[1].y = 5000; s.placeStrips(); s.cull();
      x.test(! s.isStripVisible(s.strips[1]) && s.isStripVisible(s.strips[0]), 'off-screen strip hidden, on-screen strip shown');
      s.centerOnStrip('a'); s.cull();
      x.test(s.isStripVisible(s.strips[1]), 'centring on the strip shows it again');

      // Tooltip.
      s.showTooltip('hello', 10, 20);
      x.test(! s.tip_.element_.hidden && s.tip_.element_.textContent === 'hello', 'tooltip shown with text');
      s.hideTooltip();
      x.test(s.tip_.element_.hidden, 'tooltip hidden');
      s.remove();
    }
  ]
});
