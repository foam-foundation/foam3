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
    ^ { font-family: system-ui, sans-serif; max-width: 1200px; }
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
      var questions = this.questions;
      var outcomes = this.outcomes;
      var model = cls.model_;
      let questionNames = { reasonCode_: true, reasonText: true, notice: true, reactions_: true }; // TODO: filter

      this.questions.forEach(q => questionNames[q.name] = true);

      var properties = cls.getOwnAxiomsByClass(foam.lang.Property).filter(p => { return ! questionNames[p.name]; });

      properties.sort((a, b) => foam.String.compare(a.name, b.name));
      questions.sort((a, b) => foam.String.compare(a.name, b.name));
      // TODO: reasonCode_ shouldn't be hard-coded
      outcomes.sort((a, b) => foam.String.compare(a.reasonCode_, b.reasonCode_));

      function addOutcomeList(name) {
        this.start('b').add('Outcomes: ').end();

        var list = outcomes.
            map((o,i) => [o, i+1]).
            filter(o => o[0].predicate.indexOf(name) != -1).
            map(o => o[1]).
            join(', ');

        if ( list ) {
          this.add(list);
        } else {
          this.start('span').style({color: 'red'}).add('UNUSED');
        }
      }

      this
        .addClass(this.myClass())
        .start('h1').add(model.name, ' Questionnaire').end()
        .start('p').add(model.documentation || '').end()

        // Hidden Properties
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Hidden Properties').end()
            .start('table').addClass(self.myClass('table'))
              .start('tr')
                .start('th').add('Property').end()
                .start('th').add('Description').end()
              .end()
              .forEach(properties, function(q) {
                try {
                this.start('tr')
                  .start('td').start('code').add(q.name).end().end()
                  .start('td')
                  .callIf(q.description, function() { this.add(q.description).tag('br'); })
                  .call(function() { addOutcomeList.call(this, q.name); })
                } catch (x) {}
              })
            .end()
        .end()

        // Questions Table
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Questions').end()
            .start('table').addClass(self.myClass('table'))
              .start('tr')
                .start('th').add('Property').end()
                .start('th').add('Priority').end()
                .start('th').add('Prompt').end()
              .end()
              .forEach(questions, function(q) {
                try {
                this.start('tr')
                  .start('td').start('code').add(q.name).end().end()
                  .start('td').add(q.priority || 100).end()
                  .start('td')
                  .add(q.prompt || '-').tag('br')
                  .callIf(
                    q.choices.length,
                    function() { this.start('b').add('Choices: ').end().add(q.choices.map(c => foam.Array.isInstance(c) ? c[1] : c).join(', ')); }
                  )
                  .tag('br')
                  .call(function() { addOutcomeList.call(this, q.name); })
                } catch (x) {}
              })
            .end()
        .end()

        // Outcomes Table
        .start('div').addClass(this.myClass('section'))
          .start('h2').add('Outcomes').end()
            this.start('table').addClass(self.myClass('table'))
              .start('tr')
                .start('th').add('#').end()
                .start('th').add('Reason Code').end()
                .start('th').add('Reason Text').end()
                .start('th').add('Predicate').end()
              .end()
              .forEach(outcomes, function(o, i) {
                this.start('tr')
                  .start('td').add(i+1).end()
                  .start('td').start('code').add(o.reasonCode_ || '-').end().end()
                  .start('td').add(o.reasonText || '-').end()
                  .start('td').addClass(self.myClass('predicate')).add(self.formatPredicate(o.predicate)).end()
                .end();
              })
            .end()
        .end().br();
    },

    function formatPredicate(pred) {
      if ( ! pred ) return '-';
      if ( pred.toString ) return pred.toString();
      return String(pred);
    }
  ]
});
