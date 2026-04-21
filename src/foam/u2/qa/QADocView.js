/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'QADocView',
  extends: 'foam.u2.View',

  css: `
    ^ { font-family: system-ui, sans-serif; max-width: 1000px; }
    ^section { margin: 24px 0; }
    ^table { border-collapse: collapse; width: 100%; }
    ^table th, ^table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    ^table th { background: #f5f5f5; }
    ^code { font-family: monospace; font-size: 13px; background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    ^predicate { font-family: monospace; font-size: 12px; white-space: pre-wrap; max-width: 500px; }
  `,

  properties: [
    {
      class: 'Class',
      name: 'data',
      attribute: true,
      adapt: function(o, n) {
        if ( foam.String.isInstance(n) ) n = foam.lookup(n);
        return n;
      }
    },
    {
      name: 'obj',
      expression: function(data) {
        if ( ! data ) return null;
        return data.create({}, this.__subContext__);
      }
    },
    {
      name: 'questions',
      expression: function(obj) {
        if ( ! obj || ! obj.QUESTIONS ) return [];
        return obj.QUESTIONS;
      }
    },
    {
      name: 'outcomes',
      expression: function(obj) {
        if ( ! obj || ! obj.OUTCOMES ) return [];
        return obj.OUTCOMES.map(v => {
          obj.ensureCompiled(v);
          return v;
        });
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      var cls  = this.data;
      if ( ! cls ) return;

      var model = cls.model_;

      this.addClass(this.myClass())
        .start('h1').add(model.name, ' Questionnaire').end()
        .start('p').add(model.documentation || '').end()

        // Questions Table
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Questions').end()
          .add(self.dynamic(function(questions) {
            this.start('table').addClass(self.myClass('table'))
              .start('tr')
                .start('th').add('Property').end()
                .start('th').add('Prompt').end()
              .end()
              .forEach(questions, function(q) {
                this.start('tr')
                  .start('td').start('code').add(q.name).end().end()
                  .start('td')
                  .add(q.prompt || '-').tag('br')
                  .callIf(
                    q.choices.length,
                    function() { this.start('b').add('Choices: ').end().add(q.choices.map(c => foam.Array.isInstance(c) ? c[1] : c).join(', ')); }
                  )
                .end();
              })
            .end();
          }))
        .end()

        // Outcomes Table
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Outcomes').end()
          .add(self.dynamic(function(outcomes) {
            this.start('table').addClass(self.myClass('table'))
              .start('tr')
                .start('th').add('Reason Code').end()
                .start('th').add('Reason Text').end()
                .start('th').add('Predicate').end()
              .end()
              .forEach(outcomes, function(o) {
                this.start('tr')
                  .start('td').start('code').add(o.reasonCode_ || '-').end().end()
                  .start('td').add(o.reasonText || '-').end()
                  .start('td').addClass(self.myClass('predicate')).add(self.formatPredicate(o.predicate)).end()
                .end();
              })
            .end();
          }))
        .end();
    },

    function formatPredicate(pred) {
      if ( ! pred ) return '-';
      if ( pred.toString ) return pred.toString();
      return String(pred);
    }
  ]
});
