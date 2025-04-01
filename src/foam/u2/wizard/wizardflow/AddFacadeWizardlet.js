/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.wizardflow',
  name: 'AddFacadeWizardlet',
  extends: 'foam.u2.wizard.wizardflow.AddWizardlet',

  documentation: 'TODO: make this responsive to editbehaviour',

  classes: [
    {
      name: 'FacadeWizardlet',
      extends: 'foam.u2.wizard.wizardlet.AlternateFlowWizardlet',

      properties: [
        {
          name: 'status',
          documentation: `Combined status of all wizardlets that make up the facade, if any of them is not granted this wizardlet assumes that status
          Only used for skipping this wizard in case all facaded wizardlets are granted, should not be used as a source of truth`,
          value: 'AVAILABLE'
        },
        'wizardlets'
      ],
      methods: [
        function populateStatus() {
          let anyIncomplete = false ;
          Object.keys(this.wizardlets).forEach(v => {
            let w = this.wizardlets[v];
            if (w.status == 'AVAILABLE' || w.status == 'ACTION_REQUIRED') anyIncomplete = true;
          })
          if ( ! anyIncomplete ) this.status = 'GRANTED';
        },
        function handleSkipping() {
          let next = this.dynamicActions.find(v => v.name == 'goNext');
          next.alternateFlow.execute(this.__subContext__);
        }
      ]
    },
    {
      name: 'FacadeLoader',
      extends: 'foam.u2.wizard.data.CreateLoader',

      imports: ['wizardlet', 'createPropertyName'],

      requires: [
        'foam.u2.wizard.wao.NoLoadWAO'
      ],
    
      methods: [
        async function load(o) {
          // If CreateLoader has a delegate we assume copyFrom is expected
          let sup = this.SUPER.bind(this);
          if ( ! this.wizardlet && ! this.spec.realWizardlets ) 
            console.error('Facade loader called without wizardlet or realwizardlets map');
          await Promise.all(Object.keys(this.spec.realWizardlets).map(async v => {
            let w = this.spec.realWizardlets[v];
            await w.load({ enableLoad: true });
            this.args[foam.u2.wizard.Wizardlet.camelCaseCapabilityId(v)] = w.data;
          }))
          data = await sup(o);
          this.wizardlet.populateStatus();
          return data;
        }
      ]
    },
    {
      name: 'FacadeSaver',
      extends: 'foam.u2.wizard.data.ProxySaver',

      imports: ['wizardlet', 'createPropertyName'],

      requires: [
        'foam.u2.wizard.wao.NoLoadWAO'
      ],

      properties: [
        {
          name: 'realWizardlets'
        }
      ],
    
      methods: [
        async function save(o) {
          // Remove loaders from any wizardlets that are facaded
          // This is done to prevent the wizardlet from trying to override data that has already been 
          // input by the facade
          if ( ! this.wizardlet && ! this.realWizardlets ) 
            console.error('Facade loader called without wizardlet or realwizardlets map');
          Object.keys(this.realWizardlets).map(async v => {
            let w = this.realWizardlets[v];
            w.wao = this.NoLoadWAO.create({ delegate: w.wao });
          })
          return await this.delegate.save(o);
        }
      ]
    }
  ],

  exports: ['createPropertyName'],
  properties: [
    {
      class: 'Array',
      name: 'capabilityIds',
      description: 'Capabilities to facade'
    },
    {
      class: 'Map',
      name: 'facadeModelOverrides',
      description: 'Allows proving overrides for the facade model props'
    },
    {
      class: 'Array',
      name: 'additionalFacadeProperties',
      documentation: 'Array of additional arbritary properties to add to the facade model'
    },
    {
      name: 'wizardletCls',
      value: 'foam.u2.wizard.wizardflow.AddFacadeWizardlet.FacadeWizardlet'
    },
    {
      class: 'Map',
      name: 'wizardlets_'
    }
  ],
  methods: [
    function createPropertyName(capId) {
      return foam.u2.wizard.Wizardlet.camelCaseCapabilityId(capId);
    },
    function getWizardlet_(x) {
      let self = this;
      let facadeWizardlet = this.SUPER(x);

      // Set up the facade model using exisitng wizard properties
      // TODO: Dont remake this class if it has already been created
      var facadeModel = {
        package: 'FacadeWizardlet',
        name: this.wizardletId,
        properties: [
          ...this.capabilityIds.map(element => {
            let wi;
            if ( ! this.wizardlets_[element] ) {
              this.wizardlets_[element] = wi = x.wizardlets.find(w => w.id === element);
              if ( ! wi ) console.error('Cant find wizardlet with id', wi);
            } else {
              wi = this.wizardlets_[element];
            }
            // If the facade is set up to override view rebind the data so that the view uses correct wizardlet data
            if ( this.facadeModelOverrides[element]?.view ) {
              view = this.facadeModelOverrides[element].view;
              this.facadeModelOverrides[element].view = function(args, X) {
                args.data$ = wi.data$;
                return foam.u2.ViewSpec.createView(view, args, wi, X);
              }
            }
            return {
              name: this.createPropertyName(element),
              class: 'FObjectProperty',
              autoValidate: true,
              label: '',
              of: wi.of,
              view: (args, X) => {
                // This actually links the data of this property to the data of the wizardlet it is based of
                // This is really handy as it removes the need for extra LoaderInjectorSavers
                // Rebind wizardlet context to the current view context
                wi.__subSubContext__ = X.createSubContext({ data$: wi.data$ });
                return wi.sections[0].createView();
              },
              ...(this.facadeModelOverrides[element] ?? {})
            }
          }),
          {
            class: 'Array',
            name: 'realWizardlets',
            hidden: true,
            transient: true
          },
          ...(this.additionalFacadeProperties ?? [])
        ],
        methods: [
          function init() {
            let status = '';
            Object.keys(self.wizardlets_).forEach(v => {
              // console.log(v, self.wizardlets_[v].getDataUpdateSub(), (self.wizardlets_[v].getDataUpdateSub()).$UID);
              let w = self.wizardlets_[v];
              this.onDetach(w.getDataUpdateSub().sub(() => {
                // console.log('Updating facade prop', v, this[self.createPropertyName(v)], w.data);
                this[self.createPropertyName(v)] = w.data;
                // Need to do this manually since wizardlet data are FObjectProperties and the change is not made to the FObjectProperty itself
                // but some nested property of it
                this.pub('propertyChange', self.createPropertyName(v), this[self.createPropertyName(v)+'$']);
              }))
            });
            if ( status ) this.status = status;
          }
        ]
      };

      facadeClass = foam.lang.Model.create(facadeModel).buildClass(x);
      foam.register(facadeClass);
      facadeWizardlet.of = facadeClass;
      facadeWizardlet.wizardlets = this.wizardlets_;

      var altAction = this.AlternateFlowAction.create({ alternateFlow: {
        class: 'foam.u2.wizard.AlternateFlow',
        name: 'goNext',
        label: 'Next',
        invisible: this.capabilityIds
      }});
      if ( altAction.canSkipData ) {
        altAction.isEnabled = function(isLoading_) { return !isLoading_ };
      }
      facadeWizardlet.dynamicActions.push(altAction);

      // Add a create loader in order to init the wizardlet data
      // TODO: Add loaders that can load data from the wizardlets directly
      facadeWizardlet.wao.loader = {
        class: 'foam.u2.wizard.wizardflow.AddFacadeWizardlet.FacadeLoader',
        spec: { class: facadeClass.id, realWizardlets: self.wizardlets_ }
      }

      facadeWizardlet.wao.saver = {
        class: 'foam.u2.wizard.wizardflow.AddFacadeWizardlet.FacadeSaver',
        realWizardlets: self.wizardlets_
      }

      return facadeWizardlet;
    },

  ]
});
