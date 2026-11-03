/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'DAOtoFObjectArrayView',
  extends: 'foam.u2.Controller',

  documentation: 'Adapt a DAOView for use with viewing an FObjectArray',

  requires: [
    'foam.u2.stack.Stack',
    'foam.dao.ArrayDAO'
  ],

  css: `
    << .foam-u2-stack-StackView {
      height: auto;
    }
  `,

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'daoView',
      factory: function() { return foam.u2.view.EmbeddedTableView; }
    },
    {
      name: 'dao',
      factory: function() {
        return this.ArrayDAO.create({of: this.of, array$: this.data$});
      }
    },
    'of',
  ],

  methods: [
    function fromProperty(p) {
      this.of = p.of;
    },
    function render() {
      var self = this;

      this.SUPER();

      this.addClass();

      this.start(this.daoView, { data: this.dao }).end();
    }
  ]
});
