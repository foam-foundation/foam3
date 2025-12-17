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
      name: 'attributes'
    }
  ],

  methods: [
    function initArgs(args, opt_parent) {
      this.SUPER(args, opt_parent);

      args = foam.util.clone(args);
      delete args['class'];
      this.attributes = args;
    },

    function render() {
      var self = this;
      var cls = foam.maybeLookup(this.class);
      if ( cls ) {
        var o = cls.create(this.attributes, this);
        this.tag(o);
      } else {
        this.add('UNKNOWN CLASS:', this.class);
      }

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
