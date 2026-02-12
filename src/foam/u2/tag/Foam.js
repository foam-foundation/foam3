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
  package: 'foam.u2.tag',
  name: 'Foam',
  extends: 'foam.u2.View',

  properties: [
    {
      class: 'String',
      name: 'class',
      attribute: true
    },
    {
      class: 'Map',
      name: 'attributes'
    },
    'proxyEl_'
  ],

  methods: [
    function render() {
      var self = this;
      this.add(this.dynamic(function(cls, attrs) {
        cls = foam.maybeLookup(cls);
        if ( cls ) {
          this.start(cls, attrs, self.proxyEl_$)
        } else {
          this.add('UNKNOWN CLASS:', cls);
        }
      }, this.class$, this.attributes$));
    },
    function setAttribute(key, value) {
      if ( key === 'class' ) { this.class = value; return; }
      if ( ! this.proxyEl_ ) { this.attributes$set(key, value); return; }
      if ( this.proxyEl_.setAttribute )
        this.proxyEl_.setAttribute(key, value);
      else
        this.proxyEl_[key] = value;
      return this;
    }
  ]
});


foam.SCRIPT({
  package: 'foam.u2.tag',
  name: 'FoamTagScript',
  code: function() {
    foam.__context__.registerElement(foam.u2.tag.Foam);
  }
});
