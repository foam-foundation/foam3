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
  name: 'TextField',
  extends: 'foam.u2.tag.Input',

  mixins: [ 'foam.u2.TextInputCSS' ],

  css: `
    ^ {
      height: $inputHeight;
    }

    input[type="search"] {
      -webkit-appearance: textfield;
    }

    ^:read-only:not(:disabled) {
      border: none;
      background: $backgroundDefault;
    }
  `,

  properties: [
    {
      class: 'Int',
      name: 'displayWidth'
    },
    {
      class: 'String',
      name: 'units'
    }
  ],

  methods: [
    function fromProperty(prop) {
      this.SUPER(prop);

      if ( ! this.placeholder && prop.placeholder ) {
        this.placeholder = prop.placeholder;
      }

      if ( ! this.displayWidth ) {
        this.displayWidth = prop.displayWidth;
      }

      if ( ! this.size ) {
        this.size = this.displayWidth;
      }

      if ( ! this.units ) {
        this.units = prop.units;
      }
    },

    function load() {
      this.SUPER();

      if ( this.units ) {
        var parent = this.parentNode;
        var self   = this;
        var span   = parent.start('span').style({display: 'inline-block', position: 'relative', 'font-weight': '300'}).add(self.units, ' ');
        var e      = span.el_();
        var w      = Math.ceil(e.getBoundingClientRect().width);

        span.style({left: '-' + (4) + 'px'});
        self.style({'padding-right': (w+6) + 'px', 'margin-right': (-w) + 'px'});
      }
    }
  ]
});
