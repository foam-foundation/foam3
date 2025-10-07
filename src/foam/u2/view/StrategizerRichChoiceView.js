/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'StrategizerRichChoiceView',
  extends: 'foam.u2.view.RichChoiceView',

  documentations: 'A rich choice view that gets its choices array from Strategizer.',

  imports: [
    'strategizer'
  ],

  requires: [
    'foam.mlang.LabeledValue',
    'foam.dao.MDAO'
  ],

  properties: [
    {
      class: 'String',
      name: 'desiredModelId',
      required: true
    },
    {
      class: 'String',
      name: 'target'
    },
    {
      name: 'search',
      value: true
    },
    {
      name: 'sections',
      factory: function() {
        return [
          {
            dao: this.MDAO.create({
              of: "foam.mlang.LabeledValue"
            }),
            searchBy: [
              foam.mlang.LabeledValue.LABEL
            ]
          }
        ];
      }
    },
    {
      name: 'choosePlaceholder',
      expression: function(desiredModelId) {
        let cls = foam.maybeLookup(desiredModelId);
        return this.CHOOSE_FROM + ' ' + cls.model_.plural + '...';
      }
    }
  ],

  methods: [
    async function init() {
      this.SUPER();
      var self = this;
      const strategyReferences = await self.strategizer.query(null, self.desiredModelId, self.target);
      const choices = strategyReferences
        .reduce((arr, sr) => {
          if ( ! sr.strategy ) {
            console.warn('Invalid strategy reference: ' + sr.id);
            return arr;
          }
          let value = self.LabeledValue.create(
          {
            label: sr.label || sr.strategy.name,
            id: sr.strategy
          });
          return arr.concat(value);
        }, [])
        .filter(x => x);
      self.sections[0].dao = await self.MDAO.create({
        of: 'foam.mlang.LabeledValue',
      }, self);
      choices.map(s => self.sections[0].dao.put(s));

      self.propertyChange.pub('sections', self.sections$);
      self.onDataUpdate();
    }
  ]
})
