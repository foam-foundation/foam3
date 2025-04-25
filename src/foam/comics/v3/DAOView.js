/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.comics.v3',
  name: 'DAOView',
  extends: 'foam.u2.View',

  imports: [
    'auth',
    'config as importedConfig',
    'stack'
  ],

  requires: [
    'foam.comics.v2.DAOBrowserView'
  ],

  cssTokens: [
    {
      name: 'borderSize',
      value: '2px solid $grey200'
    },
    {
      name: 'boxShadowSize',
      value: 'none'
    }
  ],

  css: `
    ^ .foam-u2-borders-CardBorder {
      border: none;
      border-radius: 4px;
      box-sizing: border-box;
      box-shadow: $boxShadowSize;
      height: 100%;
      padding: 0;
    }
  `,

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config',
      factory: function() {
        return this.importedConfig ?? this.onDetach(foam.comics.v2.DAOControllerConfig.create({dao: this.data}));
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
    }
  ],

  methods: [
    async function render() {
      this.SUPER();
      var self = this;
      (this.config.createMenu ? this.config.createMenu$find : new Promise(res => res())).then(v => {
        this.onDetach(this.stack.setTrailingContainer(
          this.E()
            .callIfElse(v, function() {
              this.startContext({ data: self }).tag(v, { buttonStyle: 'PRIMARY', size: 'LARGE' }).endContext();
            }, function() {
              let createAction = self.config.of.getAxiomByName('create');
              if ( createAction && foam.comics.v3.ComicsAction.isInstance(createAction) ) {
                createAction = self.CREATE.clone(self).copyFrom({ ...createAction })
              } else {
                createAction = self.CREATE;
              }
              this.startContext({ data: self })
                .tag(createAction, { label$: self.config$.dot('createTitle'), size: 'LARGE' })
              .endContext()
            })
        ))
      });
      this
        .addClass()  
        .start(this.config.browseBorder)
        .style({ position: 'relative', 'min-height': this.config.minHeight + 'px'})
            .add(self.slot(function(browseView) {
              return self.E().tag(browseView, { data: this.data, config: this.config } );
            }))
        .end();
    }
  ],

  actions: [
    {
      class: 'foam.comics.v3.ComicsAction',
      name: 'create',
      buttonStyle: 'PRIMARY',
      internalIsEnabled: function(config, data) {
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
      internalIsAvailable: function(config) {
        try {
          return config.createPredicate.f();
        } catch(e) {
          return false;
        }
      },
      code: function(x) {
        x.daoController.route = 'create';
      }
    }
  ],
});