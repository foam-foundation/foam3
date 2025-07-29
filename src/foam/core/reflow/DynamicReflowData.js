/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DynamicReflowData',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.UnderlinedTabs',
    'foam.u2.Tab',
    'foam.core.boot.CSpec',
    'foam.core.reflow.CommandItemView'
  ],

  imports: [
    'AuthenticatedCSpecDAO as cSpecDAO',
    'flowDAO'
  ],

  css: `
    ^container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    ^collection-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 200px;
      overflow-y: auto;
      padding-top: 10px;
    }
    ^header {
      font-size: 14px;
      font-weight: 600;
      border-bottom: 1px solid $borderLight;
      padding-bottom: 5px;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'filterSearch',
      onKey: true,
      placeholder: 'Search...'
    },
    {
      name: 'header',
      value: 'Collections'
    },
    {
      name: 'dataType',
      value: 'collections'
    },
    {
      name: 'collections',
      value: []
    },
  ],

  methods: [
    async function render() {
      var self = this;
      if ( this.dataType == 'collections' ) {
        const collectionsSink = await this.cSpecDAO.where(this.CSpec.DAOS).select();
        this.collections = collectionsSink.array;
      } else if ( this.dataType == 'flows' ) {
        const flowsSink = await this.flowDAO.select();
        this.collections = flowsSink.array;
      } else {
        this.collections = [];
      }

      this.addClass()
        .start().addClass(this.myClass('container'))
          .start().addClass(this.myClass('header'))
            .add(this.header)
          .end()
          .tag(this.FILTER_SEARCH, { data$: this.filterSearch$ })
          .add(this.dynamic(function(filterSearch, collections) {
            var search = (filterSearch || '').toLowerCase();
            var filtered = collections.filter(c =>
              !search || (c.name && c.name.toLowerCase().includes(search))
            );
            this.start().addClass(self.myClass('collection-list'))
              .forEach(filtered, function(collection) {
                if ( self.dataType == 'collections' ) {
                  this.start(self.CommandItemView, { data: self.data, command: 'dao '+collection.name, description: collection.name });
                } else if ( self.dataType == 'flows' ) {
                  this.start(self.CommandItemView, { data: self.data, command: 'load '+collection.name, description: collection.name });
                }
              })
            .end();
          }))
        .end();
    }
  ],

});