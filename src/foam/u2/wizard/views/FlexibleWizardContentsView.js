/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.views',
  name: 'FlexibleWizardContentsView',
  extends: 'foam.u2.View',

  issues: [
    'Add loading spinner support to ^'
  ],

  imports: [
    'controlBorder?',
    'developerMode?'
  ],

  requires: [
    'foam.u2.ActionReference'
  ],

  documentation: `
    This wizard view uses flex to center its contents.
  `,

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 40pt;
    }
    ^flexButtons {
      display: flex;
      flex-direction: column;
      position: sticky;
      bottom: 0;
      background-color: $backgroundDefault;
      gap: 0.5rem;
    }
    ^flexButtons > * {
      flex-grow: 1;
      margin-left: 0 !important;
    }
    ^developer-btn {
      position: fixed;
      top: 1.2rem;
      right: 1.2rem;
      padding: 0.4rem;
    }
  `,

  properties: [
    {
      name: 'onClose',
      class: ''
    }
  ],

  methods: [
    function render() {
      const self = this;

      if ( self.developerMode ) {
        this
          .start(this.data.OPEN_WIZARD_INSPECTOR, { data: this.data })
            .addClass(this.myClass('developer-btn'))
          .end()
      }

      const current$ = this.slot(function (data, data$currentWizardlet, data$currentSection) {
        return data$currentSection?.createView(undefined, {
          controlBorder: this.controlBorder
        }) ?? this.E();
      })
      let actionsDetachable = foam.lang.FObject.create();

      this.addClass()
        // Render current wizard section
        .add(current$)
        // Render actions
        // Why dont we do this in FocusWizardForm?
        .add(this.slot(function (data$actionBar, data$currentWizardlet) {
          let actions = data$actionBar;

          // avoid mutating the reported action bar
          actions = [...actions];

          // When the slot listener updates this object will be detached
          actionsDetachable.detach();
          actionsDetachable = foam.lang.FObject.create();

          if ( self.controlBorder ) {
            const remainingActions = [];

            self.controlBorder.clearActions();

            for ( let i = 0 ; i < actions.length ; i++ ) {
              const added = self.controlBorder.addAction(actions[i], this.data);
              if ( added ) continue;
              remainingActions.push(actions[i]);
            }

            actions = remainingActions;
          }
          // Listen to availability of actions that FlexibleWizardContentsView
          //   still has rendering control over to decide if the container
          //   is visible
          let slots = [];
          actions.forEach(a => {
            slots.push(a.createIsAvailable$(self.__subContext__, self.data));
          });
          let s = foam.lang.ArraySlot.create({ slots: slots }, self);
          let anyAvailable = this.slot(function(slots) {
            for ( let slot of slots ) {
              if ( slot ) return true;
            }
            return false;
          }, s);

          // Render action buttons
          return this.E()
            .addClass(self.myClass('flexButtons'))
            .show(anyAvailable)
            // WARNING!!!
            // Export the current wizardlet section view in context so that dynamicActions can use it
            // this only works for incremental wizard, we will need a better solution for wizards that
            // render multiple sections at once
            .startContext({ currentWizardletSectionView: current$ })
            .forEach(actions.reverse(), function (action) {
              this.tag(action, {
                size: 'LARGE',
                label: self.data.currentWizardlet.actionLabel || action.label
              });
            }).endContext();
        }))
        ;
    },
  ]
});
