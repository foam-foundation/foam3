/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.doc',
  name: 'AxiomListView',
  extends: 'foam.u2.View',

  requires: [
    'foam.doc.Axiom',
    'foam.doc.AxiomLink',
    'foam.doc.dao.AxiomDAO',
    'foam.mlang.sink.Count',
  ],

  implements: [
    'foam.mlang.Expressions',
  ],

  css: `
    ^ h4 {
      margin-bottom: 4px;
    }
    ^ .commaseparated span:after {
      content: ", ";
    }
    ^ .commaseparated span:last-child:after {
      content: "";
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'modelId'
    },
    {
      class: 'Class',
      name: 'of',
      value: 'foam.doc.Axiom'
    },
    {
      name: 'axiomDAO',
      expression: function(modelId) {
        return this.AxiomDAO.create({ modelIds: [modelId] })
      }
    },
    {
      name: 'titleFn'
    }
  ],

  methods: [
    function render() {
      this.SUPER();

      this.addClass(this.myClass());

      var of        = this.of;
      var titleFn   = this.titleFn;
      var titleTag  = this.titleTag;
      var modelId   = this.modelId;
      var AxiomLink = this.AxiomLink;

      var dao = this.axiomDAO.where(
        this.AND(
          this.INSTANCE_OF(of),
          this.EQ(this.Axiom.HAS_PERMISSION, true),
          this.EQ(this.Axiom.PARENT_ID, modelId)));

      dao.select(this.COUNT()).then(c => {
        if ( ! c.value ) return;

        if ( titleFn ) titleFn.call(this);

        this.start('code').
          addClass('commaseparated').
          select(dao.orderBy(this.Axiom.NAME), function(a) {
            return this.E('span').tag(AxiomLink, { cls: modelId, axiomName: a.name });
          }).
        end();
      });
    }
  ]
});
