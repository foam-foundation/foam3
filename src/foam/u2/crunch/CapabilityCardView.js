/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch',
  name: 'CapabilityCardView',
  extends: 'foam.u2.View',

  implements: [ 'foam.mlang.Expressions' ],

  requires: [
    'foam.core.crunch.AgentCapabilityJunction',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.u2.crunch.Style',
    'foam.u2.Element',
    'foam.u2.view.ReadOnlyEnumView'
  ],

  css: `
    <<icon.foam-u2-crunch-Style-icon-circle {
      width: 65px;
      height: 65px;
      margin-right: 24px;
      background-size: cover;
      background-position: 50% 50%;
      flex-shrink: 0;
    }

    << .foam-u2-crunch-Style-card-title {
      margin-bottom: 4px;
    }
  `,

  imports: [
    'auth',
    'crunchService',
    'ctrl',
    'subject',
    'userCapabilityJunctionDAO'
  ],

  documentation: `
    A single card in a list of capabilities.
  `,

  properties: [
    {
      name: 'associatedEntity',
      expression: function(data, subject) {
        if ( ! data || ! subject ) return '';
        return data.associatedEntity === foam.core.crunch.AssociatedEntity.USER ? subject.user : subject.realUser;
      }
    },
    {
      name: 'cjStatus',
      documentation: `
        Stores the status of the capability feature and is updated when the user
        attempts to fill out or complete the CRUNCH forms.
      `,
      factory: function() {
        return foam.core.crunch.CapabilityJunctionStatus.AVAILABLE;
      }
    },
    {
      class: 'Boolean',
      name: 'isRenewable'
    },
    {
      class: 'Boolean',
      name: 'tooltipEnabled',
      value: true
    }
  ],

  messages: [
    { name: 'RENEW_DATA_LABEL', message: 'Please review and update your data' }
  ],

  methods: [
    function init() {
       this.SUPER();
       this.onDetach(this.crunchService.sub('updateJunctionTopic', this.daoUpdate));
       this.daoUpdate();
    },

    function render() {
      this.SUPER();
      var self = this;

      var style = self.Style.create();
      style.addBinds(self);

      self
        .addClass(this.myClass())
        .addClass(style.myClass())
        .addClass(style.myClass('mode-circle'))
        .start()
          .addClass(this.myClass('icon'))
          .addClass(style.myClass('icon-circle'))
          .style({
            'background-image': "url('" + self.data.icon + "')",
          })
        .end()
        .start().style({ 'flex': 1 })
          .start('p')
            .addClass(style.myClass('card-title'))
            .translate(self.data.id + '.' + self.data.cls_.NAME.name, self.data.name)
          .end()
          .start('p')
            .addClass(style.myClass('card-subtitle'))
            .translate(self.data.id + '.' + self.data.cls_.DESCRIPTION.name, self.data.description)
          .end()
        .end()
        .start()
          .add(this.slot(function(cjStatus) {
            return this.E().addClass(style.myClass('tooltip'))
              .start()
                .addClass(this.myClass('badge'))
                .add(self.ReadOnlyEnumView.create({ data: cjStatus }))
              .end()
              .start('span')
                .addClass(style.myClass('tooltiptext'))
                .enableClass(style.myClass('tooltipDisabled'), self.tooltipEnabled, true)
                .add(cjStatus.documentation)
              .end();
          }))
          .add(this.slot(function(isRenewable) {
            return isRenewable ? this.E()
              .start()
                .addClass(style.myClass('renewable-description'))
                .add(self.RENEW_DATA_LABEL)
              .end() : null;
          }))
        .end()


        ;
    }
  ],

  listeners: [
    {
      name: 'daoUpdate',
      code: function() {
        this.crunchService.getJunction(null, this.data.id).then(ucj => {
          if ( ucj ) {
            this.cjStatus = ucj.status === this.CapabilityJunctionStatus.APPROVED ?
              this.CapabilityJunctionStatus.PENDING : ucj.status;
          }
          if ( this.cjStatus === this.CapabilityJunctionStatus.GRANTED ) {
            this.crunchService.isRenewable(this.ctrl.__subContext__, ucj.targetId).then(
              isRenewable => this.isRenewable = isRenewable
            );
          }
          if ( this.cjStatus === this.CapabilityJunctionStatus.ACTION_REQUIRED &&
               ucj.targetId == '554af38a-8225-87c8-dfdf-eeb15f71215f-20') {
              this.cjStatus = this.CapabilityJunctionStatus.PENDING_REVIEW;
          }
        });
      }
    }
  ]
});
