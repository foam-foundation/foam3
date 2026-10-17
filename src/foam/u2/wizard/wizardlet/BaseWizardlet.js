/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.wizardlet',
  name: 'BaseWizardlet',

  todo: [
    'rename wizardlet.loading to wizardlet.busy',
    'add support for notification banner'
  ],

  topics: ['saveEvent', 'loadEvent'],

  implements: [
    'foam.u2.wizard.wizardlet.Wizardlet',
    'foam.u2.wizard.DynamicActionWizardlet'
  ],

  imports: [
    'wizardCloseSub?',
    'notify'
  ],

  exports: [
    'id as wizardletId',
    'of as wizardletOf',
    'as wizardlet'
  ],

  requires: [
    'foam.lang.SimpleSlot',
    'foam.log.LogLevel',
    'foam.u2.borders.LoadingLevel',
    'foam.u2.detail.AbstractSectionedDetailView',
    'foam.u2.wizard.WizardletAware',
    'foam.u2.wizard.WizardletIndicator',
    'foam.u2.wizard.agents.QuickAgent',
    'foam.u2.wizard.event.WizardErrorHint',
    'foam.u2.wizard.event.WizardEventType',
    'foam.u2.wizard.wizardlet.WizardletSection',
    'foam.u2.wizard.wao.WAO',
    'foam.u2.wizard.wao.ProxyWAO',
    'foam.u2.wizard.internal.FObjectRecursionSlot',
    'foam.u2.wizard.internal.WizardletAutoSaveSlot'
  ],

  constants: [
    {
      name: 'SAVE_DELAY',
      // TODO: once changes are made to input views to reduce property updates,
      //       this can be decreased to around 100-200ms
      value: 100,
      documentation: 'How long input must be idle before an auto-save'
    }
  ],

  messages: [
    {
      name: 'WIZARDLET_UNHANDLED_ERROR',
      message: 'Unexpected Error'
    }
  ],

  properties: [
    {
      name: 'capability'
    },
    {
      class: 'Boolean',
      name: 'reloadOnAutoSave'
    },
    {
      name: 'id',
      class: 'String',
      expression: function (capability) {
        return capability ? capability.id : foam.uuid.randomGUID();
      }
    },
    {
      name: 'of',
      class: 'Class',
      expression: function(capability) {
        if ( ! capability?.of ) return null;
        return capability.of;
      }
    },
    {
      name: 'data',
      postSet: function (_, n) {
        if ( this.of && this.WizardletAware.isInstance(n) ) {
          n.installInWizardlet(this);
        }
      }
    },
    {
      name: 'title',
      class: 'String',
      expression: function(capability) {
        if ( ! capability?.name ) return '';
        return capability.name;
      }
    },
    {
      name: 'subTitle',
      class: 'String',
      documentation: 'Description of current wizardlet, may be used to provide help for the wizardlet.',
    },
    {
      name: 'isValid',
      class: 'Boolean',
      expression: function (of, data, data$errors_) {
        if ( ! this.of ) return true;
        if ( ! data || data$errors_ ) {
          return false;
        }
        return true;
      }
    },
    {
      name: 'isAvailable',
      class: 'Boolean',
      value: true,
      documentation: `
        Specify the availability of this wizardlet. If true, wizardlet is
        available iff at least one section is available. If false, wizardlet
        does not display even if some sections are available.

        Wizardlet availability determines whether or not the wizardlet will be
        saved. An invisible wizardlet can still be available.
      `
    },

    {
      name: 'isVisible',
      class: 'Boolean',
      documentation: `
        Specify the visibility of this wizardlet. If true, 'createView' will
        be called on any of this wizardlets visible sections. When false, no
        DOM element is rendered.
      `,
      expression: function (of, isAvailable, atLeastOneSectionVisible_) {
        return isAvailable && of && atLeastOneSectionVisible_;
      }
    },
    {
      name: 'isHidden',
      class: 'Boolean',
      documentation: `
        Specify if the wizardlet should have display:none even if it's logically
        visible (when isVisible is true). This is used for search filtering.
      `,
      value: false
    },
    {
      class: 'Boolean',
      name: 'irreversible'
    },
    {
      name: 'isCurrent',
      class: 'Boolean',
      documentation: `
        This is true when this wizardlet is "current", meaning previous wizardlets
        have been filled in by the user.

        Currently this only works in incremental wizards.
      `
    },
    { name: 'atLeastOneSectionVisible_', class: 'Boolean', value: true },
    {
      name: 'reloadAfterSave',
      class: 'Boolean',
      value: true
    },
    {
      name: 'loading',
      documentation: `
        Indicates that the wizardlet's 'data' is being saved or modified by a
        WAO.
      `,
      class: 'Boolean',
      postSet: function (_, n) {
        if ( ! n ) this.LoadingLevel = this.LoadingLevel.IDLE;
      }
    },
    {
      name: 'combinedSection',
      class: 'Boolean',
      description: `
        Setting this to true makes this wizardlet render only one section with
        a SectionedDetailView for the entire model specified by 'of'.
        This is a convenient shorthand for overriding 'sections'.
      `
    },
    {
      name: 'defaultSections',
      class: 'StringArray',
      factory: function () {
        return this.AbstractSectionedDetailView.create({
          of: this.of
        }, this).sections.map(s => s.name);
      }
    },
    {
      name: 'sections',
      flags: ['web'],
      transient: true,
      class: 'FObjectArray',
      of: 'foam.u2.wizard.wizardlet.WizardletSection',
      preSet: function (_, val) {
        // Set 'wizardlet' reference in case this was configured in a journal.
        // Note: when this preSet was added it broke FlatteningCapabilityWizardlet.
        //   Now FlatteningCapabilityWizardlet overrides this preSet.
        for ( let wizardletSection of val ) {
          wizardletSection.wizardlet = this;
        }
        return val;
      },
      factory: function () {
        // Simplified case: render just one section for the whole model
        if ( this.combinedSection ) {
          return [
            this.WizardletSection.create({
              title: this.title,
              isAvailable: true,
              customView: {
                class: 'foam.u2.detail.FlexSectionedDetailView'
              }
            })
          ];
        }

        // Default case: render each model section as a wizardlet section
        const sections = this.createWizardletSectionsFromModel_();
        this.commitToSections_(sections);
        return sections;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.u2.wizard.wizardlet.BaseWizardlet',
      name: 'prerequisiteWizardlets'
    },
    {
      name: 'wao',
      class: 'FObjectProperty',
      of: 'foam.u2.wizard.wao.WAO',
      flags: ['web'],
      documentation: `
        A wizardlet's WAO (Wizardlet Access Object) implements the behavior of
        the save and load operations.
      `,
      factory: function () {
        this.ProxyWAO.create();
      }
    },
    {
      class: 'foam.util.FObjectSpec',
      name: 'exceptionAgent',
      transient: true,
      documentation: `
        Wizardlet's exception handler. This is an FObjectSpec so that it may
        be created in the correct subcontext at the time when it is needed.
      `,
      factory: function () {
        const self = this;

        return this.QuickAgent.create({
          executeFn: async function (x) {
            console.error(x.exception);

            // If we fail to save, the default behaviour will be an error
            // message displayed to the user.
            if ( x.event == self.WizardEventType.WIZARDLET_SAVE )  {
              self.notify(
                x.exception.data.title ?? self.WIZARDLET_UNHANDLED_ERROR,
                x.exception.message,
                self.LogLevel.ERROR,
                true
              );
              return x.createSubContext({
                hint: self.WizardErrorHint.AWAIT_FURTHER_ACTION,
              });
            }

            if ( x.event == self.WizardEventType.WIZARDLET_CRITICAL_FAIL )  {
              self.notify(
                x.exception?.title ?? self.WIZARDLET_UNHANDLED_ERROR,
                x.exception?.message,
                self.LogLevel.ERROR,
                true
              );
              x.wizardController.lastException = x.exception;
              return x.createSubContext({
                hint: self.WizardErrorHint.AWAIT_FURTHER_ACTION,
              });
            }

            // If we fail on wizardlet load we have nowhere to display an
            // error, so the wizard's own error handling will take over
            return x.createSubContext({
              hint: self.WizardErrorHint.ABORT_FLOW
            });
          }
        });
      }
    },
    {
      name: 'indicator',
      class: 'Enum',
      of: 'foam.u2.wizard.WizardletIndicator',
      documentation: `
        Describes how this wizardlet will appear in the list of steps.
      `,
      expression: function (isValid) {
        return isValid ? this.WizardletIndicator.COMPLETED
          : this.WizardletIndicator.PLEASE_FILL;
      }
    },
    {
      name: 'loadingLevel',
      class: 'Enum',
      of: 'foam.u2.borders.LoadingLevel',
      documentation: `
        Indicates the loading state the UI should present this wizardlet in.
        This is used to control a LoadingBorder wraping the wizardlet.
      `
    },
    {
      name: '__subSubContext__',
      documentation: 'Current subContext to use when creating view.',
      transient: true,
      factory: function() { return this.__subContext__; }
    },
    {
      name: 'wizardController',
      documentation: 'Populated by ContextAgent to add the wizard controller to wizardlet context after wizardlet creation',
    },
    {
      class: 'Boolean',
      name: 'showTitle',
      value: true
    },
    {
      class: 'Boolean',
      name: 'pubAnalyticEvt',
      value: true
    },
    {
      class: 'foam.u2.wizard.PathProperty',
      name: 'evtExtra',
      documentation: `
        Path of wizardlet prop to save to AnalyticEvent.EXTRA
      `
    },
    {
      class: 'Boolean',
      name: 'goNextOnSave',
      value: true,
      documentation: `
        If set to false, the wizardController will not attempt to find a next wizardPostiton to go to
        in its next method.
        This is useful because it allows us to use an AlternateFlowSaver which executes an AlternateFlow
        on wizardlet save.
      `
    },
    {
      class: 'Boolean',
      name: 'storeOnCapable',
      value: true,
      documentation: `
        If false, the wizardlet data is not stored on the capable object by CapableWAO
        Note that data can still be saved on the object explicitly using CapableSaver.
        Useful for ignoring capabilities that duplicate data or are present in the heirarchy 
        only for gathering intermediate data from the user such as MinMax and Review/Success capabilities.
      `
    },
    'dataUpdateSub_'
  ],

  methods: [
    function init() {
      if ( this.instance_.sections ) {
        for ( const section of this.sections ) {
          section.wizardlet = this;
        }
      }
    },
    function validate() {
      return this.isValid;
    },
    function createView(data) {
      return null;
    },
    async function save(options) {
      this.indicator = this.WizardletIndicator.SAVING;
      this.normalizeObj();
      var ret = await this.wao.save(this, options);
      this.clearProperty('indicator');
      this.saveEvent.pub(ret);
      return ret;
    },
    async function cancel() {
      this.indicator = this.WizardletIndicator.SAVING;
      var ret = await this.wao.cancel(this);
      this.clearProperty('indicator');
      return ret;
    },
    async function load(options = {}) {
      await this.wao.load(this, options);
      this.loadEvent.pub(this);
      return this;
    },
    async function handleException(event, exception) {
      return await this.handleException_(
        this.__subContext__, event, exception
      );
    },
    async function handleException_(x, event, exception) {
      x = x.createSubContext({ event, exception });
      return await this.exceptionAgent.execute(x);
    },
    function reportNetworkFailure() {
      this.indicator = this.WizardletIndicator.NETWORK_FAILURE;
    },
    {
      name: 'getDataUpdateSub',
      documentation: `
        Returns a subscription that publishes whenever the wizardlet's data or
        any property of the wizardlet's data - recursively - is updated.

        This is useful for checking if a wizardlet has unsaved changes.
      `,
      code: function () {
        if ( this.dataUpdateSub_ ) return this.dataUpdateSub_;
        var filter = foam.u2.wizard.Slot.filter;
        var s = this.SimpleSlot.create();
        var slotSlot = this.data$
          .map(data => {
            var updateSlot = (
              this.WizardletAware.isInstance(data) &&
              data.customUpdateSlot
            ) ? data.getUpdateSlot()
              : this.FObjectRecursionSlot.create({ obj: data });
            return this.WizardletAutoSaveSlot.create({
              // Clear pending auto-saves if we start saving or finish loading
              saveEvent: this.loading$,
              // Listen to property updates if not loading
              other: filter(updateSlot, () => ! this.loading),
              delay: this.SAVE_DELAY,
            });
          });
        slotSlot.valueSub(() => { s.set(slotSlot.get().get()); });
        if ( this.wizardCloseSub ) {
          this.wizardCloseSub.onDetach(s);
          this.wizardCloseSub.onDetach(slotSlot);
        } else {
          console.error(
            'wizardlet update listener will not detach! ' +
            'This wizardlet my be used from an invalid context');
        }
        return this.dataUpdateSub_ = s;
      }
    },
    function pushContext(m) {
      this.__subSubContext__ = this.__subSubContext__.createSubContext(m);
      if ( this.data ) this.data = this.data.clone(this.__subSubContext__);
    },
    function createWizardletSectionsFromModel_() {
      // This method fails if the wizardlet's data is undefined
      if ( ! this.data ) {
        if ( ! this.of ) return [];

        this.warn('initializing wizardlet data to initialize sections');
        this.data = this.of.create({}, this);
      }

      // Internal method used by SECTIONS.factory
      var sections = this.AbstractSectionedDetailView.create({
        of: this.of,
      }, this).sections
        .filter(section => this.defaultSections.includes(
          // section.name can be undefined, so it must be converted to a string
          '' + section.name
        ))
        .map(section => {
          return this.WizardletSection.create({
            section: section,
            wizardlet: this,
            isAvailable$: section.createIsAvailableFor(
              this.data$,
            )
          });
        });
      return sections;
    },
    function commitToSections_(sections) {
      // Internal method used by SECTIONS.factory
      for ( let section of sections ) {
        this.onDetach(section.isAvailable$.sub(
          this.updateVisibilityFromSectionCount));
      }
      this.updateVisibilityFromSectionCount();
    },
    function warn(...args) {
      console.warn(`[wizardlet:${this.id}]`, ...args, { wizardlet: this });
    },
    function willRender() {
      // NO-OP
    }
  ],

  listeners: [
    {
      name: 'updateVisibilityFromSectionCount',
      isFramed: true,
      code: function() {
        if ( ! this.sections ) return;
        this.atLeastOneSectionVisible_ = this.sections.filter(
          v => v.isAvailable).length > 0;
      }
    }
  ]
});
