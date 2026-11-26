/**
 * @license
 * Copyright 2015 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.robot',
  name: 'Robot',
  extends: 'foam.graphics.CView',

  implements: [ 'foam.physics.Physical' ],

  // author: Sebastian Greer (age 11)

  requires: [
    'foam.graphics.Arc',
    'foam.graphics.Box as Rectangle',
    'foam.graphics.Circle',
    'foam.graphics.CView',
    'foam.graphics.ImageCView',
    'foam.util.Timer'
  ],

  properties: [
    [ 'width',  25 ],
    [ 'height', 45 ],
    {
      name: 'timer',
      hidden: true,
      factory: function() {
        return this.__context__.timer || this.Timer.create();
      }
    }
  ],

  methods: [
    function initCView() {
      this.SUPER

      var self = this;

      const WIDTH = 20, HEIGHT = 30;

      var body = this.Rectangle.create({
        width:  WIDTH,
        height: HEIGHT,
        color:  '#ccc'
      });
      this.add(body);

//      var logo = this.ImageCView.create({src:'./js/com/google/watlobby/img/foam_red.png', x:17, y:3, width: 30, height: 5, a: Math.PI/2});
//      body.add(logo);

      var neck = this.Rectangle.create({
        color:  'black',
        width:  2,
        y:     -13,
        x:      9,
        height: 15
      });
      body.add(neck);

      var head = this.Circle.create({
        radius: 8,
        color:  'purple',
        x:      0,
        y:      -5
      });
      neck.add(head);

      var engine = this.Circle.create({
        radius: 8,
        color:  'red',
        border: null,
        x:      10,
        y:      30.5,
        start:  0,
        end:    Math.PI
      });
      body.add(engine);

      var eye = this.Circle.create({
        radius: 5,
        color:  'white'
      });
      head.add(eye);

      var pupil = this.Circle.create({
        radius: 2,
        color:  'lightblue'
      });
      eye.add(pupil);

      // animate
      var timer = this.timer;
      timer.time$.sub(function() {
        body.scaleX = (self.width) / WIDTH;
        body.scaleY = (self.height) / HEIGHT;

        var t = timer.time/16;
        body.y        = 10 * Math.cos(t/9);
        body.rotation = Math.PI / 8 * Math.cos(t/30);
        pupil.x       = 4* Math.cos(t/15);
        neck.height   = 15 + 10 * Math.cos(t/15);
        neck.y        = -13 - 10* Math.cos(t/15);
      });
      timer.start();
    },

    // Make the holding Canvas larger than normal to give space for the
    // robot when it's animated outside of the regular rectangle.
    function toE(args, X) {
      return this.Canvas.create({
        cview: this,
        width$: this.slot(function(x, width,  scaleX) { return 100+ x + width*scaleX*2; }),
        height$: this.slot(function(y, height, scaleY) { return 100+y + height*scaleY*1.6; })
      }, X);
    }
  ]
});
