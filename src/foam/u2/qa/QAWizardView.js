/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'QAWizardView',
  extends: 'foam.u2.View',

  documentation: `
    A self-contained wizard view for any foam.QA2() decision-matrix instance.
    Asks questions one at a time in optimal information-gain order, tracks a
    back-navigation stack, narrows the candidate set, and presents the outcome.
    Fully agnostic to the QA class — works with any compiled foam.QA2() model.
  `,

  requires: [
    'foam.u2.ProgressView',
    'foam.u2.qa.RankedOutcome',
    'foam.dao.MDAO',
    'foam.u2.qa.WizardState',
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      height: 100%;
      background: $backgroundDefault;
    }
    ^header {
      padding: 0px 24px 16px;
      border-bottom: 1px solid $borderLight;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    ^candidate-count {
      color: $textSecondary;
    }
    ^content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    ^footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      align-items: center;
      padding: 16px 24px;
      border-top: 1px solid $borderLight;
      background: $backgroundDefault;
    }
    ^pick-hint {
      color: $textTertiary;
    }
  `,

  properties: [
    {
      name: 'rankedOutcomeDAO',
      class: 'foam.dao.DAOProperty',
      factory: function() {
        return this.MDAO.create({of: this.RankedOutcome});
      }
    },
    {
      name: 'data',
      documentation: 'The QA instance'
    },
    {
      class: 'Array',
      name: 'answeredStack',
      documentation: 'Back-navigation stack; each entry is an <axiom>',
      factory: function() { return []; }
    },
    {
      class: 'Enum',
      of: 'foam.u2.qa.WizardState',
      name: 'phase',
      factory: function() { return this.WizardState.QUESTION; }
    },
    {
      name: 'currentQuestionAxiom',
      documentation: 'The property axiom currently being shown'
    },
    {
      class: 'String',
      name: 'currentAnswerName_',
      expression: function(currentQuestionAxiom) { return currentQuestionAxiom?.name ?? ''; },
      documentation: 'Internal: property name of current question, drives reactivity subscription'
    },
    {
      class: 'Boolean',
      name: 'currentAnswerFilled',
      documentation: 'True when the current question property has a non-empty value'
    },
    {
      class: 'Int',
      name: 'candidatesCount',
      documentation: 'Current number of remaining candidate outcomes'
    },
    {
      class: 'Int',
      name: 'totalOutcomes',
      documentation: 'Total outcome count'
    },
    {
      class: 'String',
      name: 'pickedOutcomeIndex',
      documentation: 'String index into ranked candidates for the picking phase'
    },
    {
      class: 'Function',
      name: 'onComplete',
      documentation: 'Optional callback invoked with (data) when the wizard finishes'
    },
    'valueSub_'
  ],

  methods: [
    function init() {
      this.SUPER();
      var self = this;

      // Keep currentAnswerFilled in sync with whatever question is currently shown.
      // When the question changes, tear down the old subscription and create a new one.
      this.dynamic(function(currentAnswerName_) {
        if ( self.valueSub_ ) { self.valueSub_.detach(); self.valueSub_ = null; }
        var name = self.currentAnswerName_;
        if ( name && self.data ) {
          var slot = self.data$.dot(name);
          self.valueSub_ = self.currentAnswerFilled$.follow(slot.map(function(v) {
            return !!v;
          }));
        } else {
          self.currentAnswerFilled = false;
        }
      });

      this.onDetach(function() {
        if ( self.valueSub_ ) self.valueSub_.detach();
      });

      if ( this.data ) {
        this.totalOutcomes = this.data.OUTCOMES.length;
        this.advance_();
      }
    },

    async function advance_() {
      var candidates = this.data.getCandidates();
      this.candidatesCount = candidates.length;

      if ( candidates.length <= 1 ) {
        if ( candidates.length === 1 ) this.data.applyOutcome(candidates[0]);
        this.phase = 'OUTCOME';
        return;
      }

      var nextAxiom = this.data.selectNextQuestion();
      if ( ! nextAxiom ) {
        await this.rankedOutcomeDAO.removeAll();
        this.phase = 'PICK';
        return;
      }

      this.currentQuestionAxiom = nextAxiom;
      this.phase                = 'QUESTION';
    },

    function getOutputProperties_() {
      var outcomeKeys = this.data.OUTPUT_NAMES;
      return this.data.cls_.getAxiomsByClass(foam.lang.Property).filter(function(p) {
        return outcomeKeys.includes(p.name);
      });
    },

    function render() {
      var self = this;
      this.SUPER();
      this.addClass(this.myClass());
      this.start().addClass(this.myClass('header'))
        .start('span').addClass(this.myClass('candidate-count'))
          .add(this.slot(function(phase, candidatesCount, totalOutcomes) {
            return phase.labelFormatter(candidatesCount, totalOutcomes);
          }))
        .end()
        .start(this.ProgressView, {
          data$: this.slot(function(candidatesCount, totalOutcomes) { return totalOutcomes - (candidatesCount - 1); }),
          max$: this.totalOutcomes$
        })
      .end();

      this.start().addClass(this.myClass('content'))
        .add(this.dynamic(function(phase, currentQuestionAxiom) {
          this
          .start().addClass('h500').add(phase.headingFormatter(self)).end()
          .start()
            .addClass(self.myClass('pick-hint'), 'p-legal')
            .add(phase.subHeadingFormatter(self))
          .end()
          if ( phase == 'QUESTION' && currentQuestionAxiom ) {
            this.tag(currentQuestionAxiom.__, { config: { label: '' } });
          } else if ( phase == 'OUTCOME' ) {
            if ( self.candidatesCount === 0 )
              return this.start()
                .addClass('p')
                .add('No candidates eligible. Please check your answers or manually enter an outcome.')
              .end();
            var outputProps = self.getOutputProperties_();
            this.startContext({ controllerMode: foam.u2.ControllerMode.VIEW })
            .tag({
              class: 'foam.u2.detail.VerticalDetailView',
              of: self.data.cls_,
              data$: self.data$,
              sections: [
                {
                  name: 'info_output_',
                  title: '',
                  view: { class: 'foam.u2.detail.TabularSectionView' },
                  properties: outputProps.map(p => p.name),
                }
              ]
            })
            .endContext();
          } else if ( phase == 'PICK' ) {
            var candidates = self.data.getCandidates();
            var ranked     = self.data.rankOutcomes(candidates);
            ranked.map(function(o) {
              let label = self.data.outcomeFormatter(o[0]) || ('Option ' + (idx + 1));
              if ( o[1] != 0 ) {
                label += ' (' + o[1].toFixed(2) + '% match)';
              }
              self.rankedOutcomeDAO.put(self.RankedOutcome.create({
                label: label,
                outcome: o[0],
                score: o[1]
              }));
            });
            this.startContext({ data: self })
              .tag(self.PICKED_OUTCOME_INDEX.__, { config: {
                label: '',
                view:  {
                  class: 'foam.u2.view.RichChoiceView',
                  choosePlaceholder: '---',
                  sections: [
                    {
                      heading: 'Matches',
                      dao$: self.rankedOutcomeDAO$.map(v => v.where(self.NEQ(self.RankedOutcome.SCORE, 0)))
                    },
                    {
                      heading: 'Potential Matches, need more information',
                      dao$: self.rankedOutcomeDAO$.map(v => v.where(self.EQ(self.RankedOutcome.SCORE, 0)))
                    }
                  ]
                }
              }})
            .endContext();
          }
        }))
      .end();

      this.start().addClass(this.myClass('footer'))
        .startContext({ data: this })
          .tag(this.BACK)
          .tag(this.NEXT, { label$: this.slot(function(phase) {
            if ( phase == 'PICK' ) return 'Confirm';
            if ( phase == 'OUTCOME' ) return 'Done';
            return 'Next';
          }) })
        .endContext()
      .end();
    }

  ],

  actions: [
    {
      name: 'back',
      size: 'MEDIUM',
      isAvailable: function(phase) {
        return phase != 'OUTCOME';
      },
      isEnabled: function(answeredStack) {
        return answeredStack.length > 0;
      },
      code: function() {
        var last = this.answeredStack[this.answeredStack.length - 1];
        let oldValue = last.f(this.data);
        this.answeredStack        = this.answeredStack.slice(0, -1);
        this.currentQuestionAxiom.set(this.data, undefined);
        // Unset answer to get correct count again
        this.data[last.name]      = undefined;
        this.currentQuestionAxiom = last;
        this.candidatesCount      = this.data.getCandidates().length;
        this.data[last.name]      = oldValue;
        this.phase                = 'QUESTION';
      }
    },
    {
      name: 'next',
      buttonStyle: 'PRIMARY',
      size: 'MEDIUM',
      isEnabled: function(phase, currentAnswerFilled, pickedOutcomeIndex) {
        if ( phase == 'QUESTION'  ) return currentAnswerFilled;
        if ( phase == 'PICK' ) return !! pickedOutcomeIndex || pickedOutcomeIndex === '0';
        return true;
      },
      code: async function() {
        if ( this.phase == 'OUTCOME' ) {
          return await this.onComplete?.(this.data);
        }

        if ( this.phase == 'PICK' ) {
          let outcome = await this.rankedOutcomeDAO.find(this.pickedOutcomeIndex);
          if ( outcome ) {
            this.data.applyOutcome(outcome.outcome);
            this.candidatesCount = 1;
            this.phase           = 'OUTCOME';
            return outcome;
          } else {
            console.error('something went wrong');
          }
        }

        this.answeredStack$push(this.currentQuestionAxiom);
        return await this.advance_();
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'RankedOutcome',
  ids: ['label'],
  properties: [
    {
      name: 'label',
      class: 'String'
    },
    {
      name: 'outcome'
    },
    {
      name: 'score',
      class: 'Float'
    }
  ]
});

foam.ENUM({
  package: 'foam.u2.qa',
  name: 'WizardState',
  properties: [
    { class: 'Function', name: 'labelFormatter' },
    { class: 'Function', name: 'headingFormatter' },
    { class: 'Function', name: 'subHeadingFormatter' }
  ],
  values: [
    {
      name: 'QUESTION',
      headingFormatter: function(self) {
        return self.currentQuestionAxiom?.label || 'Question';
      },
      subHeadingFormatter: function(self) {
        return '';
      },
      labelFormatter: function(candidatesCount, totalOutcomes) {
        return candidatesCount + ' of ' + totalOutcomes + ' options remaining';
      }
    },
    {
      name: 'PICK',
      headingFormatter: function() {
        return 'Select Best Match';
      },
      subHeadingFormatter: function() {
        return 'Multiple options match your answers. Please select the best fit or check your answers:';
      },
      labelFormatter: function(candidatesCount, totalOutcomes) {
        return candidatesCount + ' options — pick one';
      }
    },
    {
      name: 'OUTCOME',
      labelFormatter: function() { return 'Match found'; },
      headingFormatter: function(self) {
        return self.candidatesCount ? 'All Done!' : 'No Match Found';
      },
      subHeadingFormatter: function(self) {
        return '';
      },
    }
  ]
});
