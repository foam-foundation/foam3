/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

//TODO: Maybe have this and emailVerificationView extend a common view/css
foam.CLASS({
  package: 'foam.core.auth',
  name: 'ChangePasswordView',
  extends: 'foam.u2.Controller',

  documentation: 'Renders a password change model as either an embedded page, a standalone page, or a pop-up (modal)',

  imports: [
    'loginView?',
    'stack',
    'theme',
    'user',
    'window'
  ],

  requires: [
    'foam.core.auth.ChangePasswordViewMode',
    'foam.u2.borders.StatusPageBorder',
    'foam.u2.detail.SectionView',
    'foam.u2.stack.StackBlock'
  ],

  messages: [
    { name: 'BACK_LABEL', message: 'Back to'}
  ],
  
  css: `
    ^ {
      height: 100%;
    }
    ^flex {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: start;
      gap: 1rem;
      padding: 2.4rem 3.2rem;
    }
    ^sectionView {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    ^title {
      text-align: center;
    }
    ^subTitle {
      padding: 0 15px;
      text-align: center;
    }
    ^ .foam-u2-detail-SectionView .foam-u2-detail-SectionView-actionDiv {
      justify-content: center;
      flex-direction: column;
      gap: 0.5rem;
    }
    ^ form {
      margin-bottom: 0;
    }

    /* standalone page */
    ^standalone ^flex {
      gap: 3rem;
      padding: 5rem 0 0 0;
    }
    ^standalone ^subTitle, ^standalone ^sectionView > * {
      width: 75%;
    }

    /* popup dialog */
    ^popup {
      height: auto;
      width: min(90vw, 48rem);
    }
    ^popup ^flex {
      padding: 2.4rem;
    }
    ^popup ^sectionView > * {
      width: 100%;
    }

    @media only screen and (min-width: /*%DISPLAYWIDTH.MD%*/ 786px ) {
      ^standalone ^subTitle, ^standalone ^sectionView > * {
        width: 50%;
      }
      ^subTitle {
        padding: 0;
      }
    }
    @media only screen and (min-width: /*%DISPLAYWIDTH.LG%*/ 960px ) {
      ^standalone ^subTitle, ^standalone ^sectionView > * {
        width: 25%;
      }
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'isHorizontal',
      documentation: `Toggles the view from displaying input fields horizontally or vertically.
        Not recommended to set this to true if there are less than three input fields for password model.
      `,
      value: false,
      hidden: true
    },
    {
      class: 'foam.util.FObjectSpec',
      name: 'modelOf',
      documentation: `Password model used for this view.
        Pass this property along when you create this view.
        e.g., stack.push({
          class: 'foam.core.auth.ChangePasswordView',
          modelOf: 'foam.core.auth.RetrievePassword'
        })
      `
    },
    {
      class: 'FObjectProperty',
      of: this.modelOf,
      name: 'data',
      documentation: 'instance of password model used for this view',
      factory: function() {
        return foam.lookup(this.modelOf.class)
          .create({ ...this.modelOf, isHorizontal: this.isHorizontal }, this);
      },
      view: { class: 'foam.u2.detail.VerticalDetailView' }
    },
    {
      class: 'Enum',
      of: 'foam.core.auth.ChangePasswordViewMode',
      name: 'viewMode',
      documentation: `How this view is presented. For POPUP, the caller is
        responsible for wrapping it in a foam.u2.dialog.Popup.`,
      factory: function() {
        return this.ChangePasswordViewMode.EMBEDDED;
      }
    }
  ],

  methods: [
    function render() {
      const self = this;
      const Mode = this.ChangePasswordViewMode;
      const standalone = this.viewMode === Mode.STANDALONE;
      const popup      = this.viewMode === Mode.POPUP;

      this.addClass()
        .enableClass(this.myClass('standalone'), standalone)
        .enableClass(this.myClass('popup'), popup)
        .start(standalone ? this.StatusPageBorder : '', { showBack: false })
          .start()
            .addClass(this.myClass('flex'))
            .add(this.dynamic(function(data, data$loadingError) {
              if ( data$loadingError ) {
                this.start().addClass(self.myClass('title'), 'h400').add(data$loadingError).end();
                return;
              }

              this.callIf(data.TITLE, function() {
                this.start().addClass(self.myClass('title'), 'h400').add(data.TITLE).end();
              })
              .callIf(data.INSTRUCTION, function() {
                this.start().addClass(self.myClass('subTitle'), 'p').add(data.INSTRUCTION).end();
              })
              .start(self.SectionView, {
                nodeName: 'form',
                data$: self.data$,
                sectionName: 'resetPasswordSection',
                showTitle: false
              })
                .addClass(self.myClass('sectionView'))
              .end();
            }))
            .callIf(standalone, function() {
              let label = self.stack?.stack_[self.stack.pos - 1]?.breadcrumbTitle;
              this.tag(self.BACK,
                { label: self.BACK_LABEL + ' ' + (label || (self.theme?.appName ?? 'home')) }
              );
            })
            .callIf(popup, function() {
              this.tag(self.CANCEL);
            })
          .end()
        .end();
    }
  ],

  actions: [
    {
      name: 'back',
      buttonStyle: 'TEXT',
      code: function(X) {
        if ( X.stack.pos > 0 ) {
          X.stack.jump(X.stack.pos - 1);
        } else {
          this.window.history.replaceState(null, null, this.window.location.origin);
          X.pushDefaultMenu();
        }
      }
    },
    {
      name: 'cancel',
      buttonStyle: 'TEXT',
      code: function(X) {
        ( X.closeDialog || this.closeDialog )?.();
      }
    }
  ]
});
