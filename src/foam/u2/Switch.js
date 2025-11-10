/**
 * @license
 * Copyright 2025 Google Inc. All Rights Reserved.
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
  name: 'Switch',
  extends: 'foam.u2.CheckBox',

  documentation: 'Switch View.',

  inheritCSS: false,
  css: `
   ^ {
      -webkit-appearance: none;
      appearance: none;
      position: relative;
      border-radius: 25px;
      border: solid 1px $borderStrong;
      margin: 0;
      padding: 0px;
      transition: background-color 140ms, border-color 140ms;
    }
    ^:disabled {
      border-color: $borderLight;
      background-color: $backgroundSecondary;
    }
    ^:before {
      content: "";
      position: absolute;
      background-color: $textSecondary;
      transition: .2s ease;
      border-radius: 50%;
    }
    ^:checked {
      background-color: $checkboxColor;
      border-color: $checkboxColor;
      fill: white;
    }
    ^:checked + ^ {
      border: 1px solid $checkboxColor;
      background-color: $checkboxColor;
    }
    ^:checked:disabled {
      border-color: $checkboxColor$disabled;
      background-color: $checkboxColor$disabled;
      fill: white;
    }
    ^:checked:before {
      transform: translateX(15px);
      background-color: $checkboxColor$foreground;
    }
    ^:checked:disabled:before {
      background-color: $checkboxColor$disabled$foreground;
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
    ^medium { 
      width: 40px;
      height: 24px;
    }
    ^medium:before {
      height: 16px;
      width: 16px;
      left: 3px;
      top: 3px;
    }
    ^small { 
      width: 32px;
      height: 14px;
    }
    ^small:before {
      height: 10px;
      width: 10px;
      left: 1px;
      top: 1px;
    }
    ^small:checked:before {
      transform: translateX(18px);
    }
  `,
  properties: [
    {
      class: 'Enum',
      of: 'foam.u2.SwitchSize',
      name: 'size',
      value: 'MEDIUM'
    }
  ],
  methods: [
    function render() {
      this.SUPER();
       this.addClass(this.slot(function(size) { return this.myClass(size.label.toLowerCase()) }));
    }
  ]
});

foam.ENUM({
  package: 'foam.u2',
  name: 'SwitchSize',
  values: [
    { name: 'SMALL', label: 'Small' },
    { name: 'MEDIUM', label: 'Medium' },
    { name: 'LARGE', label: 'Large' }
  ]
})