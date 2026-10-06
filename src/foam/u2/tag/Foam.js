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

  documentation: `
    The <foam> tag as it appears in markdown - flow documents included.

    Note that the <foam> tags in a page's static HTML are handled separately,
    by foam.u2.FoamTagLoader, which supports the same pauseoffscreen attribute.
  `,

  requires: [ 'foam.u2.borders.VisibilityBorder' ],

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
    {
      class: 'Boolean',
      name: 'pauseOffscreen',
      documentation: `
        Set by the pauseoffscreen attribute. Wraps the View in a
        VisibilityBorder, so its timers and animations suspend while it is
        scrolled out of the viewport - letting a document carry many live
        components without paying for the ones nobody is looking at.

        Off by default, for backwards compatibility.
      `
    },
    'proxyEl_'
  ],

  methods: [
    function render() {
      var self = this;
      this.add(this.dynamic(function(cls, attrs, pauseOffscreen) {
        cls = foam.maybeLookup(cls);
        if ( cls ) {
          // The View is started inside the Border so that it is created in the
          // Border's sub-Context, which is where the decorated timers live.
          var parent = pauseOffscreen ? this.start(self.VisibilityBorder) : this;
          parent.start(cls, attrs, self.proxyEl_$)
        } else {
          this.add('UNKNOWN CLASS:', cls);
        }
      }, this.class$, this.attributes$, this.pauseOffscreen$));
    },
    function setAttribute(key, value) {
      if ( key === 'class' ) { this.class = value; return; }
      if ( key === 'pauseoffscreen' ) {
        // Present-and-not-"false" enables it, per HTML boolean attribute convention.
        this.pauseOffscreen =
          value == null || String(value).trim().toLowerCase() !== 'false';
        return;
      }
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
