/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics.test',
  name: 'SceneTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.graphics.Box',
    'foam.graphics.Scene',
    'foam.graphics.SceneLayer'
  ],

  documentation: 'Camera maths and layer hit order, headless (no canvas element).',

  methods: [
    function near(a, b) { return Math.abs(a - b) < 1e-6; },

    async function runTest(x) {
      // --- zoomAt keeps the point under the cursor fixed ---
      var s = this.Scene.create({ viewWidth: 800, viewHeight: 600, measure: foam.graphics.TextUtil.estimateMeasurer(7) });
      s.panBy(100, 50);
      var before = s.toSceneFromView(300, 200);
      s.zoomAt(300, 200, 2);
      var after = s.toSceneFromView(300, 200);
      x.test(this.near(before.x, after.x) && this.near(before.y, after.y), 'zoomAt: the scene point under the viewport point is unchanged');
      x.test(s.zoom === 2 && s.scaleX === 2 && s.scaleY === 2,          'zoom drives scaleX and scaleY');

      s.zoomAt(0, 0, 100);
      x.test(s.zoom === s.maxZoom, 'zoomAt clamps to maxZoom');
      s.zoomAt(0, 0, 0.0001);
      x.test(s.zoom === s.minZoom, 'zoomAt clamps to minZoom');

      // --- fit never exceeds zoom 1, and centres the bounds ---
      s.fit({ x: 0, y: 0, width: 100, height: 100 }, 40);
      x.test(s.zoom === 1, 'fit: a small content box is not blown up past zoom 1');
      var c = s.toSceneFromView(400, 300);
      x.test(this.near(c.x, 50) && this.near(c.y, 50), 'fit: the bounds centre sits at the viewport centre');

      s.fit({ x: 0, y: 0, width: 8000, height: 600 }, 0);
      x.test(this.near(s.zoom, 0.1) || s.zoom === s.minZoom, 'fit: a wide content box shrinks to fit the width (clamped at minZoom)');

      // --- hit order: topmost layer first ---
      var t = this.Scene.create({ viewWidth: 200, viewHeight: 200, measure: foam.graphics.TextUtil.estimateMeasurer(7) });
      var back = this.SceneLayer.create(), front = this.SceneLayer.create();
      t.addLayer(back); t.addLayer(front);
      var big   = this.Box.create({ x: 0,  y: 0,  width: 200, height: 200 });
      var small = this.Box.create({ x: 50, y: 50, width: 20,  height: 20  });
      back.add(big); front.add(small);
      x.test(t.hitAtView(60, 60) === small, 'a point inside both boxes hits the front layer first');
      x.test(t.hitAtView(10, 10) === big,   'a point only inside the back box hits the back box');
      x.test(t.hitAtView(-5, -5) === undefined, 'a point outside everything hits nothing');
      x.test(t.hitAtView(190, 190) !== front && t.hitAtView(190, 190) !== back, 'layers are never hit targets');

      // --- hit-testing respects the camera ---
      t.zoom = 2; t.x = 10; t.y = 10;
      x.test(t.hitAtView(10 + 55 * 2, 10 + 55 * 2) === small, 'hitAtView maps through pan and zoom');

      // --- measureText delegates ---
      x.test(t.measureText('abc', 'any') === 21, 'measureText uses the injected measurer');
    }
  ]
});
