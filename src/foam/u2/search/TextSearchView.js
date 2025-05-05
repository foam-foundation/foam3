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

  requires: [
    'foam.comics.SearchMode',
    'foam.parse.QueryParser',
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
      class: 'Boolean',
      name: 'richSearch',
      value: true
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
      class: 'Boolean',
      name: 'checkStrictEquality',
      documentation: `
        Set this flag if you want to match by strict equality instead of
        checking if the text contains the string. Doing so should improve
        performance.
      `
    },
    {
      name: 'queryParser',
      factory: function() {
        return this.QueryParser.create({ of: this.of });
      }
    },
    {
      class: 'Int',
      name: 'width',
      value: 60
    },
    'property',
    {
      name: 'predicate',
      factory: function() { return this.TRUE; }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'viewSpec',
      value: { class: 'foam.u2.SearchField' }
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
      name: 'onKey'
    },
    {
      class: 'String',
      name: 'searchData'
    }
  ],

  methods: [
    function render() {
      this
        .addClass(this.myClass())
        .start(this.viewSpec, {
          alwaysFloatLabel: true,
          label$: this.label$,
          ariaLabel$: this.label$,
          onKey: this.onKey,
          mode$: this.mode$
        }, this.view$)
          .attrs({ name: this.name$ })
        .end();
      this.view.data$.sub(this.updateValue);

      if ( this.searchData ) {
        this.view.data = this.searchData;
      }

      this.updateValue();
    },

    function clear() {
      this.view.data = '';
      this.predicate = this.TRUE;
    }
  ],

  listeners: [
    {
      name: 'updateValue',
      isMerged: true,
      mergeDelay: 500,
      code: function() {
        var value = this.searchData = this.view.data;
        if ( ! value ) {
          this.predicate = this.True.create();
          return;
        }
        // TODO: dont think we ever use anything other than richSearch, maybe remove the boolean and only perform richSearch
        if ( this.richSearch ) {
          if ( this.searchMode === this.SearchMode.FULL ) {
            this.predicate = this.OR(
              this.queryParser.parseString(value) || this.FALSE,
              this.KEYWORD(value)
            );
          } else if ( this.searchMode === this.SearchMode.MQL ) {
            this.predicate = this.queryParser.parseString(value) || this.FALSE;
          } else {
            this.predicate = this.KEYWORD(value);
          }
        } else if ( this.checkStrictEquality) {
          this.predicate = this.EQ(this.property, value);
        } else if ( this.searchMode === this.SearchMode.SIMPLE ) {
          this.predicate = this.CONTAINS_IC(this.property, value);
        } else {
          this.predicate = this.False.create();
        }
      }
    }
  ]
});
