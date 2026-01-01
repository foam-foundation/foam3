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
  name: 'EyesCView',
  label: 'Eyes',
  extends: 'foam.graphics.CView',

  requires: [
    'foam.demos.graphics.EyeCView'
  ],

  constants: {
    RED:    '#f00',
    YELLOW: '#ff0'
  },

  properties: [
    {
      class: 'Float',
      name: 'radius',
      value: 50
    },
    {
      name: 'leftEye',
      factory: function() {
        return this.EyeCView.create({
          x: this.radius * 65.0 / 50.0,
          y: 85,
          radius: this.radius,
          color: this.RED
        });
      }
    },
    {
      name: 'rightEye',
      factory: function() {
        return this.EyeCView.create({
          x: this.radius * 65.0 / 50.0 + this.radius * 85 / 50,
          y: 88,
          radius: 0.98 * this.radius,
          color: this.YELLOW
        });
      }
    },
    {
      class: 'Float',
      name: 'width',
      value: 300
    },
    {
      class: 'Float',
      name: 'height',
      value: 200
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.add(this.rightEye);
      this.add(this.leftEye);
    },

    function watch(target) {
      this.leftEye.watch(target);
      this.rightEye.watch(target);
    }
  ]
});
