/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyListView',
  extends: 'foam.u2.Controller',

  css: `
    ^ { display: inline-flex; width: 100% }
  `,

  properties: [
    'of',
    {
      class: 'String',
      name: 'data',
      width: '40',
      placeholder: '*'
    },
    {
      name: 'choice',
      view: function(_, X) {
        if ( ! X.data.of ) return; // Maybe throw an error here? 
        // Unsure what error is best to throw. Gotta look into it.

        let arr = X.data.of.getAxiomsByClass(foam.lang.Property)
          .filter(p => p.showInPropertyChoice);

        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          idProperty: 'name',
          of: foam.lang.Property,
          sections: [
            {
              heading: 'Properties',
              dao: foam.dao.ArrayDAO.create({ array: arr }, X)
            }
          ]
        }
      },
      preSet: function(o, n) {
        if ( n == '*' ) {
          this.data = this.data || '';
        } else {
          if ( this.data ) this.data += ',';
          this.data += n;
        }
        return n;
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this.addClass();
      this.add(function(of) {
        this.tag(self.DATA, { type: 'search' }).add(' ', self.CHOICE);
      });
    }
  ]
});
