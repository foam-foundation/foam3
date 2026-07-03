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
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    ^ > div {
      display: flex;
      width: 100%;
      flex-direction: column;
      gap: 5px;
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
      class: 'StringArray',
      name: 'disabledTypes'
    },
    {
      name: 'choice',
      postSet: function(o, n) {
        if ( ! this.feedback_ ) this.data = undefined;
      },
      view: function(_, X) {
        var E = foam.mlang.Expressions.create();
        var dao = X.agentDAO;

        if ( X.data.sinksOnly ) dao = dao.where(E.EQ(foam.core.reflow.SinkAgent.SINK, true));
        var sections = [ 'format', 'structure', 'calculation', 'chart' ]
          .filter(type => ! X.data.disabledTypes?.includes(type.toLowerCase()))
          .map(type => {
            return {
              heading: foam.String.capitalize(type),
              dao: dao.where(E.EQ(foam.core.reflow.SinkAgent.TYPE, type.toLowerCase()))
            };
          });

        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          idProperty: 'value',
          sections: sections
        }
      }
    },
    {
      name: 'data',
      expression: function(choice) {
        if ( ! choice ) return null;
        if ( choice instanceof Promise ) {
          return choice.then(value => {
            if ( ! value ) return null;
            var cls = foam.lookup(value);
            return cls ? cls.create({}, this) : null;
          });
        }
        var cls = foam.lookup(choice);
        return cls ? cls.create({}, this) : null;
      },
      postSet: async function(o, n) {
        /* ignoreWarning */
        if ( ! n ) return;
        await this.agentDAO.select().then(agents => {
          const results = agents.array;
          for ( var i = 0 ; i < results.length ; i++ ) {
            if ( results[i].value == n.cls_.id ) {
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
      return this.cls_.package + '.' + choice;
    },

    async function render() {
      var self = this;

      if ( ! this.choice ) {
        await this.agentDAO.limit(1).select().then(agents => {
          const entities = agents.array;
          this.choice = entities[0]?.value;
        });
      }

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

          if ( ! data ) return;

          if ( data instanceof Promise ) {
            data.then(d => d.addToE(this));
          } else {
            if ( ! data.addToE ) debugger;
            data.addToE(this);
          }
        }));
    }
  ]
});
