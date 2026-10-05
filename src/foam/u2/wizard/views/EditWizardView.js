/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.views',
  name: 'EditWizardView',
  extends: 'foam.u2.View',
  documentation: `
    A WizardView for update actions.

    This wizard view displays a border around each wizardlet with update
    actions. If the wizardlet comes from a capability, the capability's
    configured edit behaviour will be used to determine what border
    a wizardlet is rendered in.
  `,

  imports: ['wizardController', 'stack'],

  requires: [
    'foam.u2.borders.Block',
    'foam.u2.borders.CardBorder',
    'foam.u2.detail.SectionView'
  ],

  messages: [
    { name: 'EDIT_WIZARD_TITLE', message: 'Personal Settings'}
  ],

  css:`
  << {
    padding: 32px 24px;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 2.4rem;
  }
  <<menu-header{
    align-self: flex-start
  }
  <<card.foam-u2-borders-CardBorder {
    padding: 16px 32px;
  }
  `,

  properties: [
    {
      name: 'title',
      class: 'String'
    }
  ],

  methods: [
    function render () {
      const self = this
      this
        .dynamic(function (data$wizardlets) {
          self.stack.setCompact(true, self);
          self.stack.setTitle(self.title$, self);
          this
            .addClass()
            .forEach(data$wizardlets, function (wizardlet) {
              wizardlet.load()
              const x = this.__subContext__.createSubContext({wizardlet})
              self.wrapBorder_(x, this, wizardlet, function() {
                this
                  .forEach(wizardlet.sections, function (section) {
                    this.tag(section.createView( {}, { controllerMode: this.__subSubContext__.controllerMode$ } ) ?? this.E());
                  })
              })
            });
        });
    },

    function getBorder_(x, wizardlet) {
      if ( ! wizardlet.capability ) return this.Block;
      return wizardlet.capability.editBehaviour.wizardletBorder
    },

    function wrapBorder_(x, el, wizardlet, callback) {
      el
        .startContext({ wizardlet })
          .start(this.getBorder_(x, wizardlet))
            .call(callback)
          .end()
        .endContext()
    }
  ]
});
