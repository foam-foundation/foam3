/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch',
  name: 'UCJUpdateApprovable',
  extends: 'foam.core.approval.CompositeApprovable',
  implements: ['foam.core.approval.CustomViewReferenceApprovable'],

  properties: [
    {
      class: 'foam.core.crunch.UCJProperty',
      name: 'associatedTopLevelUCJ',
      documentation: `
        A top-level UCJ associated with these changes. If a UCJUpdateApprovable
        ever contains a collection of UCJs that do not have a common parent,
        this can refer to an arbitrary UCJ among those with the most specific
        subject association.
      `
    }
  ],

  methods: [
    async function launchViewReference(x, approvalRequest) {
      var ucj = (await x.userCapabilityJunctionDAO
        .where(this.associatedTopLevelUCJ).select()).array[0];
      var subject = await ucj.getSubject();

      x.crunchController.createWizardSequence(ucj.targetId, x)
        .reconfigure('LoadCapabilitiesAgent', {
          subject: subject
        })
        .reconfigure('ConfigureFlowAgent', {
          popupMode: false
        })
        .remove('LoadTopConfig')
        .remove('RequirementsPreviewAgent')
        .remove('SkipGrantedAgent')
        .remove('WizardStateAgent')
        .execute();
    }
  ]
});
