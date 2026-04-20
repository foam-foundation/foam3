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
  package: 'foam.u2',
  name: 'ProgressView',
  extends: 'foam.u2.View',

  cssTokens: [
    {
      name: 'progressColor',
      value: '$backgroundBrand'
    },
    {
      name: 'trackColor',
      value: '$backgroundTertiary'
    }
  ],

  css: `
    ^ {
      width: 100%;
      -webkit-appearance: none;
      height: 8px;
    }
    ^::-webkit-progress-bar {
      background-color: $trackColor;
      border-radius: 25px;
    }
    ^::-webkit-progress-value {
      background-color: $progressColor;
      border-radius: 25px;
    }
  `,

  properties: [
    [ 'nodeName', 'progress' ],
    [ 'max', 100 ],
  ],

  methods: [
    function render() {
      this.addClass();
      this.attrSlot('max').follow(this.max$);
      this.attrSlot().follow(this.data$);
    }
  ]
});
