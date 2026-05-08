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
  package: 'foam.u2.search',
  name: 'TextSearchView',
  extends: 'foam.u2.View',

  documentation: `Configurable Search text field input which creates a Predicate bound to the 'predicate' Property.`,

  requires: [
    'foam.comics.SearchMode',
    'foam.parse.QueryRouter',
    'foam.u2.tag.Input'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'config?'
  ],

  messages: [
    { name: 'LABEL_SEARCH', message: 'Search' }
  ],

  properties: [
    {
      class: 'Class',
      name: 'of'
    },
    {
      class: 'Enum',
      of: 'foam.comics.SearchMode',
      name: 'searchMode',
      factory: function() {
        return this.config?.searchMode ?? foam.comics.SearchMode.FULL;
      }
    },
    {
      name: 'queryParser',
      factory: function() {
        return this.QueryRouter.create({of: this.of, searchMode: this.searchMode});
      }
    },
    {
      class: 'Int',
      name: 'width',
      value: 80
    },
    'property',
    {
      name: 'predicate',
      factory: function() { return this.TRUE; }
    },
    {
      name: 'view'
    },
    {
      name: 'label',
      expression: function(property) {
        return property && property.label ? property.label : this.LABEL_SEARCH;
      }
    },
    {
      // All search views (in the SearchManager) need a name.
      // This defaults to 'textSearchView'.
      name: 'name',
      value: 'textSearchView'
    },
    {
      class: 'Boolean',
      name: 'onKey',
      expression: function(property) {
        return property && property.onKey !== undefined ? property.onKey : false;
      }
    },
    {
      class: 'String',
      name: 'data'
    }
  ],

  methods: [
    function init() {
      // If data is pre-populated (e.g., from URL memento), parse it immediately
      // Don't wait for the 500ms debounced updateValue listener
      if ( this.data ) {
        this.predicate = this.queryParser.parseString(this.data) || this.TRUE;
      }
    },

    function render() {
      var self = this;
      this.__subContext__.register(foam.u2.SearchField, 'foam.u2.TextField');

      let viewSpec = {
        class: 'foam.parse.auto.SmartView',
        parser: this.queryParser
      };

      this
        .addClass(this.myClass())
        .start(viewSpec, {
          label$:      this.label$,
          ariaLabel$:  this.label$,
          onKey:       this.onKey,
          mode$:       this.mode$,
          placeholder: 'Search...'
        }, this.view$)
        .call(function() {
          return self.property && this.fromProperty?.(self.property);
        })
          .attrs({ name: this.name$ })
        .end();

      this.view.data$.sub(this.updateValue);

      this.view.data$.follow(this.data$);

      this.updateValue();
    },

    function clear() {
      this.view.data = '';
      this.predicate = this.TRUE;
    }
  ],

  listeners: [
    {
      // Even if onKey: true, we don't want to update on each character change
      // because it could be expensive to re-evaluate the predicate and re-perform
      // a new dao.select()
      name: 'updateValue',
      isIdled: true,
      delay: 500,
      code: function() {
        var value = this.data = this.view.data;

        this.predicate = value ?
          this.queryParser.parseString(value) :
          this.True.create() ;
      }
    }
  ]
});
