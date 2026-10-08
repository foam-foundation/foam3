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
  package: 'foam.u2.tag',
  name: 'TextArea',
  extends: 'foam.u2.View',

  mixins: [ 'foam.u2.TextInputCSS' ],

  css: `
    /* Override a few of the styles in foam.u2.TextInputCSS */
    << {
      padding-top: $inputVerticalPadding;
      padding-bottom: $inputVerticalPadding;
    }
  `,

  properties: [
    [ 'nodeName', 'textarea' ],
    {
      class: 'Int',
      name: 'rows',
      value: 4
    },
    {
      class: 'Int',
      name: 'cols',
      value: 60
    },
    {
      class: 'Boolean',
      name: 'onKey',
      attribute: true,
      documentation: 'When true, $$DOC{ref:".data"} is updated on every keystroke, rather than on blur.',
    },
    'placeholder',
    {
      class: 'String',
      name: 'wrap',
      value: 'soft'
    },
    {
      class: 'Boolean',
      name: 'escapeTextArea',
      value: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.addClass();
      if ( this.escapeTextArea ) {
        this.style({'white-space': 'pre'});
      }
      this.attrs({rows: this.rows, cols: this.cols, placeholder: this.placeholder$, wrap: this.wrap});
      if ( this.maxLength ) this.attrs({maxLength: this.maxLength});

      // This is required because textarea accepts setting the 'value'
      // after it's output, but before requires output to be between
      // the tags when it's first output.
     // this.add((this.data + '').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

      this.attrSlot(
        'value',
        this.onKey ? 'input' : 'change').linkFrom(this.data$);
    },

    function load() {
      // value can't be set before object is created, so set value
      // once loaded
      this.SUPER();
      this.attrs({value: this.data + ''});
    },

    function updateMode_(mode) {
      // TODO: make sure that DOM is updated if values don't change
      this.setAttribute('readonly', mode === foam.u2.DisplayMode.RO);
      this.setAttribute('disabled', mode === foam.u2.DisplayMode.DISABLED);
    },

    function fromProperty(p) {
      this.SUPER(p);

      if ( ! this.hasOwnProperty('onKey') ) {
        this.onKey = p.hasOwnProperty('onKey') ? p.onKey : p.validateObj;
      }

      if ( ! this.hasOwnProperty('maxLength') && p.maxLength ) this.maxLength = p.maxLength;

      this.ariaLabel = p.label || p.name;
    }
  ]
});
