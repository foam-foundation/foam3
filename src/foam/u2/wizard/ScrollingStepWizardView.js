/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard',
  name: 'ScrollingStepWizardView',
  extends: 'foam.u2.wizard.IncrementalStepWizardView',
  mixins: ['foam.u2.wizard.WizardletRenderUtils'],
  documentation: `Displays all wizardlets in a scrolling page.`,

  imports: [ 'sequence?' ],

  messages: [
    { name: 'NO_ACTION_LABEL', message: 'Done' },
    { name: 'SAVE_LABEL', message: 'Save' },
    { name: 'REJECT_LABEL', message: 'Reject' },
    {
      name: 'NETWORK_FAILURE_MESSAGE',
      message: 'There is a problem connecting to the server. Please wait.'
    }
  ],

  requires: [
    'foam.u2.tag.CircleIndicator',
    'foam.u2.tag.Input',
    'foam.u2.borders.LoadingBorder',
    'foam.u2.crunch.wizardflow.SaveAllAgent',
    'foam.u2.wizard.WizardPosition',
    'foam.u2.wizard.WizardStatus',
    'foam.u2.wizard.WizardletIndicator',
    'foam.u2.wizard.WizardletSearchController'
  ],

  css: `
    ^ {
      --foamMargin: 20px;
    }

    ^mainView > * > *:not(:last-child):not(^heading) {
      margin-bottom: 40px;
    }

    ^rightside {
      --actionBarTbPadding: 13px;
      --buttonHeight: 38px;
      --actionBarHeight: calc(
        2*var(--actionBarTbPadding) + var(--buttonHeight));
      --lrPadding: 48px;
      --tbPadding: var(--lrPadding);
      position: relative;
    }

    ^ ^rightside ^entry, ^ ^rightside ^hide-X-entry {
      flex-grow: 1;
      overflow-y: auto;
      padding: var(--tbPadding) var(--lrPadding);
      padding-bottom: calc(var(--tbPadding) - var(--foamMargin));
      /* padding-bottom: calc(var(--lrPadding) + var(--actionBarHeight)) */
    }

    ^rightside ^bottomnav {
      align-items: center;
      background-color: $backgroundDefault;
      backdrop-filter: blur(5px);
      box-shadow: 0px -1px 3px $borderDefault;
      display: flex;
      flex-grow: 0;
      justify-content: flex-end;
      padding: var(--actionBarTbPadding) var(--lrPadding);
    }

    ^heading {
      display: flex;
      align-items: center;
      margin-bottom: 40px;
    }

    ^network-failure-banner {
      backdrop-filter: blur(10px);
      background-color: $destructive500;
      border-radius: 8px;
      color: $backgroundDefault;
      margin-bottom: 16px;
      padding: 8px;
      position: sticky;
      text-align: center;
      top: 0;
      z-index: 1000;
    }

    ^hide {
      display: none !important;
    }
  `,

  properties: [
    {
      name: 'scrollPosition',
      class: 'Int'
    },
    {
      name: 'wizardPositionElements',
      class: 'Map'
    },
    {
      name: 'scrollWizardPosition',
      expression: async function (scrollPosition, wizardPositionElements) {
        var offset = 50;

        var test_visible = el => {
          // Offset parent might be a wrapping element, but we want the element
          // who has the wizard scroller as its offsetParent
          while ( el.offsetParent != this.scrollOffsetElement ) {
            el = el.offsetParent;
            // This is tricky; sometimes the element isn't really loaded, so
            // offsetParent will be null. This also happens with display:none.
            if ( el === null ) return false;
          }

          var sectTop = el.offsetTop - offset;
          var sectBot = sectTop + el.clientHeight;
          var mainTop = this.mainScrollElement.scrollTop;
          var mainBot = mainTop + this.mainScrollElement.clientHeight;
          return (sectTop <= mainTop && sectBot > mainTop) ||
            (sectBot >= mainBot && sectTop < mainBot) ||
            (sectTop >= mainTop && sectBot < mainBot) ;
        };
        var minTopPosition = null;
        // Find the closest visible section to the top
        for ( let hash in wizardPositionElements ) {
          let el = await wizardPositionElements[hash].section.el_();
          let pos = wizardPositionElements[hash].position;
          if ( ! el ) {
            delete wizardPositionElements[hash];
            continue;
          }
          if ( test_visible(el) ) {
            if ( ! minTopPosition || pos.compareTo(minTopPosition) < 0 )
              minTopPosition = pos;
          }
        }

        return minTopPosition;
      }
    },
    'mainScrollElement',
    'scrollOffsetElement',
    {
      name: 'hasAction',
      documentation: `
        Used to change submit button text between 'Done' and 'Submit' depending
        on if any wizardlets have an action for submit.
      `,
      expression: function (data$wizardlets) {
        return data$wizardlets.filter(w => w.submit).length > 0;
      }
    },
    {
      name: 'willSave',
      documentation: `
        Used to change submit button text between 'Done' and 'Save' depending
        on if auto-save is on.
      `,
      factory: function () {
        return this.sequence && this.sequence.contains('SaveAllAgent');
      }
    },
    {
      name: 'willReject',
      documentation: `
        Used to put submit button in confirmationRequired mode and change the
        submit button label from 'Done' to 'Reject' when rejectOnInvalidatedSave is true
        and the wizard has at least one invalid wizardlet.
      `,
      expression: function( data$config$rejectOnInvalidatedSave, data$allValid ) {
        return data$config$rejectOnInvalidatedSave && ! data$allValid;
      }
    },
    {
      name: 'primaryLabel',
      documentation: 'Used to switch to the appropriate label for the primary action',
      expression: function(hasAction, willReject, willSave) {
        if ( willReject ) return this.REJECT_LABEL;
        if ( hasAction ) return this.ACTION_LABEL;
        if ( willSave ) return this.SAVE_LABEL;
        return this.NO_ACTION_LABEL;
      }
    },
    {
      class: 'Boolean',
      name: 'displayWizardletSteps',
      value: true,
      documentation: `Show capability wizard steps.`
    }
  ],

  methods: [
    function render() {
      var self = this;
      globalThis.testing_ = self;
      this.onDetach(this.scrollWizardPosition$.sub(() => {
        if ( ! this.scrollWizardPosition ) return; // TEMP
        this.data.wizardPosition = this.scrollWizardPosition;
      }));
      this
        .addClass(this.myClass()) // Used to fix CSS precedence with parent
        .enableClass(this.myClass('fullscreen'), this.fullScreen$)
        .start(this.Grid)
          .addClass(this.myClass('fix-grid'))
          .start(this.GUnit, { columns: 4 }).show(this.displayWizardletSteps)
            // TODO: deprecate this hide-X-status class
            .enableClass(this.myClass('hide-X-status'), this.hideX$)
            .enableClass(this.myClass('status'), this.hideX$, true)
            .add(
              this.slot(function (data, data$currentWizardlet) {
                return this.StepWizardletStepsView.create({
                  data: data,
                });
              })
            )
          .end()
          .start(this.GUnit, { columns: this.displayWizardletSteps ? 8 : 12 })
            .addClass(this.myClass('rightside'))
            .call(function () {
              self.onDetach(async function() {
                  self.scrollOffsetElement = await self.el_();
              });
            })
            .start()
              .call(function () {
                self.onDetach(async function() {
                    self.mainScrollElement = await self.el_();
                    self.scrollWizardPosition$.get();
                });
              })
              .on('scroll', function (e) {
                self.scrollPosition = e.srcElement.scrollTop;
              })
              .addClass(this.myClass('mainView'))
              // TODO: deprecate this hide-X-entry class
              .addClass(this.hideX ? this.myClass('hide-X-entry') : this.myClass('entry'))
              .add(this.slot(function (data$someFailures) {
                return data$someFailures
                  ? this.E()
                    .addClass('p', this.myClass('network-failure-banner'))
                    .add(this.NETWORK_FAILURE_MESSAGE)
                  : this.E();
              }))
              .add(this.slot(function (data$wizardlets) {
                return self.renderWizardlets(this.E(), data$wizardlets);
              }))
            .end()
            .start()
              .addClass(this.myClass('bottomnav'))
              .start()
                .addClass(this.myClass('actions'))
                .tag(this.data.OPEN_WIZARD_INSPECTOR)
                .startContext({ data: self })
                  .tag(this.SUBMIT, {
                    label$: this.primaryLabel$,
                    buttonStyle: 'PRIMARY'
                  })
                .endContext()
              .end()
            .end()
          .end()
        .end()
        ;
    },
    function renderWizardlets(e, wizardlets) {
      var self = this;
      return e.forEach(wizardlets, function (wizardlet, wi) {
        this.add(wizardlet.slot(function (isAvailable, isVisible) {
          if ( ! isVisible ) return self.E();
          var e2 = self.renderWizardletHeading(self.E(), wizardlet);
          return e2
            .start(self.LoadingBorder, { loadingLevel$: wizardlet.loadingLevel$ })
              .call(function () {
                self.renderWizardletSections(this, wizardlet, wi);
              })
            .end()
            ;
        }));
      });
    },
    function renderWizardletHeading(e, wizardlet) {
      // ???: should properties of 'this.data' be read here? Does it matter?
      var isCurrent = wizardlet == this.data.currentWizardlet;
      var self = this;
      return e
        .add(wizardlet.slot(function (isVisible) {
          if ( ! isVisible ) return self.E();
          return self.E()
            .addClass(self.myClass('heading'))
            .addClass(wizardlet.isHidden$.map(v => v && self.myClass('hide')))
            .add(wizardlet.slot(function (indicator) {
              return self.E()
                .style({
                  // TODO: move to CSS axiom
                  display: 'inline-block',
                  float: 'left',
                  'margin-right': '15px'
                })
                .start(self.CircleIndicator, self.configureIndicator(
                  wizardlet, isCurrent, self.calculateWizardletDisplayNumber(
                    wizardlet, self.data.wizardlets)
                ))
                .end()
            }))
            .start()
              .addClass('h300')
              .translate(wizardlet.id+'.name', wizardlet.title)
            .end();
        }));
    },
    function renderWizardletSections(e, wizardlet, wi) {
      var self = this;
      return e.start(self.Grid)
        .addClass(wizardlet.isHidden$.map(v => v && self.myClass('hide')))
        .forEach(wizardlet.sections, function (section, si) {
          var position = self.WizardPosition.create({
            wizardletIndex: wi,
            sectionIndex: si,
          });
          this.add(section.createView().call(function () {
            this.onDetach(this.state$.sub(() => {
              if ( this.state.cls_ == foam.u2.LoadedElementState ) {
                if ( ! self.wizardPositionElements[position.hash()] )
                  self.wizardPositionElements$set(position.hash(), {
                    section: this,
                    position: position
                  });
              }
            }));
          }));
        }).end();
    }
  ],

  actions: [
    {
      name: 'submit',
      label: 'Done',
      confirmationRequired: function(willReject) {
        return willReject;
      },
      isEnabled: function (data$config, data$allValid, data$someFailures) {
        if ( data$someFailures ) return false;
        return ! data$config.requireAll || data$allValid;
      },
      isAvailable: function (mode) {
        return mode == foam.u2.DisplayMode.RW;
      },
      code: function (x) {
        for ( let w of this.data.wizardlets ) {
          if ( w.submit ) w.submit();
        }

        this.data.submitted = true;
        this.data.status = this.WizardStatus.COMPLETED;
        this.onClose(x, true);
      }
    }
  ]
});
