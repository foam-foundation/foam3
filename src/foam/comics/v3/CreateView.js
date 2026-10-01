/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.comics.v3',
  name: 'CreateView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.Router'],

  topics: [
    'finished',
    'throwError'
  ],

  documentation: `
    A configurable view to create an instance of a specified model
  `,

  axioms: [
    foam.pattern.Faceted.create()
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.u2.ButtonGroup',
    'foam.u2.ControllerMode'
  ],

  imports: [
    'currentMenu?',
    'daoController?',
    'notify',
    'stack',
    'translationService'
  ],

  exports: [
    'controllerMode',
    'as createView'
  ],

  messages: [
    { name: 'CREATED', message: 'Created' }
  ],

  css: `
    ^buttonGroup {
      justify-content: flex-end;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      name: 'data'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config'
    },
    {
      name: 'controllerMode',
      factory: function() {
        return this.ControllerMode.CREATE;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'viewView',
      factory: function() {
        return this.config.createView;
      }
    },
    {
      class: 'String',
      name: 'mementoHead',
      value: 'create'
    },
    'currentMemento_'
  ],

  actions: [
    {
      // ComicsAction so a model can override create's Save (see buildActionsOverrides_).
      class: 'foam.comics.v3.ComicsAction',
      name: 'save',
      buttonStyle: 'PRIMARY',
      // Mode + validity only; create permission is gated at the create button + server-side.
      internalIsAvailable: function(controllerMode) {
        return controllerMode == 'CREATE';
      },
      internalIsEnabled: function(data$errors_) {
        return ! data$errors_;
      },
      code: function() {
        var cData = this.data;

        return this.config.dao.put(cData).then(o => {
          this.data = o;
          this.finished.pub();

          if ( foam.comics.v2.userfeedback.UserFeedbackAware.isInstance(o) && o.userFeedback ) {
            var currentFeedback = o.userFeedback;
            while ( currentFeedback ) {
              this.notify(currentFeedback.message, '', this.LogLevel.INFO, true);
              currentFeedback = currentFeedback.next;
            }
          } else {
            var menuId = this.currentMenu ? this.currentMenu.id : this.config.of.id;
            var title = this.translationService.getTranslation(foam.locale, menuId + '.browseTitle', ( this.config.of?.model_?.label || this.config.browseTitle ));

            this.notify(title + ' ' + this.CREATED, '', this.LogLevel.INFO, true);
          }
          this.daoController && (this.daoController.route = o.id);
        }, e => {
          this.throwError.pub(e);

          if ( e.exception && e.exception.userFeedback  ) {
            var currentFeedback = e.exception.userFeedback;
            while ( currentFeedback ) {
              this.notify(currentFeedback.message, '', this.LogLevel.INFO, true);

              currentFeedback = currentFeedback.next;
            }

          } else {
            this.notify(e.message, '', this.LogLevel.ERROR, true);
          }
        });
      }
    },
    {
      // ComicsAction so a model can override create's Cancel (e.g. cleanup).
      class: 'foam.comics.v3.ComicsAction',
      name: 'cancel',
      internalIsAvailable: function(controllerMode) {
        return controllerMode == 'CREATE';
      },
      internalIsEnabled: function() {
        return true;
      },
      code: async function() {
        // routeToMe() (not route='') returns to browse: an empty route also fires the
        // Router's crumb.go(), racing the controller and making cancel intermittent.
        if ( this.daoController ) this.daoController.routeToMe();
        else await this.stack.pop();
      }
    }
  ],

  methods: [
    function buildActionsOverrides_() {
      // Let a model override save/cancel with same-named ComicsActions, merged over the
      // defaults (like DetailView.getActionsOverrides). overrideCodeData$ = data$ runs the
      // override's code against the new record.
      var self = this;
      var of   = ( this.config && this.config.of ) || ( this.data && this.data.cls_ );
      var overrides = {};
      var comicsActions = of ? of.getAxiomsByClass(foam.comics.v3.ComicsAction) : [];
      comicsActions.forEach(function(a) { overrides[a.name] = a; });

      var result = {};
      [ 'save', 'cancel' ].forEach(function(name) {
        var def      = self[foam.String.constantize(name)];
        var override = overrides[name];
        if ( ! override ) { result[name] = def; return; }
        var merged = def.clone(self).copyFrom(override);
        if ( override.hasOwnProperty('code') ) merged.overrideCodeData$ = self.data$;
        result[name] = merged;
      });
      return result;
    },

    function render() {
      var self = this;
      this.SUPER();
      var actions = this.buildActionsOverrides_();
      this.stack.setTitle(self.slot('config$createTitle'), this);
      this.onDetach(
        this.stack.setTrailingContainer(
          this.ButtonGroup.create({}, this)
            .addClass(this.myClass('buttonGroup'))
            .startContext({ data: this })
              .tag(actions.save)
              .tag(actions.cancel)
            .endContext()
        )
      );

      this
        .addClass(this.myClass())
        .start(this.config.viewBorder)
          .start().addClass(this.myClass('create-view-container'))
            .tag(this.viewView, { data$: self.data$ })
          .end()
        .end();
    }
  ]
});
