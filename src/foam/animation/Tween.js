/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.animation',
  name: 'Tween',

  documentation: `
    One eased progression from 0 to 1 over a duration, delivered through
    onUpdate on each animation frame. Domain-free: the caller maps the value
    onto whatever it animates (a stroke width, a camera position). The frame
    scheduler and clock are injectable so tests run without a browser clock.

    Tie a tween to its owner with owner.onDetach(tween): detaching the owner
    cancels the tween, so a view torn down mid-animation stops scheduling frames.

    Sits beside Animation/Interp in this package: that pair animates an object's
    properties by diffing before/after states; Tween is one value over time that
    the caller maps onto anything, with an injectable clock for tests. A later
    change can rebuild Animation on top of Tween so both share one clock.
  `,

  constants: {
    DEFAULT_DURATION: 200
  },

  properties: [
    { class: 'Int', name: 'duration', factory: function() { return this.DEFAULT_DURATION; }, documentation: 'Milliseconds.' },
    { name: 'ease', factory: function() { return foam.animation.Tween.outCubic; }, documentation: 'function(t) -> eased t, both in 0..1.' },
    { class: 'Function', name: 'onUpdate', value: function(v) {} },
    { class: 'Function', name: 'onDone',   value: function() {} },
    { name: 'schedule', factory: function() { return function(cb) { requestAnimationFrame(cb); }; } },
    { name: 'now',      factory: function() { return function() { return performance.now(); }; } },
    { class: 'Boolean', name: 'running' },
    { name: 'start_' },
    { class: 'Int', name: 'gen_', documentation: 'Incremented by cancel/start so a stale frame is ignored.' }
  ],

  methods: [
    function start() {
      var self = this, gen = ++this.gen_;
      this.start_  = this.now();
      this.running = true;
      var frame = function(nowArg) {
        if ( gen !== self.gen_ ) return;                       // cancelled or restarted
        var elapsed = ( typeof nowArg === 'number' ? nowArg : self.now() ) - self.start_;
        var t = self.duration <= 0 ? 1 : Math.min(1, elapsed / self.duration);
        self.onUpdate(self.ease(t));
        if ( t < 1 ) { self.schedule(frame); return; }
        self.running = false;
        self.onDone();
      };
      this.schedule(frame);
      return this;
    },

    function cancel() {
      this.gen_++;
      this.running = false;
    },

    function detach() {
      this.cancel();
      this.SUPER();
    }
  ],

  static: [
    function linear(t)   { return t; },
    function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  ]
});
