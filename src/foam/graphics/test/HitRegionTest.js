/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics.test',
  name: 'HitRegionTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.graphics.Box',
    'foam.graphics.CViewTheme',
    'foam.graphics.HitRegion',
    'foam.graphics.Scene',
    'foam.graphics.SceneLayer',
    'foam.graphics.TooltipCView'
  ],

  documentation: 'A HitRegion reports its role through Scene.hitAtView; a tooltip sizes itself from text and is never hit.',

  methods: [
    async function runTest(x) {
      var s = this.Scene.create({ viewWidth: 300, viewHeight: 300, measure: foam.graphics.TextUtil.estimateMeasurer(8) });
      var content = s.addLayer(this.SceneLayer.create());
      var overlay = s.addLayer(this.SceneLayer.create());

      var shape  = this.Box.create({ x: 10, y: 10, width: 100, height: 40 });
      var toggle = this.HitRegion.create({ x: 80, y: 0, width: 20, height: 20, role: 'toggle' });
      shape.add(toggle);
      content.add(shape);

      var hit = s.hitAtView(95, 15);
      x.test(hit === toggle && hit.role === 'toggle', 'a click on the sub-part returns the HitRegion with its role');
      x.test(s.hitAtView(20, 30) === shape,          'a click elsewhere on the shape returns the shape');

      var tip = this.TooltipCView.create({ text: 'hello', theme: this.CViewTheme.create(), measure: s.measure, x: 50, y: 50 });
      overlay.add(tip);
      tip.layout();
      x.test(tip.width === 5 * 8 + 2 * tip.padding, 'tooltip width = text width + 2 * padding');
      x.test(tip.height > 0,                         'tooltip height comes from the font size + padding');
      x.test(s.hitAtView(55, 55) === shape || s.hitAtView(55, 55) === undefined, 'a tooltip never captures the pointer');
      x.test(s.hitAtView(55, 55) !== tip,            'the tooltip is not the hit');
    }
  ]
});
