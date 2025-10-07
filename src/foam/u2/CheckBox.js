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
  name: 'CheckBox',
  extends: 'foam.u2.property.AbstractCheckBox',

  documentation: 'Checkbox View.',

  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'checkboxColor',
      value: '$backgroundBrand'
    }
  ],

  css: `
    ^ {
      -webkit-appearance: none;
      appearance: none;
      border-radius: 2px;
      border: solid 1px $borderStrong;
      height: 1.275em;
      margin: 7px 0;
      padding: 0px;
      transition: background-color 140ms, border-color 140ms;
      width: 1.275em;
    }
    ^:disabled {
      border-color: $borderLight;
      background-color: $backgroundSecondary;
    }
    ^:checked {
      background-color: $checkboxColor;
      border-color: $checkboxColor;
      fill: white;
    }
    ^:checked:disabled {
      border-color: $checkboxColor$disabled;
      background-color: $checkboxColor$disabled;
      fill: white;
    }
    ^:checked:after {
      position:relative;
      top: 1px;
      content: url("/images/checkmark-white.svg");
    }
    ^ input:focus + label::before {
      content: ''
      box-shadow: 0 0 0 3px $checkboxColor$active;
    }
    ^:hover:not(:disabled) {
      cursor: pointer
    }
    ^label, input[type="checkbox"]{
      vertical-align: middle;
    }
    ^desc {
      color: $textSecondary;
    }
    `,

  methods: [
    function render() {
      this.SUPER();

      var self = this;
      this
        .setAttribute('type', 'checkbox')
        .addClass(this.myClass())
        .on('click', this.onClick);

      if ( this.showLabel ) {
        this.parentNode.start('label')
          .addClass(this.myClass('label'))
          .addClass(this.myClass('noselect'))
          .on('click', this.onClick)
          .callIfElse(this.labelFormatter,
            this.labelFormatter,
            function() { this.add(self.label$); }
          )
        .end();
      }
    }
  ],

  listeners: [
    function onClick() {
      if ( this.getAttribute('disabled') ) return;
      this.data = ! this.data;
    }
  ]
});
