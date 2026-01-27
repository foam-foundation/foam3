/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
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
  package: 'foam.u2.stack',
  name: 'StackView',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.controller.Memento',
    'foam.u2.stack.Stack'
  ],

  imports: [ 'document', 'routeTo' ],

  exports: [ 'data as stack' ],

  properties: [
    {
      name: 'data',
      factory: function() { return this.Stack.create(); }
    },
    {
      class: 'Boolean',
      name: 'showActions',
      value: true
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'stackDefault',
      documentation: 'Default view for the stack, rendered when the stack is empty'
    },
    'defaultView_'
  ],

  css: `
    ^pos > * {
      height: 100%;
    }
  `,

  methods: [
    // TODO: Why is this init() instead of render()? Investigate and maybe fix.
    function init() {
      this.addClass();
      this.addClass('foam-u2-stack-StackView')
        .enableClass(this.myClass('pos'), this.data.pos$.map(v => v < 0));

      if ( this.showActions ) {
        this.start('actions')
          .add(this.data.cls_.getAxiomsByClass(foam.lang.Action))
        .end();
      }
      this.maybeAddDefault();
      this.data.pos$.sub(() => {
        if ( this.data.pos >= 0 && this.defaultView_) {
          this.defaultView_.remove();
          return;
        }
        this.maybeAddDefault();
      });

      this.listenStackView();
      if ( this.data.top ) {
        this.renderStackView(this.data.top);
      }
    },

    function maybeAddDefault() {
      if ( this.data.pos < 0 && this.stackDefault) {
        this.tag(this.stackDefault, {}, this.defaultView_$);
      }
    },

    // Overwritten in DesktopStackView
    function listenStackView() {
      let self = this;
      this.add(this.dynamic(function(data$top) { this.add(self.renderStackView(data$top)) }));
    },

    function renderStackView(s, opt_popup) {
      if ( ! s ) return this.E('span');

      if ( s.seen && s.currentMemento ) {
        this.routeTo(s.currentMemento);
        // return this.E('span').add('Loading... ', s.currentMemento, ' from ', window.location.hash.substring(1));
      }
      s.seen = true;

      var view  = s.view;
      var X     = opt_popup ? opt_popup.__subContext__ : this.data.getContextFromParent(s.parent, this);
      var v     = foam.u2.ViewSpec.createView(view, null, this, X);
      var title = v.viewTitle$ || v.children[0]?.viewTitle$; /* need to do this for menu with border */

      if ( title ) {
        if ( title.get() ) this.document.title = title.get();
        this.data.top.breadcrumbTitle$.follow(title); // TODO: GC issue
      } else if ( s.breadcrumbTitle ) {
        this.document.title = s.breadcrumbTitle;
      }

      return v;
    }
  ]
});
