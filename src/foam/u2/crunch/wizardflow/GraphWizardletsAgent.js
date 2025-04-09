/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch.wizardflow',
  name: 'GraphWizardletsAgent',
  implements: [ 'foam.lang.ContextAgent' ],

  imports: [
    'capabilities',
    'capabilityGraph',
    'getWAO'
  ],

  exports: [
    'wizardlets',
    'capabilityToPrerequisite'
  ],

  requires: [
    'foam.graph.GraphTraverser',
    'foam.graph.TraversalOrder',
    'foam.graph.WeightPriorityStrategy',
    'foam.core.crunch.ui.CapabilityWizardlet',
    'foam.core.crunch.ui.LiftingAwareWizardlet',
    'foam.core.crunch.ui.PrerequisiteAwareWizardlet',
    'foam.u2.wizard.wao.NullWAO',
    'foam.u2.wizard.wao.ProxyWAO'
  ],

  properties: [
    {
      name: 'wizardlets',
      class: 'FObjectArray',
      of: 'foam.u2.wizard.wizardlet.Wizardlet'
    },
    {
      class: 'Map',
      name: 'capabilityWizardletsMap'
    },
    {
      class: 'Map',
      name: 'capabilityToPrerequisite'
    }
  ],

  methods: [
    async function execute() {
      this.createWizardlets();
    },
    function createWizardlets() {
      // Step 1: Traverse capability graph to create wizardlets
      const traverser = this.GraphTraverser.create({
        graph: this.capabilityGraph,
        order: this.TraversalOrder.POST_ORDER,
        weightPriorityStrategy: this.WeightPriorityStrategy.MIN
      });

      this.capabilityToPrerequisite = traverser.nodeToDescendants;

      traverser.sub('process', (_1, _2, { parent, current }) => {
        const createdHere = this.createWizardletsForCapability(current);
        const entry = this.capabilityWizardletsMap[current.id];
        if ( parent && this.capabilityWizardletsMap[parent.id] ) {
          const parentEntry = this.capabilityWizardletsMap[parent.id];
          this.linkPrerequisite(parentEntry, entry, {
            lifted: ! createdHere
          });
        }
      });
      traverser.traverse();

      // Step 2: Iterate over wizardlet information in capabilityWizardletsMap
      //         to create the final ordered list of wizardlets
      const wizardlets = [];
      const rootNode = this.capabilityGraph.roots[0];
      const pushWizardlets = (entry, inPrerequisteAwareStack) => {
        let currentPrerequisiteStack = inPrerequisteAwareStack
        if ( entry.beforeWizardlet ) wizardlets.push(entry.beforeWizardlet);
        if ( this.isPrerequisiteAware(entry.beforeWizardlet) ) inPrerequisteAwareStack = true;
        for ( const subEntry of entry.betweenWizardlets ) {
          pushWizardlets(subEntry, inPrerequisteAwareStack);
        }
        inPrerequisteAwareStack = false;
        if ( entry.afterWizardlet ) wizardlets.push(entry.afterWizardlet);
        for ( let wizardlet of entry.wizardlets ) {
          if ( currentPrerequisiteStack ) {
            // Turn on to debug MinMax bugs
            // console.log('Turning off saveOnAvailable on', wizardlet.id);
            wizardlet.saveOnAvailable = false;
          }
          if ( this.isLiftingAware(wizardlet) ) {
            wizardlet.handleLifting(entry.liftedWizardlets.map(
              entry => entry.primaryWizardlet));
          }
        }
      };
      pushWizardlets(this.capabilityWizardletsMap[rootNode.id], false);
      this.wizardlets = wizardlets;
    },
    function createWizardletsForCapability(current) {
      const capability = current.data;

      if ( this.capabilityWizardletsMap[capability.id] ) {
        return false;
      }

      const afterWizardlet = this.adaptWizardlet(
        { capability }, capability.wizardlet);
      const beforeWizardlet = this.adaptWizardlet(
        { capability }, capability.beforeWizardlet);

      this.capabilityWizardletsMap[capability.id] = {
        primaryWizardlet: afterWizardlet || beforeWizardlet,
        wizardlets: [beforeWizardlet, afterWizardlet].filter(v => v),
        beforeWizardlet, afterWizardlet,
        betweenWizardlets: [],
        liftedWizardlets: [],
        parentControlled: false,
        availabilitySlot: null,
        availabilityDetach: null
      };

      if ( beforeWizardlet && afterWizardlet ) {
        beforeWizardlet.isAvailable$.follow(afterWizardlet.isAvailable$);
        afterWizardlet.data$ = beforeWizardlet.data$;
        afterWizardlet.isVisible = false;
      }

      return true;
    },
    function linkPrerequisite(source, entry, { lifted }) {
      if ( source.betweenWizardlets.includes(entry) ) return;
      ( lifted
        ? source.liftedWizardlets
        : source.betweenWizardlets ).push(entry);
      for ( let parentWizardlet of source.wizardlets ) {
        if ( this.isPrerequisiteAware(parentWizardlet) ) {
          parentWizardlet.addPrerequisite(entry.primaryWizardlet, { lifted });
        }
        parentWizardlet.prerequisiteWizardlets.push(entry.primaryWizardlet);
      }
      const parentControlsAvailability =
        this.isPrerequisiteAware(source.beforeWizardlet) ||
        this.isPrerequisiteAware(source.afterWizardlet);
      entry.parentControlled = parentControlsAvailability || entry.parentControlled;
      if ( ! entry.parentControlled ) {
        // Temporarily disable saveOnAvailable to prevent saving when the graph is being set up
        let oldSaveOnAvailable = entry.primaryWizardlet.saveOnAvailable;
        entry.primaryWizardlet.saveOnAvailable = false;
        if ( ! entry.availabilitySlot ) {
          entry.availabilitySlot = source.primaryWizardlet.isAvailable$;
          entry.availabilityDetach = entry.primaryWizardlet.isAvailable$.follow(entry.availabilitySlot);
        } else {
          entry.availabilityDetach.detach();
          entry.availabilitySlot = entry.availabilitySlot.or(source.primaryWizardlet.isAvailable$)
          entry.availabilityDetach = entry.primaryWizardlet.isAvailable$.follow(entry.availabilitySlot);
        }
        entry.primaryWizardlet.saveOnAvailable = oldSaveOnAvailable;
      }
    },
    function adaptWizardlet({ capability }, wizardlet) {
      if ( ! wizardlet ) return null;
      wizardlet = wizardlet.clone(this.__subContext__);

      wizardlet.copyFrom({ capability: capability });     

      var wao = wizardlet.wao;
      if ( ! wao ) wao = wizardlet.wao = this.NullWAO.create();
      while ( this.ProxyWAO.isInstance(wao) ) {
        // If there's already something at the end, don't replace it
        if ( ! wao.delegate || this.NullWAO.isInstance(wao.delegate) ) {
          wao.delegate = this.getWAO();
          break;
        }
        wao = wao.delegate;
      }

      return wizardlet;
    },
    function isPrerequisiteAware(wizardlet) {
      return this.PrerequisiteAwareWizardlet.isInstance(wizardlet);
    },
    function isLiftingAware(wizardlet) {
      return this.LiftingAwareWizardlet.isInstance(wizardlet);
    }
  ]
});
