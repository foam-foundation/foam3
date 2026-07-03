/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.login',
  name: 'SignIn',

  messages: [
    {
      name: 'EMAIL_OR_USERNAME',
      messageMap: {
        en: 'Email or Username',
        fr: 'Adresse e-mail ou nom d\'utilisateur'
      }
    },
    {
      name: 'USERNAME_MESSAGE',
      messageMap: {
        en: 'Username',
        fr: 'Nom d\'utilisateur'
      }
    },
    {
      name: 'PASSWORD_MESSAGE',
      messageMap: {
        en: 'Password',
        fr: 'Mot de passe'
      }
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'identifier',
      required: true,
      validationTextVisible: false,
      labelFormatter: function(data) {
        this.add(data.emailRequired_ ? data.EMAIL_OR_USERNAME : data.USERNAME_MESSAGE);
      },
      trim: true,
      view: { class: 'foam.u2.TextField', type: 'email' }
    },
    {
      class: 'String',
      name: 'username',
      labelFormatter: function(data) {
        this.add(data.USERNAME_MESSAGE);
      },
      visibility: function(usernameRequired_) {
        return usernameRequired_ ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'email',
      hidden: true
    },
    {
      class: 'Password',
      name: 'password',
      required: true,
      validationTextVisible: false,
      labelFormatter: function(data) {
        this.add(data.PASSWORD_MESSAGE);
      },
      view: { class: 'foam.u2.view.PasswordView', autocomplete: 'current-password', passwordIcon: true }
    },
    {
      class: 'Boolean',
      name: 'usernameRequired_',
      hidden: true
    },
    {
      class: 'Boolean',
      name: 'emailRequired_',
      hidden: true
    }
  ]
});
