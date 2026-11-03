/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch.lab',
  name: 'CapabilityExperimentView',
  extends: 'foam.u2.detail.TabbedDetailView',
  documentation: `
    What do you do in a lab? You conduct experiments!
    CapabilityExperimentView is an extension of a Capability detail view that
    also provides options for testing the Capability's behaviour.
  `,

  css: `
    <<vertical {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `,

  requires: [
    'foam.u2.Tab',
    'foam.u2.Tabs',
    'foam.u2.Accordion',
    'foam.u2.tag.Button',
    'foam.util.AddBeforeFluentSpec',
    'foam.util.RemoveFluentSpec'
  ],

  properties: [
    {
      name: 'tabs',
      postSet: function (_, n) {
        this.addCrunchLabTabs_(n);
      }
    },
    'experimentsTab',
    {
      class: 'Reference',
      of: 'foam.u2.crunch.lab.SequenceReference',
      name: 'sequenceReferenceId'
    },
    {
      class: 'FObjectArray',
      of: 'foam.util.BaseFluentSpec',
      name: 'sequenceModifications',
      view: function (_, x) {
        return {
          class: 'foam.u2.view.DAOListWithCreateView',
          dao: foam.dao.ArrayDAO.create({
            of: 'foam.util.BaseFluentSpec',
            array: [
              x.data.AddBeforeFluentSpec.create({
                reference: 'ConfigureFlowAgent',
                spec: {
                  class: 'foam.u2.wizard.agents.RootCapabilityAgent',
                  rootCapability: x.data.data.id
                }
              }),
              x.data.AddBeforeFluentSpec.create({
                reference: 'CreateWizardletsAgent',
                spec: {
                  class: 'foam.u2.crunch.wizardflow.LoadCapabilityGraphAgent'
                }
              }),
              x.data.AddBeforeFluentSpec.create({
                reference: 'CreateWizardletsAgent',
                spec: {
                  class: 'foam.u2.crunch.wizardflow.GraphWizardletsAgent'
                }
              }),
              x.data.RemoveFluentSpec.create({
                reference: 'CreateWizardletsAgent'
              })
            ]
          }, x),
          valueView: {
            class: 'foam.u2.detail.VerticalDetailView'
          },
          addView: {
            class: 'foam.u2.view.FObjectView',
            of: 'foam.util.BaseFluentSpec'
          }
        }
      }
    },
  ],

  methods: [
    function addCrunchLabTabs_(el) {
      const self = this;
      el
        .start(this.Tab, { label: 'Exec' }, this.experimentsTab$)
          .addClass(this.myClass('vertical'))
          .startContext({ data: this })
            .tag(this.SEQUENCE_REFERENCE_ID)
          .endContext()
          .start({
            class: 'foam.u2.Accordion',
            expanded: false,
            title: 'Sequence Modifications'
          })
            .startContext({ data: this })
              .tag(this.SEQUENCE_MODIFICATIONS)
            .endContext()
          .end()
          .endContext()
          .add(this.slot(function (sequenceReferenceId, sequenceModifications) {
            return this.E().add(foam.lang.PromiseSlot.create({
              promise: (async () => {
                const sequenceReference = await self.sequenceReferenceId$find;
                if ( ! sequenceReference ) return self.E();
                const sequence = await sequenceReference.getSequence();
                if ( sequenceModifications.length > 0 ) try {
                  for ( const mod of sequenceModifications ) {
                    mod.apply(sequence);
                  }
                } catch (e) {
                  console.error(e);
                }
                console.log('sequence', sequence)
                return self.E()
                  .start({
                    class: 'foam.u2.Accordion',
                    expanded: false,
                    title: 'Resulting Sequence'
                  })
                    .tag(foam.flow.widgets.SequenceSummary, { sequence })
                  .end()
                  .start(self.Button, { label: 'Launch Wizard' })
                    .on('click', () => {
                      sequence.execute(this.__subContext__);
                    })
                  .end()
              })()
            }));
          }))
        .end()
      this.experimentsTab.selected = true;
    }
  ]
});
