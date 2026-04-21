/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.doc',
  name: 'AxiomTableView',
  extends: 'foam.u2.table.TableView',

  requires: [
    'foam.doc.ClassLink'
  ],

  css: `
    ^ { border-collapse: collapse; height: auto; }
    ^ th { text-align: left; }
    ^ td { vertical-align: top; }
  `,

  properties: [
    {
      name: 'editColumnsEnabled',
      value: false
    },
    {
      name: 'disableUserSelection',
      value: true
    }
  ],

  methods: [
    function addAxiomClass(e, a) {
      if ( a.cls_ == foam.lang.FObjectProperty ) {
        e.tag(this.ClassLink, { data: a.of });
      } else if ( a.cls_ == foam.lang.FObjectArray ) {
        e.tag(this.ClassLink, { data: a.of }).add('[]');
      } else {
        e.add(a.cls_.name);
      }
    },

    function render() {
      let self = this;

      this.addClass(this.myClass());
      this.start('table').
        attr('cellpadding', '8').
        start('tr').
          start('th').attrs({width: '250px'}).add('Class').end().
          start('th').add('Name').end().
          start('th').add('Label').end().
          start('th').add('Description').end().
        end().
        select(this.data, function(a) {
          this.start('tr').
            start('td').call(function() { self.addAxiomClass(this, a.axiom); }).end().
            start('td').add(a.name).end().
            start('td').add(a.label).end().
            start('td').style({overflow: 'hidden', 'text-wrap':'pretty'}).add(a.documentation).end()
          .end();
        }).
      end();
    }
  ]
});
