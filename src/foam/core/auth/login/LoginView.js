/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.login',
  name: 'LoginView',
  extends: 'foam.u2.View',

  imports: [
    'appConfig',
    'clientLoginService',
    'currentMenu?',
    'loginVariables',
    'logAnalyticEvent?',
    'oAuthProviderDAO',
    'params',
    'signInWithOIDC?',
    'window?',
    'stack'
  ],

  requires: [
    'foam.core.app.AppBadgeView',
    'foam.core.auth.login.SignIn',
    'foam.core.auth.login.SignUp',
    'foam.mlang.ExpressionsSingleton',
    'foam.core.oauth.OAuthProvider',
    'foam.u2.stack.StackBlock',
    'foam.u2.crunch.WizardRunner',
    'foam.u2.wizard.WizardType'
  ],

  css: `
  ^ .full-width-button {
    width: 100%;
  }

  .foam-u2-dialog-ApplicationPopup ^content-form {
    width: 100%;
    padding: 2vw 0;
  }

  /* ON DATA */
  ^content-form {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-self: center;
    padding: 1rem;
  }

  ^content-form > form {
    margin-block-end: 0;
  }

  /* ON ALL FOOTER TEXT */
  ^ .text-with-pad {
    margin-right: 0.2em;
  }
  ^center-footer {
    text-align: center;
  }
  ^ .align-end {
    text-align: end;
  }
  ^ .align-end button{
    padding: 0;
  }

  ^disclaimer {
    text-align: center;
  }

  ^tc-link {
    background: none;
    border: 1px solid transparent;
    color: $textBrand;
    text-decoration: none;
  }
  ^legal {
    position: absolute;
    bottom: 1.2rem;
    margin: 0 1rem;
    text-align: center;
    font-size: 0.8rem;
    width: 100%;
  }

  ^buttonHolder {
    display: flex;
    flex-direction: column;
    gap: 2.4rem
  }
  `,

  constants: [
    { name: 'SIGN_IN', value: 0 },
    { name: 'SIGN_UP', value: 1 }
  ],

  properties: [
    {
      name: 'data',
      factory: () => {
       return {};
      },
      view: { class: 'foam.u2.detail.VerticalDetailView' }
    },
    {
      name: 'param',
      factory: function() {
        return {};
      }
    },
    {
      name: 'mode_',
      value: 0,
      hidden: true
    },
    {
      class: 'String',
      name: 'currentDomain',
      factory: function() {
        return this.window?.location?.host || '';
      }
    },
    {
      class: 'String',
      name: 'currentHostname',
      factory: function() {
        return this.window?.location?.hostname || '';
      }
    },
    {
      class: 'String',
      name: 'modelCls_',
      documentation: `
        If modelCls_ is provided, the data can be created directly from this instead of mode
      `,
      expression: function(mode_) {
        if ( mode_ === this.SIGN_UP ) {
          return this.SignUp.id;
        } else {
          return this.SignIn.id;
        }
      }
    },
    { class: 'Boolean', name: 'showTitle', value: true },
    { class: 'Boolean', name: 'showAction', value: true }
  ],

  messages: [
    { name: 'GO_BACK', message: 'Go to ' },
    { name: 'SWITCH_TO_SIGN_UP_TXT', message: 'Not a user yet?' },
    { name: 'SWITCH_TO_SIGN_IN_TXT', message: 'Already have an account?' },
    { name: 'DISCLAIMER_TEXT', message: 'By signing up, you accept our ' }
  ],

  methods: [
    {
      name: 'detach',
      code: function() {
        this.SUPER();
        this.data.detach();
      }
    },

    function configData() {
      // Use passed in values or default loginVariables defined on ApplicationControllers
      this.param = Object.assign(this.loginVariables, this.param);
      try {
        var cls = foam.lookup(this.modelCls_);

        if ( this.data &&  cls.isInstance(this.data) ) return;

        this.data = cls.create(this.param, this);
      } catch (err) {
        console.warn('Error occurred when looking up modelCls_', this.modelCls_, err);
      }
    },

    function render() {
      this.SUPER();
      var self = this;
      if ( this.currentMenu ) {
        this.logAnalyticEvent && this.logAnalyticEvent({ name: "VIEW_LOAD_LoginView_" + this.currentMenu.id });
      } else {
        this.logAnalyticEvent && this.logAnalyticEvent({ name: "VIEW_LOAD_LoginView" });
      }
      // CREATE DATA VIEW
      this
        .addClass(self.myClass())
        // Title txt and Data
        .callIf(self.showTitle && self.data.TITLE, function() { this.start().addClass('h300').add(self.data.TITLE).end(); })
        .addClass(self.myClass('content-form'))
        .start('form')
          .setID('login')
          .startContext({ data: this }).tag(this.DATA).endContext()

          .add(this.slot(function(showAction, mode_) {
            return self.E().addClass(self.myClass('buttonHolder')).callIf(showAction, function() {
              this
                .startContext({ data: self })
                  .start().addClass('align-end').callIf(mode_ == self.SIGN_IN && showAction && self.loginVariables.emailRequired_, function() {
                    this.start(self.RESET_PASSWORD)
                      .attr('type', 'button').end()
                  }).end()
                  .callIfElse(
                    mode_ == self.SIGN_IN,
                    function() { this.start(self.SIGN_IN_ACTION).addClass('full-width-button').attrs({ type: 'submit', form: 'login' }).end(); },
                    function() { this.start(self.SIGN_UP_ACTION).addClass('full-width-button').attrs({ type: 'submit', form: 'login' }).end(); }
                  )
                .endContext();
            });
          }))
        .end()
        .start().style({ display: 'contents' })
          .add(self.slot(function(mode_, showAction) {
            if ( mode_ != self.SIGN_IN ) {
              return this.E();
            }

            var E = self.ExpressionsSingleton.create();
            var dao = self.oAuthProviderDAO.where(
              E.OR(
                E.CONTAINS(self.OAuthProvider.DOMAINS, self.currentDomain),
                E.CONTAINS(self.OAuthProvider.DOMAINS, self.currentHostname)
              )
            );
            return this.E()
                .style({ display: 'contents' })
                .select(dao, function (provider) {
                  if ( !provider ) return;
                  let action = foam.lang.Action.create({
                    name: 'signIn',
                    label: provider.description,
                    icon: provider.icon,
                    buttonStyle: showAction ? 'SECONDARY' : 'PRIMARY',
                    code: async function () {
                      if ( self.signInWithOIDC ) {
                        await self.signInWithOIDC(provider);
                      } else {
                        await self.clientLoginService.signInWithOIDC(provider);
                      }
                    }
                  });

                  this.startContext({ data: self.data }).add(action).endContext();
                });
          }))
        .end()
        .add(this.slot(function(showAction, appConfig, mode_) {
            self.configData();
            var disclaimer = self.E().style({ display: 'contents' })
            .callIf(mode_ == 1 && (appConfig.termsAndCondLink || appConfig.privacyUrl), function() {
              this.start()
                .addClass(self.myClass('disclaimer'))
                .add(self.DISCLAIMER_TEXT)
                .callIf(appConfig.termsAndCondLink, function() {
                  this.start('a')
                    .addClasses([self.myClass('tc-link'), 'h600'])
                    .add(appConfig.termsAndCondLabel)
                    .attrs({
                      href: appConfig.termsAndCondLink,
                      target: '_blank'
                    })
                  .end();
                })
                .callIf(appConfig.termsAndCondLink && appConfig.privacyUrl, function() {
                  this.add(' and ');
                })
                .callIf(appConfig.privacyUrl, function() {
                  this.start('a')
                    .addClasses([self.myClass('tc-link'), 'h600'])
                    .add(appConfig.privacy)
                    .attrs({
                      href: appConfig.privacyUrl,
                      target: '_blank'
                    })
                  .end();
                })
              .end();
            });

            return self.E().style({ display: 'contents' })
              .callIf(showAction,
                function() {
                  this
                    .start()
                      .startContext({ data: self })
                      .addClass(self.myClass('center-footer'))
                      // first footer
                      .start()
                        .addClass(self.myClass('signupLink'))
                        .start('span')
                          .addClass('text-with-pad')
                          .callIfElse(
                            self.mode_ == self.SIGN_IN,
                            function() { this.add(self.SWITCH_TO_SIGN_UP_TXT); },
                            function() { this.add(self.SWITCH_TO_SIGN_IN_TXT); }
                          )
                        .end()
                        .start('span')
                          .callIfElse(
                            self.mode_ == self.SIGN_IN,
                            function() { this.add(self.SWITCH_TO_SIGN_UP); },
                            function() { this.add(self.SWITCH_TO_SIGN_IN); }
                          )
                        .end()
                      .end()
                      .endContext()
                    .end();
                }
              )
              .add(disclaimer)
              .callIf(showAction, function () {
                this.tag(self.AppBadgeView, {isReferral: self.data.referralToken || self.params['utm_id']});
              });
        }));
    }
  ],

  actions: [
    {
      name: 'signInAction',
      label: 'Sign in',
      buttonStyle: 'PRIMARY',
      /*
        This is disabled because the browser is suggesting values, but doesn't actually enter them until
        you click the button, so we think the fields are empty and disable the login button.
        The only solution (I know of) is to just remove this validation.

      isEnabled: function(data, data$errors_) {
        return data && ! data$errors_;
      },
      */
      code: function(X) {
        this.clientLoginService.signin(X, this.data);
      }
    },
    {
      name: 'signUpAction',
      label: 'Get started',
      buttonStyle: 'PRIMARY',
      isEnabled: function(data, data$errors_) {
        return data && ! data$errors_;
      },
      code: function(X) {
        this.clientLoginService.signup(X, this.data);
      }
    },
    {
      name: 'switchToSignIn',
      label: 'Sign in',
      buttonStyle: 'TEXT',
      code: function(X) {
        X.routeTo('sign-in');
      }
    },
    {
      name: 'switchToSignUp',
      label: 'Create an account',
      buttonStyle: 'TEXT',
      code: function(X) {
        X.routeTo('sign-up');
      }
    },
    {
      name: 'resetPassword',
      label: 'Forgot password?',
      buttonStyle: 'LINK',
      code: function(X) {
        this.clientLoginService.resetPassword(X, this.data);
      }
    }
  ]
});
