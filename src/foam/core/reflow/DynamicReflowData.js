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
  `,

  properties: [
    {
      class: 'String',
      name: 'filterSearch',
      onKey: true,
      placeholder: 'Search...'
    },
    {
      name: 'selectedTab',
      value: 'collections'
    },
    {
      name: 'tabs',
      value: [
        { name: 'collections', label: 'Collections' },
        { name : 'flows', label: 'Flows' }
      ]
    },
    {
      name: 'collections',
      value: []
    },
    {
      name: 'flows',
      value: []
    }
  ],

  methods: [
    async function render() {
      var self = this;
      const collectionsSink = await this.cSpecDAO.where(this.CSpec.DAOS).select();

      const flowsSink = await this.flowDAO.select();
      this.collections = collectionsSink.array;
      this.flows = flowsSink.array;

      this.addClass()
        .start().addClass(this.myClass('container'))
          .tag(this.FILTER_SEARCH, { data$: this.filterSearch$ })
          .add(this.dynamic(function(selectedTab, filterSearch, collections, flows) {
            this.start(self.UnderlinedTabs).addClass(self.myClass('tabs'))
              .forEach(self.tabs, function(tab) {
                this.start(self.Tab, {
                  label: tab.label,
                  selected: tab.name === selectedTab
                })
                  .start()
                    .callIf(tab.name === 'collections', function() {
                      var search = (filterSearch || '').toLowerCase();
                      var filtered = collections.filter(c =>
                      !search || (c.name && c.name.toLowerCase().includes(search))
                      );
                    // console.log('filtered', filtered);
                      this.start().addClass(self.myClass('collection-list'))
                        .forEach(filtered, function(collection) {
                          this.start(self.CommandItemView, { data: self.data, command: 'dao("'+collection.name+'")', description: collection.name });
                        })
                      .end();
                    })
                    .callIf(tab.name === 'flows', function() {
                      var search = (filterSearch || '').toLowerCase();
                      var filtered = flows.filter(f =>
                        !search || (f.name && f.name.toLowerCase().includes(search))
                      );
                      this.start().addClass(self.myClass('collection-list'))
                        .forEach(filtered, function(flow) {
                          this.start(self.CommandItemView, { data: self.data, command: 'load '+flow.name, description: flow.name });
                        })
                      .end();
                    })
                  .end()
              })
              .end()
          }))
        .end();
    }
  ],

});
