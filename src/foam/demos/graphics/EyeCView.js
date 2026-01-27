/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
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
  name: 'EyeCView',
  label: 'Eye',
  extends: 'foam.graphics.CView',

  requires: [
    'foam.graphics.Circle'
  ],

  properties: [
    {
      class: 'String',
      name: 'color',
      value: 'red'
    },
    {
      class: 'String',
      name: 'pupilColor',
      value: 'black'
    },
    {
      class: 'Float',
      name: 'radius',
      label: 'Radius',
      value: 50
    },
    {
      name: 'lid',
      factory: function() {
        return this.Circle.create({ radius: this.radius });
      }
    },
    {
      name: 'white',
      factory: function() {
        return this.Circle.create({ radius: this.radius * 0.8, color: 'white' });
      }
    },
    {
      name: 'pupil',
      factory: function() {
        return this.Circle.create({ radius: this.radius / 5 });
      }
    },
    {
      class: 'Float',
      name: 'x',
      expression: function(r) { return 2 * r; }
    },
    {
      class: 'Float',
      name: 'y',
      expression: function(r) { return 2 * r * 1.3; }
    },
    {
      class: 'Float',
      name: 'width',
      value: 80
    },
    {
      class: 'Float',
      name: 'height',
      value: 100
    },
    {
      class: 'Float',
      name: 'a',
      value: -Math.PI / 40
    },
    {
      name: 'target_',
      documentation: 'The target object for the eye to watch'
    },
    [ 'scaleY', 1.3 ]
  ],

  methods: [
    function init() {
      this.SUPER();
      this.add(this.lid);
      this.add(this.white);
      this.add(this.pupil);
    },

    function watch(target) {
      this.target_ = target;
    },

    function paintSelf(x) {
      this.pupil.color = this.pupilColor;
      this.lid.color   = this.color;

      // Point pupil towards target
      if ( this.target_ ) {
        var dx    = this.pupil.canvasX - this.target_.canvasX;
        var dy    = this.pupil.canvasY - this.target_.canvasY;
        var theta = Math.atan2(dy, dx);
        var r     = Math.min(this.radius, Math.sqrt(dx * dx + dy * dy));
        var newX  = -r * 0.6 * Math.cos(-theta);
        var newY  = r * 0.6 * Math.sin(-theta);

        // Don't bother moving the pupil only a small distance to avoid eye jittering
        var dist = Math.sqrt(
          Math.pow(this.pupil.x - newX, 2) +
          Math.pow(this.pupil.y - newY, 2)
        );
        if ( dist > 2 ) {
          this.pupil.x = newX;
          this.pupil.y = newY;
        }
      }
    }
  ]
});
