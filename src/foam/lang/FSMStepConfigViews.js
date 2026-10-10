/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * General-purpose FSM Step Wizard View System
 * Automatically reads step configuration from FSM properties
 */

// ============================================
// 1. FSM Step Indicator (the step circles/badges)
// ============================================
foam.CLASS({
  package: 'foam.lang',
  name: 'FSMStepIndicator',
  extends: 'foam.u2.View',

  documentation: 'Renders a single step indicator (circle with number/checkmark)',

  requires: [
    'foam.u2.tag.Image'
  ],

  css: `
    << {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 4px;
      border: 1px solid $borderDefault;
      background: $backgroundDefault;
      transition: all 0.2s ease;
      white-space: nowrap;
      flex: 1 1 0;
      min-width: 0;
    }
    <<:hover:not(.disabled) {
      border-color: $borderBrand;
    }
    <<.active {
      border-color: $borderBrand;
      background: $backgroundBrandTertiary;
    }
    <<.completed {
      border-color: $borderBrand;
    }
    <<.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    <<circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: $font-semi-bold;
      font-size: $body-md;
      flex-shrink: 0;
    }
    <<circle.pending {
      background: $backgroundSecondary;
      color: $textTertiary;
      border: 2px solid $borderDefault;
    }
    <<circle.active {
      background: $backgroundBrand;
      color: $textOnBrand;
    }
    <<circle.completed {
      background: $backgroundBrand;
      color: $textOnBrand;
    }
    <<icon svg {
      display: block;
      height: 18px;
      width: 18px;
    }
    <<content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    <<step-label {
      font-size: 11px;
      color: $textTertiary;
      text-transform: uppercase;
    }
    <<step-title {
      font-size: $body-md;
      font-weight: $font-medium;
      color: $textSecondary;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    @media (max-width: 1100px) {
      << {
        gap: 6px;
        padding: 10px 12px;
      }
      <<circle {
        width: 28px;
        height: 28px;
        font-size: $body-sm;
      }
      <<step-label {
        font-size: 10px;
      }
      <<step-title {
        font-size: $body-sm;
      }
    }
    @media (max-width: 720px) {
      << {
        justify-content: center;
        padding: 8px;
      }
      <<content {
        display: none;
      }
      <<circle {
        width: 26px;
        height: 26px;
      }
    }
  `,

  properties: [
    { class: 'Int', name: 'stepIndex' },
    { class: 'String', name: 'title' },
    { class: 'String', name: 'icon' },
    { class: 'Boolean', name: 'isActive' },
    { class: 'Boolean', name: 'isCompleted' },
    { class: 'Boolean', name: 'isDisabled' }
  ],

  methods: [
    function render() {
      var self = this;

      this
        .addClass(this.myClass())
        .enableClass('active', this.isActive$)
        .enableClass('completed', this.isCompleted$)
        .enableClass('disabled', this.isDisabled$)
        .attrs({
          title: this.slot(function(stepIndex, title) {
            return 'Step ' + (stepIndex + 1) + ': ' + (title || '');
          })
        })
        .start('div')
          .addClass(this.myClass('circle'))
          .enableClass('active', this.isActive$)
          .enableClass('completed', this.isCompleted$)
          .enableClass('pending', this.slot(function(isActive, isCompleted) {
            return !isActive && !isCompleted;
          }))
          .add(this.dynamic(function(isCompleted, stepIndex, icon) {
            var iconPath = isCompleted ? '/images/checkmark-white.svg' : icon;
            if ( iconPath ) {
              this
                .start(self.Image, {
                  data: iconPath,
                  embedSVG: true,
                  role: 'presentation'
                })
                  .addClass(self.myClass('icon'))
                .end();
              return;
            }
            this.add(stepIndex + 1);
          }))
        .end()
        .start('div').addClass(this.myClass('content'))
          .start('span').addClass(this.myClass('step-label'))
            .add('Step ' + (this.stepIndex + 1))
          .end()
          .start('span').addClass(this.myClass('step-title'))
            .add(this.title$)
          .end()
        .end();
    }
  ]
});


// ============================================
// 2. FSM Step Header (the row of all step indicators)
// ============================================
foam.CLASS({
  package: 'foam.lang',
  name: 'FSMStepHeader',
  extends: 'foam.u2.View',

  documentation: 'Renders the horizontal step indicator header',

  css: `
    << {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 16px 24px;
      background: $backgroundSecondary;
      border-bottom: 1px solid $borderDefault;
      overflow: hidden;
      flex-wrap: nowrap;
      min-width: 0;
    }
    <<connector {
      flex: 0 1 32px;
      width: auto;
      min-width: 8px;
      max-width: 32px;
      height: 2px;
      background: $borderDefault;
    }
    <<connector.completed {
      background: $backgroundBrand;
    }
    @media (max-width: 1100px) {
      << {
        gap: 6px;
        padding: 12px 16px;
      }
      <<connector {
        flex-basis: 20px;
        max-width: 20px;
      }
    }
    @media (max-width: 720px) {
      << {
        gap: 4px;
        padding: 10px 12px;
      }
      <<connector {
        flex-basis: 10px;
        min-width: 4px;
        max-width: 10px;
      }
    }
  `,

  properties: [
    {
      class: 'Array',
      name: 'steps',
      documentation: 'Array of FSM values that are wizard steps'
    },
    {
      class: 'Int',
      name: 'currentStepIndex'
    },
    {
      class: 'Int',
      name: 'highestCompletedIndex',
      value: -1
    },
    {
      class: 'Function',
      name: 'onStepClick'
    }
  ],

  methods: [
    function resolveStepIcon_(fsmValue) {
      return fsmValue.stepIcon || '';
    },

    function render() {
      var self = this;
      var onClick = function(selectedIndex) {
        if ( selectedIndex <= self.highestCompletedIndex + 1 && self.onStepClick ) {
          self.onStepClick(selectedIndex);
        }
      };

      this.addClass(this.myClass());

      this.steps.forEach(function(fsmValue, index) {
        if ( index > 0 ) {
          self.start('div')
            .addClass(self.myClass('connector'))
            .enableClass('completed', self.slot(function(highestCompletedIndex) {
              return index <= highestCompletedIndex;
            }))
          .end();
        }

        self
          .start()
            // Disable on click until transitionTo is fixed
            // .on('click', onClick.bind(null, index))
            .tag({
              class: 'foam.lang.FSMStepIndicator',
              stepIndex: index,
              title: fsmValue.stepTitle || fsmValue.label,
              icon: self.resolveStepIcon_(fsmValue),
              isActive$: self.slot(function(currentStepIndex) {
                return currentStepIndex === index;
              }),
              isCompleted$: self.slot(function(highestCompletedIndex) {
                return index < highestCompletedIndex ||
                       (index <= highestCompletedIndex && self.currentStepIndex > index);
              }),
              isDisabled$: self.slot(function(highestCompletedIndex) {
                return index > highestCompletedIndex + 1;
              })
            })
          .end();
      });
    }
  ]
});


// ============================================
// 3. FSM Step Content View (renders fields for current step)
// ============================================
foam.CLASS({
  package: 'foam.lang',
  name: 'FSMStepContentView',
  extends: 'foam.u2.View',

  documentation: `
    Renders the content/fields for the current step based on FSM value config.
    Uses FOAM's built-in DetailView to handle visibility, gridColumns, etc.
  `,

  imports: [
    'fsmStepWizardView?',
    'translationService?'
  ],

  exports: ['fsmValue'],

  css: `
    <<section-title {
      font-size: 20px;
      font-weight: $font-semi-bold;
      color: $textDefault;
      margin-bottom: 8px;
    }
    <<section-description {
      font-size: $body-md;
      color: $textTertiary;
      margin-bottom: 24px;
    }
    <<detail-container {
      padding: 0;
    }
  `,

  properties: [
    {
      name: 'data',
      documentation: 'The model instance being edited'
    },
    {
      name: 'fsmValue',
      documentation: 'The FSM value (state) for current step'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'detailView',
      documentation: 'The detail view to use for rendering properties',
      factory: function() {
        return { class: 'foam.u2.detail.VerticalDetailView', hideActions: true };
      }
    }
  ],

  methods: [
    function localizeStepText_(key, value) {
      if ( ! value ) return value;

      return this.translationService && this.fsmValue
        ? this.translationService.getTranslation(
          foam.locale,
          this.fsmValue.cls_.id + '.' + this.fsmValue.name + '.' + key,
          value
        )
        : value;
    },

    function render() {
      var self = this;
      this.addClass(this.myClass());

      if ( ! this.fsmValue ) return;

      this.start('div').addClass(this.myClass('section-title'))
        .add(this.localizeStepText_('stepTitle', this.fsmValue.stepTitle ?? this.fsmValue.label))
      .end();

      if ( this.fsmValue.stepDescription ) {
        this.start('div').addClass(this.myClass('section-description'))
          .add(this.localizeStepText_('stepDescription', this.fsmValue.stepDescription))
        .end();
      }

      if ( this.fsmValue.view ) {
        var stepView = foam.u2.ViewSpec.createView(this.fsmValue.view, {
          data$: this.data$,
          of: this.data?.cls_
        }, this, this.__subContext__, true);
        if ( this.fsmStepWizardView ) {
          this.fsmStepWizardView.activeStepView = stepView;
        }
        this.add(stepView);
        return;
      }

      var detailView = foam.u2.ViewSpec.createView(this.detailView, {
        data$: this.data$
      }, this, this.__subContext__, true);
      if ( this.fsmStepWizardView ) {
        this.fsmStepWizardView.activeStepView = detailView;
      }
      this.start('div').addClass(this.myClass('detail-container'))
        .add(detailView)
      .end();
    }
  ]
});

foam.ENUM({
  package: 'foam.lang',
  name: 'FSMWizardType',
  properties: [
    {
      class: 'Function',
      name: 'getDataSlot',
      documentation: 'returns the appropriate view data slot from the parent data obj slot'
    }
  ],
  values: [
    {
      name: 'DEFAULT',
      documentation: 'Data passed to wizard views is the parent object that stores the fsm',
      getDataSlot: function(data$, fsmPropName) {
        return data$
      }
    },
    {
      name: 'PAYLOAD',
      documentation: `
        Data passed to wizard views is the payload object for the current state (Useful for questionaires).
        Also hands off the state transition to the new state to the server using the onUpdate hook on the
        FSM rather than trying to attempt a state transition to the next state
      `,
      getDataSlot: function(data$, fsmPropName) {
        return data$.dot(fsmPropName+'Payload')
      }
    }
  ]
});


// ============================================
// 4. Main FSM Step Wizard View
// ============================================
foam.CLASS({
  package: 'foam.lang',
  name: 'FSMStepWizardView',
  extends: 'foam.u2.Controller',

  documentation: `
    Main wizard view that reads step configuration directly from FSM properties.
    The view syncs with the FSM state on the data object - state machine is the source of truth.
  `,

  imports: [
    'notify',
    'stack',
    'translationService',
  ],

  exports: [
    'wizardType',
    'fsmPropertyName',
    'as fsmStepWizardView'
  ],

  requires: [
    'foam.log.LogLevel'
  ],

  css: `
    << {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: $backgroundDefault;
      border-radius: 8px;
    }
    <<content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }
    <<content-card {
      background: $backgroundDefault;
    }
    <<footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-top: 1px solid $borderDefault;
      background: $backgroundSecondary;
    }
    <<step-counter {
      font-size: $body-md;
      color: $textTertiary;
    }
    <<nav-buttons {
      display: flex;
      gap: 12px;
    }
    <<errors {
      align-items: center;
      background: $destructive50;
      border: 1px solid $destructive200;
      border-left: 4px solid $textDestructive;
      border-radius: 6px;
      box-shadow: none;
      color: $textDefault;
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      padding: 12px 16px;
    }
    <<errors::before {
      align-items: center;
      background: $textDestructive;
      border-radius: 999px;
      color: $white;
      content: '!';
      display: inline-flex;
      flex: 0 0 20px;
      font-size: 13px;
      font-weight: $font-bold;
      height: 20px;
      justify-content: center;
      line-height: 1;
      width: 20px;
    }
    <<errors > div {
      color: $textDefault;
      line-height: 1.4;
    }
  `,

  messages: [
    {
      name: 'NEXT_MSG',
      messageMap: {
        en: 'Next',
        fr: 'Suivant'
      }
    },
    {
      name: 'SUBMIT_MSG',
      messageMap: {
        en: 'Submit',
        fr: 'Soumettre'
      }
    }
  ],

  properties: [
    {
      name: 'data',
      documentation: 'The model instance being created/edited',
      factory: function() {
        return this.of ? this.of.create({}, this) : null;
      }
    },
    {
      class: 'Class',
      name: 'of',
      documentation: 'The model class'
    },
    {
      class: 'String',
      name: 'fsmPropertyName',
      documentation: 'Name of the FSM/StateMachine property on the model'
    },
    {
      class: 'Class',
      name: 'fsmClass',
      documentation: 'The FSM enum class - can be passed directly or auto-resolved',
      factory: function() {
        if ( this.of && this.fsmPropertyName ) {
          var prop = this.of.getAxiomByName(this.fsmPropertyName);
          if ( prop && prop.of ) {
            try {
              return foam.lookup(prop.of);
            } catch (e) {
              console.error('Failed to lookup FSM class:', prop.of, e);
            }
          }
        }
      }
    },
    {
      class: 'String',
      name: 'daoKey',
      documentation: 'DAO key in context.',
      postSet: function(oldKey, newKey) {
        if ( newKey && newKey !== oldKey ) {
          this.dao = newKey;
        }
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      documentation: 'DAO for persisting changes. If not set, will attempt to get DAO from context using daoKey.'
    },
    {
      class: 'Array',
      name: 'wizardSteps',
      documentation: 'FSM values that are wizard steps - auto-built from fsmClass'
    },
    {
      class: 'Int',
      name: 'currentStepIndex',
      documentation: 'Actual FSM step index derived from persisted state',
      expression: function(data, fsmPropertyName, wizardSteps) {
        if ( ! data || ! fsmPropertyName || ! wizardSteps || ! wizardSteps.length ) return 0;

        var currentState = data[fsmPropertyName];
        if ( ! currentState ) return 0;

        var index = wizardSteps.findIndex(function(step) {
          return step.name === currentState.name;
        });
        if ( index >= 0 ) return index;

        // State isn't itself a wizard step (e.g. AWAITING_RESPONSE has isWizardStep: false).
        // If it sits past the last wizard step in ordinal order, clamp to the last step
        // so the wizard shows everything completed instead of resetting to step 0.
        var lastStep = wizardSteps[wizardSteps.length - 1];
        if ( lastStep && typeof currentState.ordinal === 'number' &&
             typeof lastStep.ordinal === 'number' && currentState.ordinal > lastStep.ordinal ) {
          return wizardSteps.length - 1;
        }
        return 0;
      }
    },
    {
      class: 'Int',
      name: 'highestCompletedIndex',
      documentation: 'Derived from currentStepIndex',
      expression: function(currentStepIndex, isPastWizard, wizardSteps) {
        if ( isPastWizard ) return wizardSteps.length - 1;
        return currentStepIndex > 0 ? currentStepIndex - 1 : -1;
      }
    },
    {
      class: 'Boolean',
      name: 'isPastWizard',
      documentation: 'True when the FSM state has progressed beyond the last wizard step (e.g. AWAITING_RESPONSE).',
      expression: function(data, fsmPropertyName, wizardSteps) {
        if ( ! data || ! fsmPropertyName || ! wizardSteps || ! wizardSteps.length ) return false;
        var currentState = data[fsmPropertyName];
        if ( ! currentState ) return false;
        var lastStep = wizardSteps[wizardSteps.length - 1];
        return !! ( lastStep && typeof currentState.ordinal === 'number' &&
          typeof lastStep.ordinal === 'number' && currentState.ordinal > lastStep.ordinal );
      }
    },
    {
      class: 'Array',
      name: 'validationErrors'
    },
    {
      class: 'Boolean',
      name: 'isLoading',
      value: false
    },
    {
      class: 'Function',
      name: 'onComplete',
      documentation: 'Callback when wizard is completed'
    },
    {
      class: 'Function',
      name: 'onCancel',
      documentation: 'Callback when wizard is cancelled'
    },
    {
      class: 'Enum',
      of: 'foam.lang.FSMWizardType',
      name: 'wizardType'
    },
    {
      class: 'FObjectProperty',
      name: 'viewData'
    },
    {
      class: 'FObjectProperty',
      name: 'activeStepView'
    },
    {
      class: 'Boolean',
      name: 'showCancel',
      documentation: 'When true, a Cancel button is rendered in the wizard footer.'
    },
    {
      class: 'Boolean',
      name: 'lockInitialStep',
      documentation: `Set by the caller when step 0 must stay off-limits. While set, the
        Previous button refuses to cross back into step 0, so the wizard can't be walked
        back into its initial step and re-run that step's onEnter/onExit side effects.
        Steps past the first stay reachable. Left false, the wizard navigates freely.`
    }
  ],

  methods: [
    async function init() {
      let self = this
      this.SUPER();
      this.resolveWizardSteps();
      this.dynamic(function(wizardType, fsmPropertyName) {
        this.viewData$.follow(wizardType.getDataSlot(self.data$, fsmPropertyName));
      });
    },

    function resolveWizardSteps() {
      if ( this.wizardSteps && this.wizardSteps.length > 0 ) return;

      if ( ! this.fsmClass?.VALUES ) return this.wizardSteps = [];

      let steps = this.fsmClass.VALUES.filter(function(v) {
        return v.isWizardStep !== false;
      });

      let stepMap = {};
      steps.forEach(function(s) { stepMap[s.name] = s; });
      let initial = steps.find(function(s) { return s.isInitial; }) || steps[0];

      if ( ! initial ) {
        this.wizardSteps = [];
        return;
      }

      // Walk the transition chain from the initial step.
      let ordered = [];
      let visited = {};
      let current = initial;

      while ( current && ! visited[current.name] ) {
        ordered.push(current);
        visited[current.name] = true;

        // Find the first transition that points to another wizard step.
        var next = null;
        if ( current.transitions ) {
          for ( var i = 0; i < current.transitions.length; i++ ) {
            var candidate = stepMap[current.transitions[i]];
            if ( candidate && ! visited[candidate.name] ) {
              next = candidate;
              break;
            }
          }
        }
        current = next;
      }

      // Append any wizard steps not reachable via transitions (preserve original order).
      steps.forEach(function(s) {
        if ( ! visited[s.name] ) ordered.push(s);
      });

      this.wizardSteps = ordered;
    },

    function render() {
      var self = this;

      this.addClass(this.myClass());

      // Step header
      if ( this.wizardType == 'DEFAULT' )
        this.tag({
          class: 'foam.lang.FSMStepHeader',
          steps$: this.wizardSteps$,
          currentStepIndex$: this.currentStepIndex$,
          highestCompletedIndex$: this.currentStepIndex$,
          onStepClick: this.goToStep.bind(this)
        });

      // Content area
      this.start('div').addClass(this.myClass('content'))
        .start('div').addClass(this.myClass('content-card'))
          // Validation errors
          .add(this.slot(function(validationErrors) {
            if ( ! validationErrors || validationErrors.length === 0 ) return null;
            return self.E().addClass(self.myClass('errors'))
              .forEach(validationErrors, function(err) {
                this.start('div').add(err).end();
              });
          }))
          // Step content
          .add(this.dynamic(function(currentStepIndex, wizardSteps) {
            var fsmValue = wizardSteps[currentStepIndex];
            if ( ! fsmValue ) return null;

            this.tag({
              class: 'foam.lang.FSMStepContentView',
              data$: self.viewData$,
              fsmValue: fsmValue
            });
          }))
        .end()
      .end();

      // Footer
      this.start('div').addClass(this.myClass('footer'))
        .start('span').addClass(this.myClass('step-counter'))
          .add(this.slot(function(currentStepIndex, wizardSteps, wizardType) {
            if ( wizardType != 'DEFAULT' ) return null;
            return 'Step ' + (currentStepIndex + 1) + ' of ' + wizardSteps.length;
          }))
        .end()
        .start('div').addClass(this.myClass('nav-buttons'))
          .add(this.dynamic(function(showCancel) {
            if ( showCancel ) this.tag(self.CANCEL);
          }))
          .tag(this.PREVIOUS)
          .tag(this.NEXT, {
            label$: this.slot(function(currentStepIndex, wizardSteps) {
              return currentStepIndex === wizardSteps.length - 1 || this.data?.[this.fsmPropertyName]?.isTerminal ? this.SUBMIT_MSG : this.NEXT_MSG;
            })
          })
        .end()
      .end();
    },

    function getPreviousFSMValue() {
      // Upgrade to call the 'Back' hook on the FSM when available rather than relying on history - this will allow better support for non-linear wizards and edge cases where the user might want to go back multiple steps
      // let history = this.data[this.fsmPropertyName+'History'];
      // if ( history && history.length > 0 ) {
      //   let from = null;
      //   history = history.sort((a, b)=> b.timestamp - a.timestamp);
      //   let i = 0;
      //   while ( ! from && i < history.length ) {
      //     // Find the last transition and return it's from state
      //     let maybeFrom = this.fsmClass.VALUES.find(s => s.name === history[i].from);
      //     if ( maybeFrom && maybeFrom.isWizardStep ) {
      //       from = maybeFrom;
      //     }
      //     i++;
      //   }
      //   return from;
      // } else {
        var prevIndex = this.currentStepIndex - 1;
        return prevIndex >= 0 ? this.wizardSteps[prevIndex] : null;
      // }
    },

    async function transitionTo(targetFsmValue) {
      if ( ! targetFsmValue ) return;
      var dao = this.__subContext__[this.daoKey];
      if ( ! dao ) {
        console.error('DAO not found in context:', this.daoKey);
        return;
      }

      this.isLoading = true;
      this.validationErrors = [];

      var currentStatus = this.data[this.fsmPropertyName];

      try {
        var dataToPut = this.data.clone ? this.data.clone() : this.data;
        var activeStepData = this.activeStepView?.data;
        if ( this.wizardType == 'DEFAULT' &&
             activeStepData &&
             activeStepData.cls_ === dataToPut.cls_ &&
             dataToPut.copyFrom ) {
          dataToPut.copyFrom(activeStepData);
        } else if ( this.wizardType == 'DEFAULT' &&
             this.viewData &&
             this.viewData.cls_ === dataToPut.cls_ &&
             dataToPut.copyFrom ) {
          dataToPut.copyFrom(this.viewData);
        }
        await dataToPut[this.fsmPropertyName].assertCanTransitionTo(targetFsmValue, dataToPut);
        dataToPut[this.fsmPropertyName] = targetFsmValue;
        this.data = await dao.put(dataToPut);

      } catch (e) {
        var errorMessage;
        var subMessage = '';
        var logLevel = this.LogLevel.WARN;
        if ( foam.box.RPCErrorMessage.isInstance(e) )
          e = e.data
        if ( foam.comics.v2.userfeedback.UserFeedbackException.isInstance(e.exception) )
          e = e.exception;
        if ( e && foam.comics.v2.userfeedback.UserFeedbackAware.isInstance(e) && e.userFeedback ) {
          var feedback = e.userFeedback;
          errorMessage = this.translationService.getTranslation(foam.locale, 'foam.comics.v2.userfeedback.UserFeedback.message.'+feedback.message, feedback.message, feedback.messageTemplateMap);
          subMessage = this.translationService.getTranslation(foam.locale, 'foam.comics.v2.userfeedback.UserFeedback.subMessage.'+feedback.subMessage, feedback.subMessage, feedback.messageTemplateMap);
          if ( feedback.status != UserFeedbackStatus.ERROR )
            logLevel = this.LogLevel.INFO;
        } else {
          errorMessage = e.getTranslation?.() ?? e.message ?? e.cls_.name;
        }

        console.error('Transition failed: ', errorMessage, subMessage);
        this.validationErrors = [errorMessage, subMessage];
        this.notify(errorMessage, subMessage, logLevel, true);

        // rollback status on error
        this.data[this.fsmPropertyName] = currentStatus;
      } finally {
        this.isLoading = false;
      }
    },

    async function goToStep(index) {
      if ( index <= this.currentStepIndex ) {
        // Navigate back in UI without DAO call
        this.currentStepIndex = index;
      } else {
        // Navigate forward only up to the current FSM step
        this.currentStepIndex = Math.min(index, this.currentStepIndex);
      }
    },

    async function handleComplete() {
      if ( this.onComplete ) {
        await this.onComplete(this.data);
      }
    },

    async function handleCancel() {
      if ( this.onCancel ) {
        await this.onCancel();
      }
    }
  ],

  actions: [
    {
      name: 'cancel',
      buttonStyle: 'TERTIARY',
      size: 'MEDIUM',
      isAvailable: function(showCancel) {
        return showCancel;
      },
      code: async function() {
        await this.handleCancel();
      }
    },
    {
      name: 'previous',
      size: 'MEDIUM',
      isAvailable: function(wizardType, isPastWizard, currentStepIndex, lockInitialStep) {
        // TODO: Fix for other wizard types
        // When the wizard opened past step 0 (existing record), hide Previous on the
        // first reachable step so it can't return to the locked initial step.
        if ( lockInitialStep && currentStepIndex <= 1 ) return false;
        return wizardType == 'DEFAULT' && ! isPastWizard;
      },
      isEnabled: function(currentStepIndex, isLoading, lockInitialStep) {
        return ! isLoading && currentStepIndex > ( lockInitialStep ? 1 : 0 );
      },
      code: async function() {
        var prevFsmValue = this.getPreviousFSMValue();
        if ( prevFsmValue ) {
          await this.transitionTo(prevFsmValue);
        }
      }
    },
    {
      name: 'next',
      buttonStyle: 'PRIMARY',
      size: 'MEDIUM',
      isAvailable: function(isPastWizard) {
        return ! isPastWizard;
      },
      isEnabled: function(isLoading, viewData$errors_, wizardType) {
        // For default fsm wizards, the data might be populated incrementally which means some props might have errors
        // In this case we have to rely on the server to enforce validation
        return ! isLoading && ( ! viewData$errors_ || wizardType != 'PAYLOAD');
      },
      code: async function() {
        // Next operation is handled in the onUpdate hook of the FSM for better reliability and interoperability with API clients
        if ( this.wizardType == 'DEFAULT' ) {
          // If newly created object, save it first to get an id and inital fsm state before advancing to the next step
          if ( this.wizardSteps[this.currentStepIndex].isInitial && ! this.data.id ) {
            var currentStatus = this.data[this.fsmPropertyName];
            try {
              this.data = await this.dao.put(this.data);
            } catch (e) {
              var errorMessage;
              var subMessage;
              var logLevel = this.LogLevel.WARN;
              if ( foam.box.RPCErrorMessage.isInstance(e) )
                e = e.data
              if ( foam.comics.v2.userfeedback.UserFeedbackException.isInstance(e.exception) )
                e = e.exception;
              if ( e && foam.comics.v2.userfeedback.UserFeedbackAware.isInstance(e) && e.userFeedback ) {
                var currentFeedback = e.userFeedback;
                errorMessage = this.translationService.getTranslation(foam.locale, 'foam.comics.v2.userfeedback.UserFeedback.message.'+currentFeedback.message, currentFeedback.message, currentFeedback.messageTemplateMap);
                subMessage = this.translationService.getTranslation(foam.locale, 'foam.comics.v2.userfeedback.UserFeedback.subMessage.'+currentFeedback.subMessage, currentFeedback.subMessage, currentFeedback.messageTemplateMap);
                if ( feedback.status != UserFeedbackStatus.ERROR )
                  logLevel = this.LogLevel.INFO;
              } else {
                errorMessage = e.getTranslation?.() ?? e.message ?? e.cls_.name;
              }

              console.error('Transition failed: ', errorMessage, subMessage);
              this.validationErrors = [errorMessage, subMessage];
              this.notify(errorMessage, subMessage, logLevel, true);

              // rollback status on error
              this.data[this.fsmPropertyName] = currentStatus;
              return this.data;
            } finally {
              this.isLoading = false;
            }
          }
          var nextIndex = this.currentStepIndex + 1;
          if ( nextIndex < this.wizardSteps.length ) {
            // Advance to the next wizard step via FSM transition
            await this.transitionTo(this.wizardSteps[nextIndex]);
          } else {
            // Last wizard step — transition to the next FSM state beyond the wizard
            var currentFsmValue = this.wizardSteps[this.currentStepIndex];
            if ( currentFsmValue && currentFsmValue.transitions && currentFsmValue.transitions.length > 0 ) {
              var nextStateName = currentFsmValue.transitions[0];
              var nextState = this.fsmClass[nextStateName];
              if ( nextState ) {
                await this.transitionTo(nextState);
              }
            }

            // Wizard is considered completed when the transition succeeds. The
            // landing state may equal nextState, or a server onEnter may auto-advance
            // past it (e.g. AWAITING_RESPONSE -> COMPLETED when linked txns resolve),
            // in which case isPastWizard is true. A failed transition rolls the status
            // back to the wizard step, so neither condition holds and we don't complete.
            if ( ! nextState || this.isPastWizard || nextState == this.data[this.fsmPropertyName] ) {
              await this.handleComplete();
            }
          }
        } else {
          let isLastPut = false
          if ( this.data[this.fsmPropertyName].isTerminal )
            isLastPut = true;
          try {
            this.data = await this.dao.put(this.data);
          } catch (err) {
            let errorMessage = err.data?.exception?.getTranslation() ?? err.message ?? err.cls_.name;
            console.error('Error saving data: ', errorMessage);
            this.validationErrors = [errorMessage];
          }
          if ( isLastPut ) await this.handleComplete();
        }
        return this.data;
      }
    }
  ]
});
