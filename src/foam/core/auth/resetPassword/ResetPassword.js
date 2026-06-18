/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.resetPassword',
  name: 'ResetPassword',

  documentation: 'Reset Password Base Model',

  imports: [
    'pushMenu',
    'window'
  ],

  requires: [
    'foam.u2.stack.StackBlock'
  ],

  messages: [
    { name: 'TITLE', message: 'Reset your password' },
    { name: 'INSTRUCTION', message: 'Create a new password for your account' },
    { name: 'PASSWORD_NOT_MATCH', message: 'Passwords do not match' },
    { name: 'SUCCESS_MSG', message: 'Your password was successfully updated' },
    { name: 'SUCCESS_MSG_TITLE', message: 'Success' },
    { name: 'ERROR_MSG', message: 'There was a problem resetting your password' }
  ],

  sections: [
    {
      name: 'resetPasswordSection'
    }
  ],

  properties: [
    {
      class: 'Password',
      name: 'newPassword',
      section: 'resetPasswordSection',
      view: {
        class: 'foam.u2.view.PasswordView',
        passwordIcon: true,
        autocomplete: 'new-password'
      },
      minLength: 10
    },
    {
      class: 'Password',
      name: 'confirmationPassword',
      label: 'Confirm Password',
      section: 'resetPasswordSection',
      view: {
        class: 'foam.u2.view.PasswordView',
        passwordIcon: true,
        autocomplete: 'new-password'
      },
      validationPredicates: [
        {
          query: 'newPassword==confirmationPassword',
          errorMessage: 'PASSWORD_NOT_MATCH'
        }
      ]
    },
    {
      class: 'Boolean',
      name: 'isHorizontal',
      documentation: 'setting this to true makes password fields to be displayed horizontally',
      value: false,
      hidden: true
    },
    {
      class: 'Boolean',
      name: 'showSubmitAction',
      value: true,
      hidden: true
    },
    {
      class: 'String',
      name: 'loadingError',
      hidden: true
    }
  ],

  methods: [
    function init() {
      if ( this.isHorizontal ) {
        this.makeHorizontal();
      }
    },
    {
      name: 'makeHorizontal',
      code: function() {
        let columns = { columns: 12, mdColumns: 6, lgColumns: 6, xlColumns: 6 };
        this.NEW_PASSWORD.gridColumns = columns;
        this.CONFIRMATION_PASSWORD.gridColumns = columns;
      }
    },
    {
      name: 'finalRedirectionCall',
      code: function() {
        this.window.history.replaceState(null, null, this.window.location.origin);
        this.pushMenu("sign-in");
      }
    }
  ]
});
