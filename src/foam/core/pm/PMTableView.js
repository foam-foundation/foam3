/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.pm',
  name: 'PMTableView',
  extends: 'foam.u2.table.TableView',

  documentation: 'TableView for displaying PMInfos.',

  implements: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.core.pm.PMInfo', 'foam.u2.table.TableView' ],

  exports: [ 'maxTotalTime', 'as tableView' ],

  css: `
    << { overflow: auto; }
    <<container{
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `,

  properties: [
    {
      class: 'Long',
      name: 'maxTotalTime'
    },
    {
      name: 'contextMenuActions',
      factory: function() {
        return [ this.CLEAR ];
      }
    }
  ],

  methods: [
    function render() {
      this.addClass(this.myClass('container'));
      // this.columns.push([this.CLEAR, null]);
      this.onDetach(this.stack.setTrailingContainer(this.E().tag(this.CLEAR_ALL)));
      this.SUPER();

      this.updateMax();
      this.onDetach(this.data.listen({reset: this.updateMax, put: this.updateMax}));
    }
  ],

  actions: [
    {
      name: 'clear',
      code: function(X) {
        X.pmInfoDAO.remove(this);
        // This shouldn't be necessary, the DAO update should already cause
        // a refresh
        X.tableView.updateValues = ! X.tableView.updateValues;
      },
      tableWidth: 80
    },
    {
      name: 'clearAll',
      code: function(X) {
        X.pmInfoDAO.removeAll();
        this.updateValues = ! this.updateValues;
      }
    }
  ],

  listeners: [
    {
      name: 'updateMax',
      isFramed: true,
      code: function() {
        var self = this;
        this.data.select(this.MAX(this.PMInfo.TOTAL_TIME)).then(function(max) {
          self.maxTotalTime = max.value;
        });
      }
    }
  ]
 });
