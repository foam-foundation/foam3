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

  exports: ['as wizard'],

  requires: [
    'foam.u2.ProgressView',
    'foam.u2.qa.RankedOutcome',
    'foam.u2.qa.QAOutcomeLog',
    'foam.log.LogLevel',
    'foam.dao.MDAO',
    'foam.u2.qa.WizardState'
  ],

  imports: ['qaOutcomeLogDAO?'],

  messages: [
    { name: 'NO_CANDIDATES', message: 'No candidates eligible. Please check your answers or manually enter an outcome.' },
    { name: 'MATCHES', message: 'Matches' },
    { name: 'POTENTIAL_MATCHES', message: 'Potential Matches, need more information' }
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
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
      class: 'Boolean',
      name: 'currentAnswerValid_',
      value: true,
      documentation: `True when the current question has no validateObj error. Next
        is gated on this so a question-level validator blocks advancing, not just
        renders a message.`
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
    {
      class: 'foam.u2.ViewSpec',
      name: 'outcomeView',
      documentation: `View for the OUTCOME step. Receives the questionnaire as data. When
        unset, the default TabularSectionView of the OUTPUT_NAMES properties is rendered.
        A questionnaire that computes its outcome asynchronously can supply a view that
        shows a loading state and renders the result reactively.`
    },
    'valueSub_',
    'validSub_'
  ],

  methods: [
    function init() {
      this.SUPER();
      var self = this;

      // Keep currentAnswerFilled in sync with whatever question is currently shown.
      // When the question changes, tear down the old subscription and create a new one.
      this.dynamic(function(currentAnswerName_) {
        if ( self.valueSub_ ) { self.valueSub_.detach(); self.valueSub_ = null; }
        if ( self.validSub_ ) { self.validSub_.detach(); self.validSub_ = null; }
        var name  = self.currentAnswerName_;
        var axiom = self.currentQuestionAxiom;
        if ( name && self.data ) {
          var slot = self.data$.dot(name);
          self.valueSub_ = self.currentAnswerFilled$.follow(slot.map(function(v) {
            return !!v;
          }));
          // Track the current question's validateObj result so Next can block on it.
          // data.slot(validateObj) is the same per-property error slot Section uses.
          if ( axiom && axiom.validateObj ) {
            self.validSub_ = self.currentAnswerValid_$.follow(
              self.data.slot(axiom.validateObj).map(function(err) { return ! err; }));
          } else {
            self.currentAnswerValid_ = true;
          }
        } else {
          self.currentAnswerFilled = false;
          self.currentAnswerValid_ = true;
        }
      });

      this.onDetach(function() {
        if ( self.valueSub_ ) self.valueSub_.detach();
        if ( self.validSub_ ) self.validSub_.detach();
      });

      if ( this.data ) {
        this.totalOutcomes = this.data.getProgress()[1];
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
        // this.phase = 'PICK';
        // Auto-pick: highest MATCHING first, then highest SCORE, then first
        var ranked = this.data.rankOutcomes(candidates);
        ranked.sort(function(a, b) {
          if ( b.matching !== a.matching ) return b.matching - a.matching;
          return b.score - a.score;
        });

        // ERROR if top 2 are tied on both matching and score (ambiguous); WARN otherwise
        var tied = ranked.length > 1 &&
                   ranked[0].matching === ranked[1].matching &&
                   ranked[0].score    === ranked[1].score;
        if ( this.qaOutcomeLogDAO ) {
          this.qaOutcomeLogDAO.put(this.QAOutcomeLog.create({
            questionnaire:  this.data,
            rankedOutcomes: ranked,
            logLevel:       tied ? this.LogLevel.ERROR : this.LogLevel.WARN
          }));
        }

        if ( ranked.length > 0 ) this.data.applyOutcome(ranked[0].outcome);
        this.candidatesCount = ranked.length > 0 ? 1 : 0;
        this.phase = 'OUTCOME';
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
            // Custom outcomeView owns the end step — suppress the framework label too.
            if ( phase == 'OUTCOME' && self.outcomeView ) return null;
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
                .add(self.NO_CANDIDATES)
              .end();
            this.startContext({ controllerMode: foam.u2.ControllerMode.VIEW });
            if ( self.outcomeView ) {
              // Caller-supplied end-step view (e.g. async/loading or richer rendering).
              this.tag(self.outcomeView, { data$: self.data$ });
            } else {
              var outputProps = self.getOutputProperties_();
              this.tag({
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
              });
            }
            this.endContext();
          } else if ( phase == 'PICK' ) {
            var candidates = self.data.getCandidates();
            var ranked     = self.data.rankOutcomes(candidates);
            ranked.map(function(o) {
              self.rankedOutcomeDAO.put(o);
            });
            this.startContext({ data: self })
              .tag(self.PICKED_OUTCOME_INDEX.__, { config: {
                label: '',
                view:  {
                  class: 'foam.u2.view.RichChoiceView',
                  choosePlaceholder: '---',
                  sections: [
                    {
                      heading: self.MATCHES,
                      dao$: self.rankedOutcomeDAO$.map(v => v.where(self.NEQ(self.RankedOutcome.SCORE, 0)).orderBy(self.DESC(self.RankedOutcome.MATCHING), self.DESC(self.RankedOutcome.SCORE)))
                    },
                    {
                      heading: self.POTENTIAL_MATCHES,
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
      isEnabled: function(data$answeredOrder) {
        return data$answeredOrder.length > 0;
      },
      code: function() {
        var last = this.data.answeredOrder[this.data.answeredOrder.length - 1];
        let oldValue = last.f(this.data);
        this.data.answeredOrder        = this.data.answeredOrder.slice(0, -1);
        this.currentQuestionAxiom.set(this.data, undefined);
        // Unset answer to get correct count again
        this.data[last.name]      = undefined;
        this.currentQuestionAxiom = last;
        this.candidatesCount      = this.data.getProgress()[0];
        this.data[last.name]      = oldValue;
        this.phase                = 'QUESTION';
      }
    },
    {
      name: 'next',
      buttonStyle: 'PRIMARY',
      size: 'MEDIUM',
      isEnabled: function(phase, currentAnswerFilled, currentAnswerValid_, pickedOutcomeIndex) {
        if ( phase == 'QUESTION'  ) return currentAnswerFilled && currentAnswerValid_;
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
        // $push didnt work here, idk why
        this.data.answeredOrder = [...this.data.answeredOrder, this.currentQuestionAxiom];
        return await this.advance_();
      }
    }
  ]
});

foam.ENUM({
  package: 'foam.u2.qa',
  name: 'WizardState',
  messages: [
    { name: 'QUESTION_MSG', message: 'Question' },
    { name: 'PICK_MSG', message: 'Select Best Match' },
    { name: 'REMAINING', message: '${candidatesCount} of ${totalOutcomes} options remaining', template: true },
    { name: 'PICK_ONE', message: '${candidatesCount} options — pick one', template: true },
    { name: 'MATCH_FOUND', message: 'Match found!' },
    { name: 'ALL_DONE', message: 'All done!' },
    { name: 'NO_MATCH_FOUND', message: 'No match found' },
    { name: 'MANUALLY_SELECT', message: 'Multiple options match your answers. Please select the best fit or check your answers:' }
  ],
  properties: [
    { class: 'Function', name: 'labelFormatter' },
    { class: 'Function', name: 'headingFormatter' },
    { class: 'Function', name: 'subHeadingFormatter' }
  ],
  values: [
    {
      name: 'QUESTION',
      headingFormatter: function(self) {
        return self.currentQuestionAxiom?.label || this.QUESTION_MSG;
      },
      subHeadingFormatter: function(self) {
        return '';
      },
      labelFormatter: function(candidatesCount, totalOutcomes) {
        return null;
        // return this.REMAINING({ candidatesCount, totalOutcomes });
      }
    },
    {
      name: 'PICK',
      headingFormatter: function() {
        return this.PICK_MSG;
      },
      subHeadingFormatter: function() {
        return this.MANUALLY_SELECT;
      },
      labelFormatter: function(candidatesCount, totalOutcomes) {
        return this.PICK_ONE({ candidatesCount });
      }
    },
    {
      name: 'OUTCOME',
      labelFormatter: function() { return this.MATCH_FOUND; },
      headingFormatter: function(self) {
        // A custom outcomeView owns the whole end step — no framework heading.
        if ( self.outcomeView ) return '';
        return self.candidatesCount ? this.ALL_DONE : this.NO_MATCH_FOUND;
      },
      subHeadingFormatter: function(self) {
        return '';
      },
    }
  ]
});
