/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'SinkView',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.reflow.SinkAgent'
  ],

  imports: [ 'agentDAO' ],

  exports: [ 'dao' ],

  css: `
    ^ {
      display: inline-flex;
    }
  `,

  properties: [
    { name: 'dao', factory: function() { return this.__context__.dao; } },
    {
      name: 'agentType',
      value: undefined
    },
    {
      class: 'Boolean',
      name: 'sinksOnly',
      value: true
    },
    {
      name: 'choice',
      factory: function() {
        return this.agentDAO.select().then((agents) => {
          const entities = agents.array;
          return entities[0]?.value;
        });
      },
      postSet: function(o, n) {
        if ( ! this.feedback_ ) this.data = undefined;
      },
      view: function(_, X) {
        var E = foam.mlang.Expressions.create();
        var dao = X.agentDAO;

        if ( X.data.sinksOnly ) dao = dao.where(E.EQ(foam.core.reflow.SinkAgent.SINK, true));

        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          idProperty: 'value',
          sections: [
            {
              heading: 'Format',
              dao: dao.where(E.EQ(foam.core.reflow.SinkAgent.TYPE, 'format'))
            },
            {
              heading: 'Structure',
              dao: dao.where(E.EQ(foam.core.reflow.SinkAgent.TYPE, 'structure'))
            },
            {
              heading: 'Calculations',
              dao: dao.where(E.EQ(foam.core.reflow.SinkAgent.TYPE, 'calculation'))
            },
          ]
        }
      }
    },
    {
      name: 'data',
      expression: function(choice) {
        if ( ! choice ) return undefined;
        if ( choice instanceof Promise ) {
          return choice.then(value => {
            if ( ! value ) return undefined;
            var cls = foam.lookup(this.choiceToClass(value));
            return cls ? cls.create({}, this) : undefined;
          });
        }
        var cls = foam.lookup(this.choiceToClass(choice));
        return cls ? cls.create({}, this) : undefined;
      },
      postSet: async function(o, n) {
        if ( ! n ) return;
        await this.agentDAO.select().then(agents => {
          const results = agents.array;
          for ( var i = 0 ; i < results.length ; i++ ) {
            if ( this.choiceToClass(results[i].value) == n.cls_.id ) {
              this.feedback_ = true;
              this.choice = results[i].value;
              this.feedback_ = false;
              return;
            }
          }
        });
      }
    }
  ],

  methods: [
    function choiceToClass(choice) {
      return this.cls_.package + '.' + choice + 'DAOAgent';
    },

    function render() {
      var self = this;

      if ( ! this.data ) { this.data = undefined; }

      this.
        addClass().add(' ').
        add(self.dynamic(function (data, dao) {
          if ( ! dao ) {
            this.start('i').add('select data source');
            return;
          }
          this.startContext({data: self}).
            add(self.CHOICE).
          endContext();

          if ( data instanceof Promise ) {
            data.then(d => d.addToE(this));
          } else {
            data.addToE(this);
          }
        }));
    }
  ]
});
