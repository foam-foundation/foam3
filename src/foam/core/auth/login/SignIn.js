/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.login',
  name: 'SignIn',

  properties: [
    {
      class: 'String',
      name: 'identifier',
      required: true,
      validationTextVisible: false,
      labelFormatter: function(data) {
        this.add(data.emailRequired_ ? 'Email or Username' : 'Username');
      },
      trim: true,
      view: { class: 'foam.u2.TextField', type: 'email' }
    },
    {
      class: 'String',
      name: 'username',
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
