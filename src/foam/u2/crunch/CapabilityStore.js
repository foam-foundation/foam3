/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.crunch',
  name: 'CapabilityStore',
  extends: 'foam.u2.View',

  implements: [
    'foam.mlang.Expressions'
  ],
  mixins: ['foam.u2.Router'],

  requires: [
    'foam.dao.ArrayDAO',
    'foam.dao.NullDAO',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityCategory',
    'foam.core.crunch.CapabilityCategoryCapabilityJunction',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.u2.ControllerMode',
    'foam.u2.crunch.wizardflow.CapabilityStoreAgent',
    'foam.u2.Element',
    'foam.u2.Tab',
    'foam.u2.Tabs',
    'foam.u2.UnstyledTabs',
    'foam.u2.crunch.CapabilityCardView',
    'foam.u2.crunch.CapabilityFeatureView',
    'foam.u2.layout.Grid',
    'foam.u2.layout.GUnit'
  ],

  imports: [
    'auth',
    'ctrl',
    'capabilityCategoryCapabilityJunctionDAO',
    'capabilityCategoryDAO',
    'capabilityDAO',
    'crunchController',
    'crunchService',
    'menuDAO',
    'pushMenu?',
    'registerElement',
    'subject',
    'theme',
    'window',
    'themeDomainDAO'
  ],

  messages: [
    { name: 'TAB_ALL', message: 'All' },
    { name: 'TITLE', message: 'Features' },
    { name: 'SUBTITLE', message: 'Unlock more features on {appName}' },
    { name: 'EDITABLE', message: 'Edit existing information' }
  ],

  css: `
    ^ {
      margin: auto;
      padding: 12px 24px 24px 24px;
      -webkit-box-sizing: border-box;
      box-sizing: border-box;
    }

    ^label-title {
      margin: 24px 16px;
      margin-bottom: 8px;
    }

    ^label-subtitle {
      margin: 16px;
      margin-top: 0;
      color: $textTertiary;
    }

    ^category {
      margin-top: 48px;
      padding: 0px 12px;
    }

    ^feature-column-grid {
      display: inline-flex;
      width: calc(100% - 48px);
      overflow-x: auto;
    }

    ^featureSection {
      flex: 0;
      height: auto;
    }

    ^perFeature {
      display: flex;
    }

    ^left-arrow {
      width: 24px;
      height: 24px;
      float: left;
      display: flex;
      cursor: pointer;
      padding-top: 70px;
      -webkit-transition: padding 2s;
    }

    ^right-arrow {
      width: 24px;
      height: 24px;
      float: right;
      display: flex;
      cursor: pointer;
      padding-top: 70px;
      margin-left: -20px;
      z-index: 10000;
      position: relative;
      -webkit-transition: padding 2s;
    }

    ^container {
      display: inline-block;
      width: 100%;
      height: fit-content;
      overflow-y: visible;
      margin-top: 24px;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'viewTitle',
      factory: function() {
        return this.TITLE;
      }
    },
    {
      name: 'visibleCapabilityDAO',
      class: 'foam.dao.DAOProperty',
      documentation: `
        DAO with only visible capabilities.
      `,
      factory: function() {
        return this.NullDAO.create();
      }
    },
    {
      name: 'featuredCapabilities',
      class: 'foam.dao.DAOProperty',
      documentation: `
        DAO Property to find capabilities to feature.
      `,
      expression: function(visibleCapabilityDAO) {
        return visibleCapabilityDAO
          .where(this.IN('featured', this.Capability.KEYWORDS));
      }
    },
    {
      name: 'themeDomain',
      expression: function(themeDomainDAO, window) {
        return themeDomainDAO
          .find(this.window.location.hostname);
      }
    },
    {
      name: 'visibleCategoryDAO',
      class: 'foam.dao.DAOProperty',
      documentation: `
        DAO Property to find categories that are visible.
      `,
      expression: function(capabilityCategoryDAO) {
        return capabilityCategoryDAO
          .where(this.EQ(this.CapabilityCategory.VISIBLE, true));
      }
    },
    {
      name: 'carouselCounter',
      class: 'Int',
      documentation: 'left and right scroll counter for featureCardArray index'
    },
    {
      name: 'totalNumCards',
      class: 'Int',
      documentation: 'should be equivalent to featureCardArray.length'
    },
    {
      name: 'featureCardArray',
      value: [],
      documentation: 'stores the styling of each featureCapability'
    },
    {
      name: 'cardsOverflow',
      class: 'Boolean'
    },
    {
      name: 'junctions',
      factory: () => []
    },
    'wizardOpened'
  ],

  methods: [
    function init() {
      this.SUPER();
      this.addCrumb();
      this.onDetach(this.stack?.setTitle(this.viewTitle$, this));
      this.crunchService.getAllJunctionsForUser().then(juncs => {
        this.junctions = juncs;
        this.daoUpdate();
      });
      this.crunchService.getEntryCapabilities().then(a => {
        this.visibleCapabilityDAO = this.ArrayDAO.create({
          array: a.array
        });
      });
    },
    function render() {
      this.SUPER();
      this.onDetach(this.crunchService.sub('grantedJunction', this.onChange));
      var self = this;

      self
        .addClass(self.myClass())
        .start('p').addClass('h100', this.myClass('label-title'))
          .add(this.TITLE)
        .end()
        .start('p').addClass('p-lg', this.myClass('label-subtitle'))
          .add(this.SUBTITLE.replace('{appName}', this.theme.appName))
        .end()
        .add(this.slot(async function(junctions, featuredCapabilities, themeDomain) {
          var themeCaps =  await themeDomain?.then(function(ret) {
            return ret?.getCapabilities(self.ctrl.__subContext__).dao.select();
          });
          if ( themeCaps?.array?.length != 0 ) return self.renderFeatured(themeCaps.array);
          var featured = await this.featuredCapabilities.select();
          return self.renderFeatured(featured.array);
        }))
        // NOTE: TEMPORARILY REMOVED
        // .add(self.accountAndAccountingCard())
        // .start(self.Tabs)
        //   .start(self.Tab, { label: this.TAB_ALL, selected: true })
        //     .add(self.renderFeatured())
        //     .add(self.accountAndAccountingCard())
        //   .end()
        //   // TODO: replace this .call with a .select once
        //   //       duplication error is fixed
        //   .call(function() {
        //     self.visibleCategoryDAO.select().then(a => {
        //       for ( let i = 0 ; i < a.array.length ; i++ ) {
        //         let category = a.array[i];
        //         let e = self.Tab.create({ label: category.name })
        //           .add(self.renderCategorySection(category));
        //         this.add(e);
        //       }
        //     });
        //   })
        .end();
    },

    function renderFeatured(arr) { // Featured Capabilities in carousel view
      var self = this;
      var spot = self.E();
        self.totalNumCards = arr.length;
        self.featureCardArray = [];
        for ( let i = 0 ; i < self.totalNumCards ; i++ ) { // build featured cards as elements
          self.featureCardArray.push(
            () => self.Element.create().start()
              .addClass(self.myClass('perFeature'))
              .start(self.CapabilityFeatureView, { data: arr[i] })
                .addClass(self.myClass('featureSection'))
              .end()
              .on('click', () => {
                self.openWizard(arr[i], true);
              })
            .end());
        }

        spot.start().start('span')
          .start('img').addClass(self.myClass('left-arrow')).show(this.cardsOverflow$)
            .attr('src', 'images/arrow-back-24px.svg')
            .on('click', function() {
              self.carouselCounter--;
            })
          .end()
        .end();
        var ele;
        async function checkCardsOverflow(evt) {
          var el = await ele.el();
          self.cardsOverflow = el.scrollWidth > el.clientWidth;
        }
        spot.add(self.slot(
          function(carouselCounter, totalNumCards) {
            ele = self.E().addClass(self.myClass('feature-column-grid'));
            for ( var k = 0 ; k < totalNumCards ; k++ ) {
              let cc = carouselCounter % totalNumCards; // this stops any out of bounds indecies
              let index = ( cc + totalNumCards + k ) % totalNumCards; // this ensures circle indecies
              ele = ele.add(self.featureCardArray[index].call(self));
            }
            return ele;
          }));
        spot.start('span')
          .start('img').addClass(self.myClass('right-arrow')).show(this.cardsOverflow$)
            .attr('src', 'images/arrow-forward-24px.svg')
            .on('click', function() {
              self.carouselCounter++;
            })
          .end()
        .end();

        window.addEventListener('resize', checkCardsOverflow);
        checkCardsOverflow();
        self.onDetach(() => {
          window.removeEventListener('resize', checkCardsOverflow);
        });
      return spot;
    },

    function accountAndAccountingCard() {
      // Capability Store Section Previews
      var self = this;
      return self.E().style({ 'width': '94%', 'margin': 'auto '})
        .select(self.visibleCategoryDAO$proxy, function(category) {
          var sectionElement = this.E('span');
          var returnElement = this.E()
            .start('h3')
              .add({ data : category, clsInfo : category.cls_.NAME.name, default : category.name })
            .end()
            .add(sectionElement).addClass(self.myClass('category'));
          var previewIdsPromise = self.getCategoryDAO_(category.id).limit(6)
            .select().then(arraySink => arraySink.array.map(x => x.targetId) );

          previewIdsPromise.then(capabilityIds => {
            self.visibleCapabilityDAO.where(
              self.IN(self.Capability.ID, capabilityIds)
            ).select().then(result => {
              let arr = result.array;
              let grid = self.Grid.create();
              for ( let i = 0 ; i < arr.length ; i++ ) {
                let cap = arr[i];
                grid = grid
                  .start(self.GUnit, { columns: 4 })
                    .tag(self.CapabilityCardView, { data: cap })
                    .on('click', () => {
                      self.openWizard(cap, true);
                    })
                  .end();
              }
              sectionElement.add(grid);
            });
          });
          return returnElement;
        });
    },

    function renderCategorySection(category) {
      var self = this;
      var sectionElement = this.E();

      // Promise 'p' reports capability IDs that are in this category
      var p = self.getCategoryDAO_(category.id).select(
        self.PROJECTION(self.CapabilityCategoryCapabilityJunction.TARGET_ID));

      // When 'p' resolves, query all matching capabilities
      p.then(arraySink => {
        capabilityIds = arraySink.projection;
        self.visibleCapabilityDAO.where(
          self.IN(self.Capability.ID, capabilityIds)
        ).select().then(result => {
          let arr = result.array;
          let grid = self.Grid.create();
          for ( let i = 0 ; i < arr.length ; i++ ) {
            let cap = arr[i];
            grid = grid
              .start(self.GUnit, { columns: 4 })
                .tag(self.CapabilityCardView, { data: cap })
                .on('click', () => {
                  self.openWizard(cap, false);
                })
              .end();
          }
          sectionElement.add(grid);
        });
      });
      return sectionElement;
    },

    function renderPredicatedSection(capPredicate, ucjPredicate) {
      var self = this;
      var sectionElement = this.E();

      // When 'p' resolves, query all matching capabilities
      self.visibleCapabilityDAO.where(capPredicate).select().then(result => {
        let arr = result.array;
        let grid = self.Grid.create();
        let addedFirstItem = false;
        for ( let i = 0 ; i < arr.length ; i++ ) {
          let cap = arr[i];
          let ucj = self.junctions.find(ucj => ucj.targetId == cap.id);
          if ( ! ucjPredicate.f(ucj) ) continue;
          if ( ! addedFirstItem ) {
            addedFirstItem = true;
            sectionElement
              .addClass(this.myClass('category'))
              // TODO: uncomment when UCJs are editable again
              // .start('h3').add(this.EDITABLE).end()
          }
          grid = grid
            .start(self.GUnit, { columns: 4 })
              .tag(self.CapabilityCardView, { data: cap })
              .on('click', () => {
                self.openWizard(cap, true);
              })
            .end();
        }
        sectionElement.add(grid);
      });
      return sectionElement;
    },

    function getCategoryDAO_(categoryId) {
      return this.capabilityCategoryCapabilityJunctionDAO.where(
        this.EQ(
          this.CapabilityCategoryCapabilityJunction.SOURCE_ID,
          categoryId));
    },
    function daoUpdate() {
      Promise.resolve()
        // Get visible categories
        .then(() => this.visibleCategoryDAO.select())
        .then(categorySink => categorySink.array.map(cat => cat.id))
        // Get capabilities within visible categories
        .then(categories => {
          return this.capabilityCategoryCapabilityJunctionDAO
            .where(this.IN(
              this.CapabilityCategoryCapabilityJunction.SOURCE_ID,
              categories)).select();
        })
        .then(cccjSink => Object.keys(
          cccjSink.array.map(cccj => cccj.targetId)
          .reduce((set, capabilityId) => ({ ...set, [capabilityId]: true }), {})))
        // Get visible capabilities within visible categories
        .then(visibleList => this.visibleCapabilityDAO
          .where(this.OR(
            this.IN(this.Capability.ID, visibleList),
            this.IN('featured', this.Capability.KEYWORDS)
          )).select())
        .then(async sink => {
          if ( sink.array.length !== 1 )
            return;

            let cap = sink.array[0];
            let ucj = await this.junctions.find(ucj => ucj.targetId == cap.id);
            if ( ucj && ( ucj.status == this.CapabilityJunctionStatus.GRANTED
              || ucj.status == this.CapabilityJunctionStatus.PENDING ) ) return;

            let x = this.ctrl.__subContext__;
            let capa = await this.crunchService.updateJunction(x, cap.id, null, this.CapabilityJunctionStatus.GRANTED);

            if ( capa.status != this.CapabilityJunctionStatus.GRANTED )
              this.openWizard(cap, false);
            else
              this.window.location.reload();
        })
    },
    async function openWizard(cap, showToast) {
      if ( this.wizardOpened ) return;
      this.wizardOpened = true;
      let ucj = await this.junctions.find(ucj => ucj.targetId == cap.id);
      let x = null;
      var editable = ! ucj ||  await this.crunchService.maybeReopen(this.ctrl.__subContext__, cap.id);
      if ( ! editable ) {
        x = this.__subContext__.createSubContext({
          controllerMode: this.ControllerMode.VIEW
        });
      }
      let runner = foam.u2.crunch.WizardRunner.create({
        source: cap,
        wizardType: 'UCJ'
      }, this);
      runner.sequence.reconfigure('CheckPendingAgent', { showToast: showToast });
      runner.sequence.add(this.CapabilityStoreAgent);
      await runner.launch();
      this.wizardOpened = false;
    }
  ],
  listeners: [
    {
      name: 'onChange',
      isMerged: true,
      mergeDelay: 2000,
      code: async function() {
        let a = await this.crunchService.getEntryCapabilities();
        this.visibleCapabilityDAO = this.ArrayDAO.create({
          array: a.array
        });
        let juncs = await this.crunchService.getAllJunctionsForUser();
        this.junctions = juncs;
        this.daoUpdate();
        // Attempting to reset menuDAO incase of menu permission grantings.
        this.menuDAO.cmd_(this, foam.dao.DAO.PURGE_CMD);
        this.menuDAO.cmd_(this, foam.dao.DAO.RESET_CMD);
        // Push default menu if menu changes
        this.pushMenu?.('');
      }
    }
  ]
});
