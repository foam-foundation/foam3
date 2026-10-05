/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'DashboardCitationView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.memento.Memorable'],

  axioms: [
    foam.pattern.Faceted.create()
  ],

  requires: [
    'foam.comics.v2.DAOControllerConfig'
  ],

  imports: [
    'stack'
  ],

  exports: [
    'as rowView'
  ],

  properties: [
    {
      class: 'Class',
      name: 'of'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .on('click', function() {
          self.openFilteredListView(self);
        })
        .addClass(this.myClass())
        .start()
          .addClass('p-light')
          .add(this.data['id'])
        .end()
        .start()
          .addClass('p-legal')
          .add(this.data['value'])
        .end()
    },

    function openFilteredListView(obj) {
      var dao = this.__subContext__[obj.data && obj.data.listDAOName || obj.dao].where(this.EQ(obj.searchKey, obj.id));
      var config = this.DAOControllerConfig.create({ dao: dao, hideQueryBar: false });
      this.stack.push({
        class: 'foam.comics.v2.DAOBrowserView',
        config: config
      });
    }
  ],

  css: `
    << {
      display: flex;
      justify-content: space-between;
      padding-top: 15px;
      padding-bottom: 15px;
      gap: 8px;
    }

    <<id {
      color: $textTertiary;
    }
  `
});
