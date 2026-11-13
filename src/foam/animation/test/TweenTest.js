/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.animation.test',
  name: 'TweenTest',
  extends: 'foam.core.test.JSTest',

  requires: [ 'foam.animation.Tween' ],

  documentation: 'A tween drives onUpdate from 0 to 1 over its duration on the injected scheduler, ends exactly at 1, and can be cancelled.',

  methods: [
    async function runTest(x) {
      // Deterministic clock and scheduler: each scheduled frame advances 50 ms.
      var t = 0, queue = [];
      var schedule = function(cb) { queue.push(cb); };
      var now = function() { return t; };
      var run = function() { while ( queue.length ) { t += 50; queue.shift()(t); } };

      var values = [], done = 0;
      var tw = this.Tween.create({ duration: 200, ease: this.Tween.linear, schedule: schedule, now: now,
        onUpdate: function(v) { values.push(v); }, onDone: function() { done++; } }).start();
      x.test(tw.running, 'running after start');
      run();
      x.test(values.length === 4 && values[0] === 0.25 && values[3] === 1, 'four frames at 50 ms: 0.25 .. 1');
      x.test(done === 1 && ! tw.running,               'onDone once; not running after the last frame');

      // Ease-out cubic starts fast and ends at exactly 1.
      x.test(this.Tween.outCubic(0) === 0 && this.Tween.outCubic(1) === 1 && this.Tween.outCubic(0.5) > 0.5, 'outCubic shape');

      // Cancel stops frames and never calls onDone.
      values = []; done = 0; t = 0;
      var tw2 = this.Tween.create({ duration: 200, schedule: schedule, now: now, onUpdate: function(v) { values.push(v); }, onDone: function() { done++; } }).start();
      t += 50; queue.shift()(t);
      tw2.cancel();
      run();
      x.test(values.length === 1 && done === 0 && ! tw2.running, 'cancel: one frame ran, no more, no onDone');

      // Detaching the owner cancels the tween: no further frames, no onDone.
      values = []; done = 0; t = 0;
      var owner = foam.lang.FObject.create();
      var tw3 = this.Tween.create({ duration: 200, schedule: schedule, now: now, onUpdate: function(v) { values.push(v); }, onDone: function() { done++; } }).start();
      owner.onDetach(tw3);
      t += 50; queue.shift()(t);
      owner.detach();
      run();
      x.test(values.length === 1 && done === 0 && ! tw3.running, 'owner.detach(): one frame ran, tween stopped, no onDone');

      // A zero duration completes on its first frame.
      values = [];
      this.Tween.create({ duration: 0, schedule: schedule, now: now, onUpdate: function(v) { values.push(v); } }).start();
      run();
      x.test(values.length === 1 && values[0] === 1, 'duration 0 jumps to 1');
    }
  ]
});
