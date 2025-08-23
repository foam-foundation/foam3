/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOCreate',
  extends: 'foam.u2.Controller',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.u2.DetailView'
  ],

  css: `
  `,

  properties: [
    {
      class: 'String',
      name: 'daoKey',
      adapt: function(o, n) {
        if ( this.__context__[n] ) return n;
        if ( this.__context__[n + 'DAO'] ) return n + 'DAO';
        if ( n.endsWith('s') ) return n.substring(0, n.length-1) + 'DAO';
        return n;
      }
    },
    {
      name: 'dao',
      factory: function() {
        return this.__context__[this.daoKey];
      }
    },
    {
      name: 'of',
      factory: function() { return this.dao.of; }
    },
    {
      name: 'data',
      factory: function() { return this.of.create({}, this); }
    }
  ],

  methods: [
    async function render() {
      this.SUPER();

      this.addClass();

      this.tag(this.DetailView, { data: this.data });
      this.add(this.SAVE, ' ', this.RESET);
    }
  ],

  actions: [
    {
      name: 'save',
      code: async function() {
        // TODO: error handling
        this.dao.put(this.data).then(o => {
          this.data.copyFrom(o);
        });
      }
    },
    function reset() {
      this.of.getAxiomsByClass(foam.lang.Property).forEach(p => {
        this.data.clearProperty(p.name);
      });
    }
  ]
});
