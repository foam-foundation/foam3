/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v3',
  name: 'DetailView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.Router'],

  documentation: `Detail view for displaying objects in comics 3 controller`,

  axioms: [
    foam.pattern.Faceted.create()
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.box.RPCErrorMessage',
    'foam.comics.v2.userfeedback.UserFeedbackException',
    'foam.u2.ActionReference',
    'foam.u2.ControllerMode',
    'foam.u2.layout.Cols',
    'foam.u2.layout.Rows',
    'foam.u2.dialog.ConfirmationModal',
    'foam.u2.dialog.Popup',
    'foam.u2.stack.BreadcrumbView',
    'foam.u2.stack.StackBlock'
  ],

  imports: [
    'auth?',
    'config? as importedConfig',
    'currentMenu?',
    'currentControllerMode?',
    'notify',
    'setControllerMode?',
    'stack?',
    'controlBorder',
    'daoController'
  ],

  exports: [
    'controllerMode',
    'as detailView',
    'exportStack as stack'
  ],

  topics: [
    'finished',
    'throwError'
  ],

  messages: [
    { name: 'UPDATED',   message: 'Updated' },
    { name: 'ERROR_MSG',   message: 'Something went wrong' }
  ],

  classes: [
    {
      name: 'Stack',
      extends: 'foam.core.u2.navigation.Stack',
      imports: ['detailView'],
      methods: [
        function push(v, p) {
          let ctx;
          if ( foam.u2.stack.StackBlock.isInstance(v) && v.parent) {
            ctx = foam.lang.FObject.isInstance(v.parent) ? v.parent.__subContext__: v.parent;
          } else {
            ctx = (foam.lang.FObject.isInstance(p) ? p.__subContext__: p) ?? v.__subContext__;
          }
          if ( this.detailView && this.detailView.stack.pos == this.detailView.__subContext__.stackPos ) {
            console.warn('***** Pushing inside detail view. Audit and maybe remove');
            this.detailView.route = ctx.prop?.name || ctx.action?.name;
          }
          return this.SUPER(...arguments);
        }
      ]
    }
  ],

  css: `
  `,

  properties: [
    {
      name: 'exportStack',
      factory: function() {
        return this.Stack.create({ delegate_: this.stack });
      }
    },
    {
      class: 'FObjectProperty',
      name: 'data',
      postSet: function(o, n) {
        if ( n ) {
          n.sub('action', this.loadData.bind(this, null))
        }
      }
    },
    {
      class: 'FObjectProperty',
      name: 'workingData',
      expression: function(data) {
        return data?.clone(this) ?? this.config.of.create({}, this);
      }
    },
    {
      class: 'Class',
      name: 'of',
      expression: function(currentData_, config$of) {
        return currentData_?.cls_ ?? config$of;
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config',
      factory: function() {
        return this.importedConfig || foam.comics.v2.DAOControllerConfig.create({}, this);
      }
    },
    {
      name: 'controllerMode',
      shortName: 'mode',
      memorable: true,
      factory: function() {
        return this.ControllerMode.VIEW;
      }
    },
    {
      name: 'primary',
      documentation: `Axiom to store the primary action of the 'of' model`
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'viewView',
      factory: function() {
        return this.config?.detailView ?? foam.u2.detail.TabbedDetailView;
      }
    },
    {
      name: 'idOfRecord',
      factory: function() {
        return this.data ? this.data.id : null;
      },
      adapt: function(_, id) {
        if ( id && foam.lang.MultiPartID.isInstance(this.config.of.ID) ) {
          id = this.config.of.ID.of.FROM_STRING(id, this.config.of.ID);
        }

        return id;
      }
    },
    { 
      name: 'actionArray',
      class: 'FObjectArray',
      of: 'foam.lang.Action'
    },
    'buttonGroup_',
    {
      class: 'String',
      name: 'viewTitle',
      expression: function(data) {
        var self = this;
        var maybePromise = data?.toSummary() ?? '';
        if ( maybePromise.then ) {
          maybePromise.then( v => { self.viewTitle = v })
          return '';
        }
        return maybePromise;
      }
    },
    {
      name: 'translationService',
      factory: function() {
        return this.__context__.translationService || foam.i18n.NullTranslationService.create({}, this);
      }
    },
    {
      name: 'currentData_',
      documentation: 'Active data property that stores current working data for the current view mode',
      value: null
    },
    {
      class: 'Map',
      name: 'actionsOverrides'
    }
  ],

  methods: [
    function init() {
      // This is needed to ensure data is available for the viewTitle
      let self = this;
      let loadLatch = foam.lang.Latch.create({}, this);
      this.SUPER();
      this.addCrumb();
      this.loadData(loadLatch);
      this.getActionsOverrides();
      this.onDetach(self.finished?.sub(this.loadData.bind(this, null)));
      loadLatch.promise.finally(() => {
        this.dynamic(function(controllerMode, data, workingData) {
          if ( controllerMode == 'EDIT' ) {
            self.currentData_ = workingData;
          } else {
            self.currentData_ = data;
          }
        });
      })
    },

    function render() {
      var self = this;
      this.stack?.setTitle(this.viewTitle$, this);
      this.SUPER();
      let d;
      this.onDetach(this.dynamic(function(currentData_, actionsOverrides){
        d?.detach?.();
        d = self.stack.setTrailingContainer(
          this.E().style({ display: 'contents' }).start(foam.u2.ButtonGroup, {
              // overrides: { size: 'SMALL' },
              overlaySpec: { obj: self, icon: '/images/Icon_More_Resting.svg', showDropdownIcon: false  }
            }, this.buttonGroup_$)
            .addClass(this.myClass('buttonGroup'))
            .add(self.slot(function(primary) {
              if ( ! primary ) return;
              return this.E()
                // .hide(self.controllerMode$.map(c => c == 'EDIT' ))
                .startContext({ data: self.currentData_$ })
                  .tag(primary, { buttonStyle: 'PRIMARY', size: 'SMALL' })
                .endContext();
            }))
            .startContext({ data: self })
              .tag(actionsOverrides.edit)
              .tag(actionsOverrides.save, { buttonStyle: 'PRIMARY'})
              .tag(self.CANCEL_EDIT)
            .endContext()
            .startOverlay()
              .tag(actionsOverrides.copy)
              .tag(actionsOverrides.delete)
            .endOverlay()
            .callIf(currentData_, function() { self.populatePrimaryAction(true) })
          .end()
        )
        self.onDetach(d);
      }))
      this.dynamic(function(route, data) {
        if ( ! data ) return;
        /*
          Only handle routing if detailView is currently visible as otherwise route changes
          are probably caused by sub views
        */
        if ( route && this.stack.pos == this.__subContext__.stackPos ) {
          let axiom = self.data[foam.String.constantize(route)];
          if ( foam.lang.Action.isInstance(axiom) ) {
            axiom.maybeCall(self.__subContext__.createSubContext({ action: axiom }), self.data);
            return;
          }
          // PropertyBorder handles routing so dont clear that as it hasn't been rendered yet
          if ( ! foam.lang.Property.isInstance(axiom) ) {
            // Otherwise just clear route for now
            self.routeToMe();
          }
        }
      })
      self
        .start(this.config.viewBorder)
          .start(this.viewView, {
            data$: self.currentData_$
          })
            .show(self.slot(function(cd, d) { return cd && d; }, self.currentData_$, self.data$).framed())
            .addClass(self.myClass('view-container'))
          .end()
        .end();
    }
  ],

  listeners: [
    {
      name: 'getActionsOverrides',
      on: ['this.propertyChange.of'],
      code: function() {
        let actionsOverrides = {};
        let comicsActions = this.of.getAxiomsByClass(foam.comics.v3.ComicsAction);
        if ( comicsActions.length ) {
          comicsActions?.forEach(v => {actionsOverrides[v.name] = v});
        }
        ['edit', 'delete', 'copy', 'save'].forEach(v => {
          let defaultAction = this[v.toUpperCase()];
          if ( ! actionsOverrides[v] ) {
            actionsOverrides[v] = defaultAction;
            return;
          }
          let newAction = defaultAction.clone(self).copyFrom(actionsOverrides[v]);
          if ( actionsOverrides[v].hasOwnProperty('code') )
            newAction.overrideCodeData$ = this.currentData_$;
          actionsOverrides[v] = newAction;
        })
        this.actionsOverrides = actionsOverrides;
      }
    },
    {
      name: 'populatePrimaryAction',
      isFramed: true,
      code: async function(rebuildArray) {
        if ( ! this.currentData_ ) return;
        let data = this.currentData_;
        var self = this;
        var allActions = this.of.getAxiomsByClass(foam.lang.Action).filter(v => ! foam.comics.v3.ComicsAction.isInstance(v));
        var defaultAction = allActions.filter((a) => a.isDefault);
        var acArray = [...defaultAction, ...allActions];
        let oldActions = rebuildArray ? [] : this.actionArray || [];
        if ( this.actionArray.length && ! rebuildArray ) {
          this.actionArray = foam.Array.unique(this.actionArray.concat(allActions));
        } else {
          this.actionArray = allActions;
        }
        if ( acArray && acArray.length ) {
          let res;
          for ( let a of acArray ) {
            var aSlot = a.createIsAvailable$(this.__subContext__, data);
            let b = aSlot.get();
            if ( aSlot.promise ) {
              await aSlot.promise;
              b = aSlot.get();
            }
            if (b) { res = a; break; }
          }
          this.primary = res;
          this.actionArray = this.actionArray.filter(v => v !== res);
        }
        if ( this.buttonGroup_ ) {
          let actionsToAdd = rebuildArray ? this.actionArray : foam.util.diff(oldActions ,this.actionArray).added || [];
          this.buttonGroup_
            .startOverlay()
            .forEach(actionsToAdd, function(v) {
              this.addActionReference(v, self.currentData_$)
            })
            .endOverlay()
        }
      }
    },
    {
      name: 'loadData',
      isIdled: true,
      delay: 100,
      code: function(latch) {
        let self = this;
        let id   = this.data?.id ?? this.idOfRecord;
        self.config.unfilteredDAO.inX(self.__subContext__).find(id).then(d => {
          if ( ! d ) {
            this.daoController.route = '';
            return;
          }
          self.data = d;
          self.data.setPrivate_('__context__', self.data.__context__.createSubContext({ controllerMode: this.controllerMode$ }));
          if ( this.controllerMode == 'EDIT' ) this.edit();
          this.populatePrimaryAction();
          latch && latch.resolve();
        });
      }
    }
  ],

  actions: [
    {
      class: 'foam.comics.v3.ComicsAction',
      name: 'edit',
      themeIcon: 'edit',
      icon: 'images/edit-icon.svg',
      size: 'SMALL',
      internalIsEnabled: function(config, data) {
        if ( config.CRUDEnabledActionsAuth && config.CRUDEnabledActionsAuth.isEnabled ) {
          try {
            let permissionString = config.CRUDEnabledActionsAuth.enabledActionsAuth.permissionFactory(foam.core.dao.Operation.UPDATE, data);

            return this.auth?.check(null, permissionString) && this.data;
          } catch(e) {
            return false;
          }
        }
        return this.data;
      },
      internalIsAvailable: function(config, controllerMode, data) {
        if ( controllerMode == 'EDIT' ) return false;
        try {
          return config.editPredicate.f(data);
        } catch(e) {
          return false;
        }
      },
      code: function() {
        this.controllerMode = 'EDIT';
      }
    },
    {
      class: 'foam.comics.v3.ComicsAction',
      name: 'copy',
      size: 'SMALL',
      internalIsEnabled: function(config, data) {
        if ( config.CRUDEnabledActionsAuth && config.CRUDEnabledActionsAuth.isEnabled ) {
          try {
            let permissionString = config.CRUDEnabledActionsAuth.enabledActionsAuth.permissionFactory(foam.core.dao.Operation.CREATE, data);

            return this.auth?.check(null, permissionString);
          } catch(e) {
            return false;
          }
        }
        return true;
      },
      internalIsAvailable: function(config, controllerMode, data) {
        if ( controllerMode == 'EDIT' ) return false;
        try {
          return config.copyPredicate.f(data);
        } catch(e) {
          return false;
        }
      },
      code: function() {
        if ( ! this.stack ) return;
        let newRecord = this.data.clone();
        // Clear PK so DAO can generate a new unique one
        newRecord.id = undefined;
        this.stack.push(this.StackBlock.create({
          view: {
            class: 'foam.comics.v2.DAOCreateView',
            data: newRecord,
            config: this.config,
            of: this.of
          }, parent: this }));
      }
    },
    {
      class: 'foam.comics.v3.ComicsAction',
      name: 'save',
      size: 'SMALL',
      internalIsEnabled: function(workingData$errors_) {
        return ! workingData$errors_;
      },
      internalIsAvailable: function(controllerMode) {
        return controllerMode == 'EDIT';
      },
      code: function() {
        return this.config.dao.put(this.workingData).then(o => {
          if ( ! this.data.equals(o) ) {
            this.data = o;
            this.finished.pub();
            this.config.dao.on.reset.pub();
            if ( foam.comics.v2.userfeedback.UserFeedbackAware.isInstance(o) && o.userFeedback ) {
              var currentFeedback = o.userFeedback;
              while ( currentFeedback ) {
                this.notify(currentFeedback.message, '', this.LogLevel.INFO, true);
                currentFeedback = currentFeedback.next;
              }
            } else {
              var menuId = this.currentMenu ? this.currentMenu.id : this.of.id;
              var title = this.translationService.getTranslation(foam.locale, menuId + '.browseTitle', this.config.browseTitle);

              this.notify(title + " " + this.UPDATED, '', this.LogLevel.INFO, true);
            }
          }
          this.cancelEdit();
        }, e => {
          this.throwError.pub(e);
          if ( foam.box.RPCErrorMessage.isInstance(e) ) {
            e = e.data
          }
          if ( this.UserFeedbackException.isInstance(e.exception)  ) {
            e = e.exception;
            var currentFeedback = e.userFeedback;
            let fn = this.notify.bind(this);
            if ( e.alertType.ordinal == 1 ) {
              fn = () => {
                this.ConfirmationModal.create({
                  title: this.ERROR_MSG, 
                  modalStyle: 'DESTRUCTIVE', 
                  primaryAction: { name: 'okay', buttonStyle: 'TEXT', code: function(X) { X.closeDialog(); }},
                  showCancel: false,
                  closeable: false 
                })
                  .add(e.userFeedback.message)
                  .open();
              }
            }
            while ( currentFeedback ) {
              fn(currentFeedback.message, '', this.LogLevel.ERROR, true);

              currentFeedback = currentFeedback.next;
            }
          } else {
            this.notify(e.message, '', this.LogLevel.ERROR, true);
          }
        });
      }
    },
    {
      name: 'cancelEdit',
      label: 'Cancel',
      size: 'SMALL',
      isAvailable: function(controllerMode) {
        return controllerMode == 'EDIT';
      },
      code: function() {
        // Reset working data to original data
        this.workingData = this.data.clone(this);
        this.controllerMode = 'VIEW';
      }
    },
    {
      class: 'foam.comics.v3.ComicsAction',
      name: 'delete',
      size: 'SMALL',
      internalIsEnabled: function(config, data) {
        if ( config.CRUDEnabledActionsAuth && config.CRUDEnabledActionsAuth.isEnabled ) {
          try {
            let permissionString = config.CRUDEnabledActionsAuth.enabledActionsAuth.permissionFactory(foam.core.dao.Operation.REMOVE, data);

            return this.auth?.check(null, permissionString);
          } catch(e) {
            return false;
          }
        }
        return true;
      },
      internalIsAvailable: function(config, controllerMode, data) {
        if ( controllerMode == 'EDIT' ) return false;
        try {
          return config.deletePredicate.f(data);
        } catch(e) {
          return false;
        }
      },
      code: function() {
        this.add(this.Popup.create({ backgroundColor: 'transparent' }).tag({
          class: 'foam.u2.DeleteModal',
          dao: this.config.dao,
          onDelete: () => {
            this.finished.pub();
            this.daoController.route = '';
          },
          data: this.data
        }));
      }
    }
  ]
});
