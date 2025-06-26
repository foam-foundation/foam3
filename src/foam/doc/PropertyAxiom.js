/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.doc',
  name: 'PropertyAxiom',
  extends: 'foam.doc.Axiom',

  requires: [
    'foam.doc.AxiomLink',
  ],

  tableColumns: ['type', 'label', 'name'],

  properties: [
    {
      name: 'name',
      projectionSafe: false,
      tableCellFormatter: function(_, o) {
        this.
          start('code').
            start(o.AxiomLink, { cls: o.parentId, axiomName: o.axiom.name }).
            end().
          end().
          start('div').
            addClass('foam-doc-AxiomTableView-documentation').
            add(o.axiom.documentation).
          end()
      }
    },
    {
      class: 'String',
      name: 'label',
      expression: function(axiom) { return axiom.label },
      tableCellFormatter: function(v) {
        this.start('code').add(v).end();
      }
    },
    {
      class: 'String',
      name: 'type',
      expression: function(axiom) { return axiom.model_.name },
      tableCellFormatter: function(v) {
        this.start('code').add(v).end();
      }
    }
  ]
})
