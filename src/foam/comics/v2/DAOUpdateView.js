/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v2',
  name: 'DAOUpdateView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.memento.Memorable'],

  topics: [
    'finished',
    'throwError'
  ],

  documentation: `
    A configurable summary view for a specific instance
  `,

  axioms: [
    foam.pattern.Faceted.create()
  ],

  css: `
    ^ {
      padding: 32px
    }

    ^topContainer{
      grid-gap: 32px 12px;
    }

    ^ .foam-u2-ActionView-back {
      display: flex;
      align-self: flex-start;
    }

    ^actions-header .foam-u2-ActionView {
      margin-right: 24px;
      line-height: 1.5
    }

    ^view-container {
      margin: auto;
    }
  `,

  requires: [
    'foam.log.LogLevel',
    'foam.u2.layout.Cols',
    'foam.u2.layout.Rows',
    'foam.u2.layout.Grid',
    'foam.u2.ControllerMode'
  ],

  imports: [
    'ctrl',
    'currentControllerMode',
    'currentMenu?',
    'setControllerMode?',
    'stack',
    'translationService'
  ],

  exports: [
    'controllerMode'
  ],

  messages: [
    { name: 'BACK',      message: 'Back' },
    { name: 'DETAIL',    message: 'Detail' },
    { name: 'TABBED',    message: 'Tabbed' },
    { name: 'SECTIONED', message: 'Sectioned' },
    { name: 'MATERIAL',  message: 'Material' },
    { name: 'WIZARD',    message: 'Wizard' },
    { name: 'VERTICAL',  message: 'Vertical' },
    { name: 'UPDATED',   message: 'Updated' }
  ],

  properties: [
    {
      class: 'FObjectProperty',
      name: 'data'
    },
    {
      class: 'FObjectProperty',
      name: 'workingData',
      expression: function(data) {
        return data.clone(this);
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.DAOControllerConfig',
      name: 'config'
    },
    {
      name: 'controllerMode',
      factory: function() {
        return this.ControllerMode.EDIT;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'viewView',
      expression: function() {
        return foam.u2.detail.TabbedDetailView;
      }
    },
    'currentMemento_'
  ],

  actions: [
    {
      name: 'save',
      isEnabled: function(workingData$errors_) {
        let enabled = ! workingData$errors_;
        if ( ! enabled ) {
          console.error('Save disabled:', workingData$errors_);
        }
        return enabled;
      },
      code: function() {
        this.config.dao.put(this.workingData).then(o => {
          if ( ! this.data.equals(o) ) {
            this.data = o;
            this.finished.pub();
            if ( foam.comics.v2.userfeedback.UserFeedbackAware.isInstance(o) && o.userFeedback ) {
              var currentFeedback = o.userFeedback;
              while ( currentFeedback ) {
                this.ctrl.notify(currentFeedback.message, '', this.LogLevel.INFO, true);
                currentFeedback = currentFeedback.next;
              }
            } else {
              var menuId = this.currentMenu ? this.currentMenu.id : this.config.of.id;
              var title = this.translationService.getTranslation(foam.locale, menuId + '.browseTitle', ( this.config.of?.model_?.label || this.config.browseTitle ));

              this.ctrl.notify(title + " " + this.UPDATED, '', this.LogLevel.INFO, true);
            }
          }
          this.stack.back();
        }, e => {
          this.throwError.pub(e);

          if ( e.exception && e.exception.userFeedback  ) {
            var currentFeedback = e.exception.userFeedback;
            while ( currentFeedback ) {
              this.ctrl.notify(currentFeedback.message, '', this.LogLevel.INFO, true);

              currentFeedback = currentFeedback.next;
            }
            this.stack.back();
          } else {
            this.ctrl.notify(e.message, '', this.LogLevel.ERROR, true);
          }
        });
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();

      // setControllerMode can be undefined when NOT coming from
      // DAOBrowserControllerView eg. when manually pushing DAOSummaryView to
      // the stack.
      this.setControllerMode?.('edit');

      this
        .addClass(this.myClass())
        .add(self.slot(function(data, config$viewBorder) {
          return self.E()
            .start(self.Grid)
              .addClass(this.myClass('topContainer'))
              .start(self.Rows)
                // we will handle this in the StackView instead
                .startContext({ data: self.stack })
                  .tag(self.stack.BACK, {
                    buttonStyle: foam.u2.ButtonStyle.LINK,
                    icon: 'images/back-icon.svg',
                    themeIcon: 'back',
                    label: this.BACK
                  })
                .endContext()
                .start(self.Cols).style({ 'align-items': 'center' })
                  .start()
                    .add(data && data.toSummary() ? data.toSummary() : '')
                    .addClass('dao-title')
                    .addClass('truncate-ellipsis')
                  .end()
                  .startContext({ data: self }).tag(self.SAVE, { buttonStyle: 'PRIMARY' }).endContext()
                .end()
              .end()

              .start(config$viewBorder)
                .start().addClass(this.myClass('view-container'))
                  .add(self.slot(function(viewView) {
                    var view = foam.u2.ViewSpec.createView(viewView, {
                      data$: self.workingData$
                    }, self, self);

                    return self.E().add(view);
                  }))
                .end()
              .end()
            .end();
        }));
    }
  ]
});
