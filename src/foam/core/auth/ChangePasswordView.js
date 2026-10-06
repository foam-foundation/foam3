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
    'foam.u2.detail.SectionView',
    'foam.u2.stack.StackBlock'
  ],

  messages: [
    { name: 'BACK_LABEL', message: 'Back to'}
  ],
  
  css: `
    << {
      height: 100%;
    }
    <<flex {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 1rem;
      padding: 2.4rem 3.2rem;
    }
    <<sectionView {
      width: 100%;
      display: flex;
      justify-content: flex-start;
    }
    <<title {
      text-align: left;
    }
    <<subTitle {
      padding: 0 15px;
      text-align: left;
    }
    << .foam-u2-detail-SectionView .foam-u2-detail-SectionView-actionDiv {
      justify-content: flex-start;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 10px;
    }
    << form {
      margin-bottom: 0;
      margin-top: 1.6rem;
    }

    /* standalone page: split layout matching the login page */
    <<standalone {
      display: flex;
      min-height: 100vh;
      width: 100%;
      background: $backgroundDefault;
    }
    <<hero {
      flex: 1 1 55%;
      position: relative;
      overflow: hidden;
      background-color: $backgroundDefault;
    }
    <<heroImg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
    <<main {
      flex: 1 1 45%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
    }
    <<standalone <<flex {
      width: 100%;
      max-width: 520px;
      align-items: stretch;
      padding: 0px;
    }
    <<standalone <<title {
      text-align: left;
      font-size: 1.5rem;
      font-weight: $font-extra-bold;
      color: $textDefault;
    }
    <<standalone <<subTitle {
      text-align: left;
      padding: 0;
      color: $textSecondary;
    }
    <<standalone <<sectionView > * {
      width: 100%;
    }
    <<standalone .foam-u2-detail-SectionView-actionDiv button {
      width: 100%;
    }
    <<standalone <<flex > .foam-u2-ActionView {
      align-self: flex-start;
      color: $textBrand;
    }

    /* popup dialog */
    <<popup {
      height: auto;
      width: min(90vw, 48rem);
    }
    <<popup <<flex {
      padding: 2.4rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: start;
      gap: 1rem;
    }
    <<popup <<sectionView > * {
      width: 100%;
      display: flex;
      justify-content: center;
      padding: 15px;
    }
    <<popup <<title {
      text-align: center;
      font-weight: $font-medium;
      font-size: $header-sm;
    }
    <<popup <<subTitle {
      padding: 0 15px;
      text-align: center;
    }
    <<popup << .foam-u2-detail-SectionView .foam-u2-detail-SectionView-actionDiv {
      justify-content: center;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    <<popup <<flex > .foam-u2-ActionView {
      margin-left: 15px;
      align-self: flex-start;
    }

    @media only screen and (min-width: /*%DISPLAYWIDTH.MD%*/ 786px ) {
      <<subTitle {
        padding: 0;
      }
    }
    @media (max-width: 768px) {
      <<standalone { flex-direction: column; }
      <<hero { flex: 0 0 200px; width: 100%; }
      <<main { flex: 1 1 100%; padding: 2rem 1rem; }
      <<standalone <<flex { max-width: 400px; }
      <<standalone <<title { font-size: 1.2rem; }
      <<standalone <<subTitle { font-size: 0.9rem; }
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
    },
    {
      class: 'String',
      name: 'imageUrl',
      hidden: true,
      factory: function() {
        var t = this.theme || {};
        return t.externalCommunicationImage || t.largeLogo || t.topNavLogo || t.logo;
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
        .enableClass(this.myClass('popup'), popup);

      if ( standalone ) {
        this
          .start().addClass(this.myClass('hero'))
            .start('img').addClass(this.myClass('heroImg'))
              .attr('src', this.imageUrl)
              .attr('alt', '')
            .end()
          .end()
          .start().addClass(this.myClass('main'))
            .start().addClass(this.myClass('flex'))
              .call(this.renderForm, [this])
              .tag(this.BACK, { label: this.backLabel() })
            .end()
          .end();
        return;
      }

      this.start().addClass(this.myClass('flex'))
        .call(this.renderForm, [this])
        .add(self.CANCEL)
      .end();
    },

    function renderForm(self) {
      // Called with `this` bound to the parent element.
      this.add(self.dynamic(function(data, data$loadingError) {
        if ( data$loadingError ) {
          this.start().addClass(self.myClass('title'), 'h200').add(data$loadingError).end();
          return;
        }
        this.callIf(data.TITLE, function() {
          this.start().addClass(self.myClass('title'), 'h200').add(data.TITLE).end();
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
      }));
    },

    function backLabel() {
      const prev = this.stack?.stack_[this.stack.pos - 1]?.breadcrumbTitle;
      return this.BACK_LABEL + ' ' + (prev || (this.theme?.appName ?? 'home'));
    }
  ],

  actions: [
    {
      name: 'back',
      buttonStyle: 'LINK',
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
      isAvailable: function(popup) {
        return popup;
      },
      code: function(X) {
        ( X.closeDialog || this.closeDialog )?.();
      }
    }
  ]
});
