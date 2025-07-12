/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch.lab',
  name: 'CrunchLab',
  extends: 'foam.u2.Controller',

  implements: [
    'foam.mlang.Expressions',
    'foam.u2.memento.Memorable'
  ],

  css: `
    ^ {
      padding: 32px;
    }
    ^ svg {
      display: inline-block;
    }
    ^ .foam-u2-view-RichChoiceView-selection-view {
      width: 30vw;
    }
    ^ .foam-u2-Tabs-tabRow {
      margin-bottom: 30px;
    }
    ^ .foam-u2-Tabs-content > div > div {
      display: inline-flex;
      vertical-align: text-bottom;
      margin-right: 20px;
    }
  `,

  imports: [
    'capabilityDAO',
    'memento',
    'userCapabilityJunctionDAO'
  ],

  exports: [
    'sequenceReferenceDAO'
  ],

  requires: [
    'foam.dao.PromisedDAO',
    'foam.graph.GraphBuilder',
    'foam.graph.map2d.RelationshipGridPlacementStrategy',
    'foam.core.crunch.AgentCapabilityJunction',
    'foam.core.crunch.Capability',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.u2.Tab',
    'foam.u2.crunch.lab.CapabilityGraphNodeView',
    'foam.u2.borders.SideViewBorder',
    'foam.u2.PropertyBorder',
    'foam.u2.view.RichChoiceSummaryIdRowView',
    'foam.u2.svg.TreeGraph',
    'foam.u2.svg.graph.DAGView',
    'foam.u2.svg.map2d.IdPropertyPlacementPlanDecorator',
    'foam.u2.Tabs'
  ],

  messages: [
    { name: 'ALL_TAB', message: 'All Capabilities' },
    { name: 'UCJ_TAB', message: 'User-Capability Junction' },
  ],

  properties: [
    {
      class: 'Reference',
      name: 'crunchUser',
      label: 'User',
      shortName: 'u',
      memorable: true,
      of: 'foam.core.auth.User',
      help: `User reference used to populate UCJ data on capability graph.
          This user references the sourceId/owner of a user capability junction.`,
      view: function(_, X) {
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          allowClearingSelection: true,
          rowView: { class: 'foam.u2.view.RichChoiceSummaryIdRowView' },
          sections: [
            {
              heading: 'Users',
              dao: X.userDAO
            }
          ]
        };
      },
      postSet: function(o, n) {
        if ( ! n ) this.clearProperty('effectiveUser');
      }
    },
    {
      class: 'Reference',
      name: 'effectiveUser',
      memorable: true,
      of: 'foam.core.auth.User',
      help: `User reference used to further filter capabilities listed for rootCapability.
          This user references the effectiveUser of a capabilityJunction.`,
      view: function(_, X) {
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          allowClearingSelection: true,
          rowView: { class: 'foam.u2.view.RichChoiceSummaryIdRowView' },
          sections: [
            {
              heading: 'Users',
              dao: X.userDAO
            }
          ]
        };
      },
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'filteredCapabilityDAO',
      hidden: true,
      expression: function (showAllCapabilities, effectiveUser, crunchUser) {
        if ( crunchUser == 0 || showAllCapabilities) return this.capabilityDAO;
        let predicate = effectiveUser ?
            this.AND(
              this.EQ(this.AgentCapabilityJunction.SOURCE_ID, crunchUser),
              this.EQ(this.AgentCapabilityJunction.EFFECTIVE_USER, effectiveUser)
            ) :
            this.EQ(this.UserCapabilityJunction.SOURCE_ID, crunchUser);
        return this.PromisedDAO.create({
          of: 'foam.core.crunch.Capability',
          promise: this.userCapabilityJunctionDAO.where(predicate)
            .select(this.MAP(this.UserCapabilityJunction.TARGET_ID))
            .then((sink) => {
              let capabilities = sink.delegate.array ? sink.delegate.array : [];
              return this.capabilityDAO.where(
                this.IN(this.Capability.ID, capabilities.flat())
              );
            })
        });
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'featuredCapabilityDAO',
      hidden: true,
      expression: function (filteredCapabilityDAO) {
        return filteredCapabilityDAO.where(this.CONTAINS(this.Capability.KEYWORDS, "featured"))
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'otherCapabilityDAO',
      hidden: true,
      expression: function (filteredCapabilityDAO) {
        return filteredCapabilityDAO.where(this.NOT(this.CONTAINS(this.Capability.KEYWORDS, "featured")))
      }
    },
    {
      class: 'Reference',
      name: 'rootCapability',
      of: 'foam.core.crunch.Capability',
      shortName: 'rc',
      memorable: true,
      help: `Root capability reference used to populate graph.
          Graph renders prerequisites downward of the selected capabilty.`,
      view: function(_, X) {
        const self = X.data;
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          allowClearingSelection: true,
          rowView: { class: 'foam.u2.view.RichChoiceSummaryIdRowView' },
          sections: [
            {
              heading: 'Store Capabilities',
              dao$: self.featuredCapabilityDAO$
            },
            {
              heading: 'Other Capabilities',
              dao$: self.otherCapabilityDAO$
            }
          ]
        };
      },
      menuKeys: ['admin.capabilities']
    },
    {
      class: 'Boolean',
      name: 'showAllCapabilities',
      value: true,
      help: `Toggles dropdown list to contain all capabilities instead
          of a filtered list based on user selections`
    },
    {
      name: 'relation',
      class: 'String',
      value: 'prerequisites'
    },
    { class: 'Boolean', name: 'sideVisible' },
    { class: 'foam.u2.ViewSpec', name: 'sideView' },
    {
      class: 'foam.dao.DAOProperty',
      name: 'sequenceReferenceDAO',
      factory: function () {
        return this.createSequenceReferenceDAO_();
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'capabilityExperimentView',
      value: {
        class: 'foam.u2.crunch.lab.CapabilityExperimentView'
      }
    }
  ],

  methods: [
    function render() {
      this
        .addClass(this.myClass())
        .start(this.SideViewBorder, {
          sideVisible$: this.sideVisible$,
          sideView$: this.sideView$
        })
          .start('h2').add(this.cls_.name).end()
          .start(this.Tabs)
            .start(this.Tab, {
              label: this.ALL_TAB,
              selected: ! this.crunchUser
            })
              .tag(this.ROOT_CAPABILITY.__, { data: this })
              .start().style({ display: 'block' }).add(this.getGraphSlot()).end()
            .end()
            .start(this.Tab, {
              label: this.UCJ_TAB,
              selected: !! this.crunchUser
            })
              .startContext({ data: this })
                .tag(this.ROOT_CAPABILITY.__)
                .tag(this.CRUNCH_USER.__)
                .tag(this.EFFECTIVE_USER.__)
                .tag(this.SHOW_ALL_CAPABILITIES.__)
              .endContext()
              .start().style({ display: 'block' }).add(this.getGraphSlot(true)).end()
            .end()
          .end()
        .end()
        ;

    },
    function getGraphSlot(replaceWithUCJ) {
      var self = this;
      return this.slot(function (rootCapability, crunchUser, relation) {
        if ( ! rootCapability ) return this.E();
        var graphBuilder = self.GraphBuilder.create();

        // Having these variables here makes promise returns cleaner
        var rootCapabilityObj = null;
        var placementPlan = null;
        var graph = null;

        return self.rootCapability$find
          .then(o => {
            rootCapabilityObj = o;
            return graphBuilder.fromRelationship(o, self.relation)
          })
          .then(() => {
            graph = graphBuilder.build();
            return self.RelationshipGridPlacementStrategy.create({
              graph: graph,
            }).getPlan();
          })
          .then(placementPlan_ => {
            placementPlan = placementPlan_;
            if ( replaceWithUCJ ) {
              capabilityIds = Object.keys(graph.data);
              return self.userCapabilityJunctionDAO.where(self.AND(
                self.IN(self.UserCapabilityJunction.TARGET_ID, capabilityIds),
                self.OR(
                  self.EQ(self.UserCapabilityJunction.SOURCE_ID, this.crunchUser),
                  self.EQ(self.UserCapabilityJunction.SOURCE_ID, this.effectiveUser),
                  self.AND(
                    self.EQ(self.AgentCapabilityJunction.SOURCE_ID, this.crunchUser),
                    self.EQ(self.AgentCapabilityJunction.EFFECTIVE_USER, this.effectiveUser)
                  )
                )
              )).select().then(r => {
                r.array.forEach(ucj => {
                  let capability = graph.data[ucj.targetId].data;
                  graph.data[ucj.targetId].data = [
                    capability, ucj
                  ];
                })
              })
            }
          })
          .then(() => {
            placementPlan = this.IdPropertyPlacementPlanDecorator.create({
              delegate: placementPlan,
              targetProperty: 'id'
            });
            globalThis._testing = {};
            globalThis._testing.placementPlan = placementPlan;
            globalThis._testing.graph = graph;
            return this.E()
              .tag(self.DAGView, {
                gridPlacement: placementPlan,
                graph: graph,
                nodeView: {
                  class: this.CapabilityGraphNodeView.id,
                  capabilityClickedListener: self.capabilityClicked,
                  ucjClickedListener: self.ucjClicked
                },
                cellSize: [200, 200],
                zoom: 0.7
              })
              ;
          });
      });
    },
    function createSequenceReferenceDAO_() {
      const dao = foam.dao.MDAO.create({
        of: 'foam.u2.crunch.lab.SequenceReference'
      });

      const values = [
        { class: 'foam.u2.crunch.lab.ServiceMethodSequenceReference',
          label: 'Transient Wizard',
          service: 'crunchController',
          method: 'createTransientWizardSequence' },
        { class: 'foam.u2.crunch.lab.ServiceMethodSequenceReference',
          label: 'User-Capability Wizard',
          service: 'crunchController',
          method: 'createWizardSequence' }
      ]

      values.
        map(v => foam.json.parse(v, undefined, this.__subContext__)).
        forEach(obj => dao.put(obj));

      return dao;
    }
  ],

  listeners: [
    function capabilityClicked(capability) {
      this.sideView = {
        ...this.capabilityExperimentView,
        data: capability
      }
      this.sideVisible = true;
    },
    function ucjClicked(ucj) {
      this.sideView = {
        class: 'foam.u2.detail.TabbedDetailView',
        data: ucj
      }
      this.sideVisible = true;
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.crunch.lab',
  name: 'UserCrunchRefine',
  refines: 'foam.core.auth.User',

  actions: [
    {
      name: 'openCrunchLab',
      availablePermissions: ['menu.read.crunch.crunchlab'],
      code: async function(X) {
        let menu = await X.menuDAO?.find('crunch.crunchlab');
        if ( ! menu ) X.notify('Crunch Lab not found', '', 'ERROR');
        let group = await this.group$find;
        X.routeTo(`${menu.id}?rc=${group.generalCapability}&u=${this.id}`)
      }
    }
  ]
})
