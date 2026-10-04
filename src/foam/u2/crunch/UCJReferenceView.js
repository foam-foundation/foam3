/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch',
  name: 'UCJReferenceView',
  extends: 'foam.u2.View',

  documentation: `
    Render the UCJ specified by 'data' in an inline CRUNCH wizard. The default
    WAO setting is APPROVAL, which means UCJ changes will generate approvals
    instead of updating UCJs directly.
  `,

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'capabilityDAO',
    'crunchController',
    'userCapabilityJunctionDAO'
  ],

  requires: [
    'foam.core.crunch.ui.UCJView',
    'foam.core.crunch.Capability',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.core.crunch.AgentCapabilityJunction',
    'foam.u2.crunch.wizardflow.ApprovalRequestAgent',
    'foam.u2.crunch.wizardflow.LoadCapabilitiesAgent',
    'foam.u2.stack.Stack',
    'foam.u2.stack.StackView'
  ],

  css: `
    << .foam-u2-stack-StackView {
      padding-left: 0px;
    }
  `,

  properties: [
    {
      name: 'localStack',
      factory: function() {
        return this.Stack.create();
      }
    },
    {
      name: 'ucj',
      transient: true
    },
    {
      name: 'ucjPropertyList',
      class: 'FObjectArray',
      of: 'foam.core.crunch.UserCapabilityJunction',
      transient: true,
      documentation: 'Stores the property predicate search results from ucjDAO.'
    },
    {
      name: 'capabilitiesList',
      class: 'FObjectArray',
      of: 'foam.core.crunch.Capability',
      transient: true,
      documentation: 'Set this property to display these ucj\'s in wizard'
    }
  ],

  methods: [
    async function render() {
      // the variable ucj in this function acts as the root capaiblity.
      // Also takes the subject from ucj and sets it through the wizard.
      // TODO this only works for ONE signing officer
      this
        .add(this.slot(async function(ucjPropertyList) {
          var ucj = await ucjPropertyList.filter(u => this.AgentCapabilityJunction.isInstance(u) );
          this.capabilitiesList = (
            await this.capabilityDAO.where(this.AND(
              this.IN(this.Capability.ID, this.ucjPropertyList.map(u => u.targetId)),
              this.HAS(this.Capability.OF))).select()
          ).array;
          return this.UCJView.create({
            isSettingCapabilities: true,
            data: ucj.length > 0 ? ucj[0] : ucjPropertyList[0],
            mode: this.mode,
            capabilitiesList: this.capabilitiesList
          });
        }));
      this.ucjPropertyList = (
        await this.userCapabilityJunctionDAO.where(this.data).select()
      ).array;
    }
  ]
});
