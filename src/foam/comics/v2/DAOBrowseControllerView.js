/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v2',
  name: 'DAOBrowseControllerView',
  extends: 'foam.u2.View',

  mixins: ['foam.u2.memento.Memorable'],

  documentation: `
    The inline DAO controller for a collection of instances of a model that can
    switch between multiple views
  `,

  imports: [
    'auth',
    'currentMenu?',
    'stack'
  ],

  exports: [
    'config',
    'click',
    'route as currentControllerMode',
    'setControllerMode'
  ],

  requires: [
    'foam.comics.v2.DAOBrowserView',
    'foam.u2.borders.CardBorder',
    'foam.u2.layout.Cols',
    'foam.u2.layout.Rows',
    'foam.u2.stack.BreadcrumbView',
    'foam.u2.stack.StackBlock',
    'foam.u2.view.IconChoiceView',
    'foam.u2.view.OverlayActionListView'
  ],

  cssTokens: [
    {
      name: 'borderSize',
      value: '1px solid'
    },
    {
      name: 'boxShadowSize',
      value: '0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1)'
    }
  ],

  css: `
    <<container {
      padding: 36px 16px 8px 16px;
      height: 100%;
      box-sizing: border-box;
    }

    <<header-container {
      padding-bottom: 32px;
      align-items: center;
    }

    <<altview-container {
      padding: 12px 16px;
    }

    <<buttons{
      margin-right: 8px;
    }

    << .foam-u2-borders-CardBorder {
      border: $borderSize;
      border-radius: 4px;
      box-sizing: border-box;
      box-shadow: $boxShadowSize;
      height: 100%;
      padding: 0;
    }

    @media only screen and (min-width: 768px) {
      <<container {
        padding: 24px 32px 16px 32px;
      }
    }
  `,

  messages: [
    { name: 'VIEW_ALL', message: 'View all ' },
    { name: 'ACTIONS',  message: 'Actions' }
  ],

  properties: [
    {
      name: 'translationService',
      factory: function() {
        return this.__context__.translationService || foam.i18n.NullTranslationService.create(); }
    },
    {
      name: 'route',
      documentation: 'Current controller mode',
      memorable: true,
      value: 'browse'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config',
      factory: function() {
        return this.onDetach(foam.comics.v2.DAOControllerConfig.create({dao: this.data}));
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'browseView',
      expression: function(config$browseViews) {
        return config$browseViews && config$browseViews.length
          ? config$browseViews[0].view
          : this.DAOBrowserView
          ;
      }
    },
    {
      class: 'Boolean',
      name: 'showNav',
      value: true
    },
    {
      name: 'viewTitle',
      expression: function(config) {
        var menuID = this.currentMenu ? this.currentMenu.id : config.of.id;
        return this.translationService.getTranslation(foam.locale, menuID + '.browseTitle', config.browseTitle);
      }
    },
    {
      name: 'click',
      expression: function(config$click) {
        if (this.config.disableSelection) {
          return () => {};
        }
        if ( this.config.click && typeof this.config.click === 'function' )
          return this.config.click;
        // This function is exported and is not always called with the 'this' being the current view
        // which is why we need to fetch config from subContext
        return function(obj, id) {
          if ( ! this.stack && ! this.__subContext__.stack ) {
            console.warn('Missing stack, can not push view');
            return;
          }
          this.__subContext__.setControllerMode('view');
          (this.stack || this.__subContext__.stack).push(foam.u2.stack.StackBlock.create({
            view: {
              class: 'foam.comics.v2.DAOSummaryView',
              data: obj,
              config: this.config || this.__subContext__.config,
              idOfRecord: id,
              title: 'View ' + obj.cls_.name + ' ' + id,
            }, parent: this.__subContext__ }, this));
        };
      }
    }
  ],

  actions: [
    {
      name: 'create',
      isEnabled: function(config, data) {
        if ( config.CRUDEnabledActionsAuth && config.CRUDEnabledActionsAuth.isEnabled ) {
          try {
            let permissionString = config.CRUDEnabledActionsAuth.enabledActionsAuth.permissionFactory(foam.core.dao.Operation.CREATE, data);

            return this.auth.check(null, permissionString);
          } catch(e) {
            return false;
          }
        }
        return true;
      },
      isAvailable: function(config) {
        try {
          return config.createPredicate.f();
        } catch(e) {
          return false;
        }
      },
      code: function(x) {
        if ( ! this.stack ) return;

        if ( this.config.createController.class === 'foam.comics.v2.DAOCreateView' ) {
          this.stack.push(this.StackBlock.create({
            view: {
              class: this.config.createController.class,
              data: (this.config.factory || this.data.of).create({ mode: 'create'}, this),
              config$: this.config$,
              title: 'Create ' + this.data.of.id,
              of: this.data.of
            }, parent: this,
            popup: this.config.createPopup
          }));
        } else if ( this.config.createControllerView ) {
          this.stack.push(this.StackBlock.create({ view: this.config.createControllerView, parent: this, popup: this.config.createPopup }));
        } else {
          this.stack.push(this.StackBlock.create({
            view: {
              class: this.config.createController.class,
              config$: this.config$,
              of: this.data.of,
              data: this.selection,
              title: 'Create ' + this.data.of.id,
              detailView: this.config.detailView.class,
              menu: this.config.menu,
              controllerMode: foam.u2.ControllerMode.CREATE,
              isEdit: true
            }, parent: this,
            popup: this.config.createPopup
          }));
        }
      }
    }
  ],

  methods: [
    function setControllerMode(mode) {
      this.route = mode;
    },
    async function render() {
      this.SUPER();

      var self = this;
      var translationService = this.translationService;

      // TODO: Refactor DAOBrowseControllerView to be the parent for a single DAO View
      // Right now each view controls it's own controller mode
      if ( this.route == 'view' || this.route == 'edit' ) {
        let b       = this.memento_.createBindings(this.memento_.tailStr);
        let idCheck = false;
        let obj     = null;
        if ( b.length && b[0][0] == 'route' && b[0][1] ) {
          obj = await this.data.find(b[0][1]);
          idCheck = !! obj;
        }
        if ( idCheck ) {
          self.click.call(this, obj, b[0][1]);
        } else {
          this.route = 'browse';
        }
      } else {
        this.route = 'browse';
      }

      var menuId = this.currentMenu ? this.currentMenu.id : this.config.of.id;
      var nav = this.showNav ? self.BreadcrumbView : '';
      this.addClass()

      .add(this.slot(function(data, config, config$browseBorder, config$browseViews, config$browseTitle, config$primaryAction, config$createTitle, config$createControllerView) {
        return self.E()
          .start(self.Rows)
            .addClass(self.myClass('container'))
              .start()
                .addClass(self.myClass('header-container'))
                .tag(nav)
                .start(self.Cols)
                  .start()
                    .addClass('h100', self.myClass('browse-title'))
                    .translate(menuId + ".browseTitle", config$browseTitle)
                  .end()
                  .start(self.Cols)
                    .add(this.slot(function(config$browseContext) {
                      return this.E()
                        .callIf(config$browseViews.length > 1 , function() {
                          this.addClass(self.myClass('buttons')).start(self.IconChoiceView, {
                              choices: config$browseViews.map(o => [o.view, o.icon, o.name]),
                              data$: self.browseView$
                            })
                              .addClass(self.myClass('altview-container'))
                            .end();
                        })
                        .callIf( config.browseActions.length && config.browseContext, function() {
                          if ( config.browseActions.length > 2 ) {
                            this.start(self.OverlayActionListView, {
                              label: this.ACTIONS,
                              data: config.browseActions,
                              obj: config$browseContext
                            }).addClass(self.myClass('buttons')).end();
                          } else {
                            var actions = this.E().addClass(self.myClass('buttons')).startContext({ data: config.browseContext });
                            for ( action of config.browseActions ) {
                              actions.tag(action, { size: 'LARGE' });
                            }
                            this.add(actions.endContext());
                          }
                        });
                    }))
                    .callIf( ! config.detailView && ! ( config.createControllerView || config$primaryAction ), function() {
                      this.startContext({ data: self })
                        .tag(self.CREATE, {
                            label: translationService.getTranslation(foam.locale, menuId + '.createTitle', config$createTitle),
                            buttonStyle: foam.u2.ButtonStyle.PRIMARY,
                            size: 'LARGE'
                        })
                      .endContext()
                    })
                    .callIf( config.createControllerView, function() {
                      this.startContext({ data: self })
                        .tag(self.CREATE, {
                            label: translationService.getTranslation(foam.locale, menuId + '.handler.createControllerView.view.title', config$createControllerView.view.title),
                            buttonStyle: foam.u2.ButtonStyle.PRIMARY,
                        })
                      .endContext();
                    })
                    .callIf( config$primaryAction, function() {
                      this.startContext({ data: self }).tag(config$primaryAction, { size: 'LARGE', buttonStyle: 'PRIMARY' }).endContext();
                    })
                    .callIf( config.createMenu, async function() {
                      let menu = await config.createMenu$find;
                      if ( ! menu ) return;
                      this.startContext({ data: self }).tag(menu, { size: 'LARGE', buttonStyle: 'PRIMARY' }).endContext();
                    })
                  .end()
                .end()
              .end()
            .start(self.CardBorder)
              .style({ position: 'relative', 'min-height': config.minHeight + 'px' })
              .start(config$browseBorder)
                .call(function() {
                  this.add(self.slot(function(browseView) {
                    return self.E().tag(browseView, { data: data, config: config } );
                  }));
                })
              .end()
            .end()
          .end();
      }));
    }
  ]
});
