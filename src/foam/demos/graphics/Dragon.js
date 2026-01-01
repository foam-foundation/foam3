/**
 * @license
 * Copyright 2012 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.demos.graphics',
  name: 'Dragon',
  extends: 'foam.graphics.CView',

  requires: [
    'foam.demos.graphics.EyesCView',
    'foam.graphics.Circle'
  ],

  exports: [
    'timer'
  ],

  constants: {
    COLORS: [ '#33f', '#f00', '#fc0', '#3c0' ] // Google colours in 2012
  },

  properties: [
    {
      name: 'i',
      value: 1
    },
    {
      class: 'Boolean',
      name: 'blowBubbles',
      value: true
    },
    {
      name: 'eyes',
      factory: function() {
        return this.EyesCView.create({ x: -50, y: -160, radius: 25 });
      }
    },
    {
      class: 'Int',
      name: 'radius',
      value: 10
    },
    {
      class: 'Float',
      name: 'width',
      value: 1000
    },
    {
      class: 'Float',
      name: 'height',
      value: 800
    },
    {
      class: 'Float',
      name: 'x',
      value: 500
    },
    {
      class: 'Float',
      name: 'y',
      value: 350
    },
    {
      name: 'backgroundColor',
      label: 'Background',
      value: 'gray'
    },
    {
      name: 'timer',
      factory: function() {
        var t = this.__context__.timer || foam.util.Timer.create();
        t.start();
        return t;
      }
    }
  ],

  methods: [
    function initCView() {
      this.SUPER();
      this.add(this.eyes);
    },

    function dot(c, r) {
      c.beginPath();
      c.fillStyle = this.COLORS[this.i = (this.i + 1) % this.COLORS.length];
      c.arc(0, 0, r, 0, Math.PI * 2, true);
      c.fill();
    },

    function tail(c, r, a) {
      if ( r < 1 ) return;
      this.dot(c, r);
      c.rotate(a);
      c.translate(0, r * 2.2);
      this.tail(c, r * 0.975, a);
    },

    function wing(c, r, a) {
      if ( r < 1 ) return;
      c.save();
      c.rotate(Math.PI / 2);
      this.feather(c, r * 0.4);
      c.restore();
      this.dot(c, r);
      c.rotate(a);
      c.translate(r * 2.2, 0);
      this.wing(c, r * 0.945, a);
    },

    function feather(c, r) {
      if ( r < 1 ) return;
      this.dot(c, r);
      c.rotate(0.05 * Math.sin(Math.PI * this.timer.time / 2000));
      c.translate(r * 2.2, 0);
      this.feather(c, r * 0.92);
    },

    function paint(x) {
      this.y = 350 - 30 * Math.sin(-Math.PI/2 + Math.PI * 2 * this.timer.time / 4000);

      this.SUPER(x);
    },

    function paintSelf(x) {
      this.i = 0;
      var time = this.timer.time;

      x.save();
      try {
        // tail
        x.save();
        this.tail(x, this.radius, Math.sin(time / 4000 * (Math.PI * 2)) * Math.PI / 10);
        x.restore();

        var a = Math.sin(time / 4000 * (Math.PI * 2)) * Math.PI / 31.5;

        // right wing
        x.save();
        x.rotate(-0.4);
        this.wing(x, this.radius, a);
        x.restore();

        // left wing
        x.save();
        x.scale(-1, 1);
        x.rotate(-0.4);
        this.wing(x, this.radius, a);
        x.restore();

        // neck
        x.save();
        x.translate(0, 2 * -this.radius);
        this.dot(x, this.radius);
        x.translate(0, 2 * -this.radius);
        this.dot(x, this.radius * 0.8);
        x.restore();
      } catch (e) {
        console.log(e);
      }
      x.restore();

      if ( ! this.blowBubbles ) return;
      if ( Math.random() > 0.2 ) return;

      var circle = this.Circle.create({
        radius: 0,
        y: -this.radius * 6,
        color: 'white',
        arcWidth: 2,
        border: this.COLORS[Math.floor(Math.random() * this.COLORS.length)]
      });

      this.add(circle);

      // Animate the bubble
      this.animateBubble_(circle);
    },

    function animateBubble_(circle) {
      var startTime = this.timer.time;
      var startX    = circle.x;
      var startY    = circle.y;
      var targetX   = startX - Math.random() * 150 - 200;
      var targetY   = startY - 150 - Math.random() * 50;
      var targetR   = 25 + Math.random() * 50;

      var unsub = this.timer.time$.sub(() => {
        var elapsed = this.timer.time - startTime;
        var t = Math.min(elapsed / 4000, 1);

        // sqrt easing for x movement
        var tSqrt = Math.sqrt(t);
        circle.x = startX + (targetX - startX) * tSqrt;
        circle.alpha = 1 - tSqrt;

        // ease-in for y and size
        var tEase = t * t * 0.5 + t * 0.5;
        circle.y = startY + (targetY - startY) * tEase;
        circle.radius = targetR * tEase;
        circle.arcWidth = 2 + 10 * tEase;

        if ( t >= 1 ) {
          unsub && unsub.detach();
          this.remove(circle);
        }
      });
    }
  ]
});
