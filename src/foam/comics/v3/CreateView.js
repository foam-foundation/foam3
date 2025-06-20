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
    'foam.u2.ControllerMode'
  ],

  imports: [
    'currentMenu?',
    'daoController',
    'notify',
    'stack',
    'translationService'
  ],

  exports: [
    'controllerMode'
  ],

  messages: [
    { name: 'CREATED', message: 'Created' }
  ],

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
      name: 'save',
      buttonStyle: 'PRIMARY',
      isEnabled: function(data$errors_) {
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
            var title = this.translationService.getTranslation(foam.locale, menuId + '.browseTitle', this.config.browseTitle);

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
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this.stack.setTitle(self.slot('config$createTitle'), this);
      this.onDetach(this.stack.setTrailingContainer(this.E().startContext({ data: this }).tag(this.SAVE).endContext()));

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
