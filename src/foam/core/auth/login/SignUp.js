/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.login',
  name: 'SignUp',

  requires: [
    'foam.core.auth.User'
  ],

  constants: [
    {
      name: 'USERNAME_INVALID_ERR',
      type: 'String',
      factory: function() { return foam.core.auth.User.INVALID_USERNAME; },
      javaValue: 'foam.core.auth.User.INVALID_USERNAME'
    }
  ],

  messages: [
    { name: 'EMAIL_AVAILABILITY_ERR', message: 'This email is already in use. Please sign in or use a different email' },
    { name: 'EMAIL_INVALID_ERR', message: 'Valid email address required' },
    { name: 'PASSWORD_ERR', message: 'Password should be at least 10 characters' },
    { name: 'WEAK_PASSWORD_ERR', message: 'Password is weak' },
    { name: 'USERNAME_AVAILABILITY_ERR', message: 'This username is taken. Please try another.' }
  ],

  properties: [
    {
      class: 'EMail',
      name: 'email',
      placeholder: 'example123@example.com',
      order: 1,
      view: function(_, X) {
        return {
          class: 'foam.u2.view.UserPropertyAvailabilityView',
          icon: 'images/checkmark-small-green.svg',
          isAvailable$: X.data.emailAvailable$,
          type: 'email',
          inputValidation: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
        };
      },
      validateObj: function(disableEmail_, email, emailAvailable) {
        if ( ! disableEmail_ ) {
          if ( ! email ) return foam.lang.Property.REQUIRED;
          if ( emailAvailable == 'invalid' ) return this.EMAIL_INVALID_ERR;
          if ( emailAvailable == 'unavailable' ) return this.EMAIL_AVAILABLE_ERR;
        }
      },
      validationPredicates: [
        {
          args: ['emailAvailable', 'email'],
          query: 'emailAvailable!="unavailable"',
          errorMessage: 'EMAIL_AVAILABILITY_ERR'
        }
      ],
      visibility: function(disableEmail_) {
        return disableEmail_ ?
          foam.u2.DisplayMode.HIDDEN :
          foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'String',
      name: 'username',
      placeholder: 'example123',
      order: 0,
      view: function(_, X) {
        return {
          class: 'foam.u2.view.UserPropertyAvailabilityView',
          icon: 'images/checkmark-small-green.svg',
          isAvailable$: X.data.usernameAvailable$,
          inputValidation: X.data.User.USER_NAME_MATCHER
        };
      },
      required: true,
      validationPredicates: [
        {
          args: ['usernameAvailable', 'username'],
          query: 'usernameAvailable!="invalid"',
          errorMessage: 'USERNAME_INVALID_ERR'
        },
        {
          args: ['usernameAvailable', 'username'],
          query: 'usernameAvailable!="unavailable"',
          errorMessage: 'USERNAME_AVAILABILITY_ERR'
        }
      ]
    },
    {
      class: 'Password',
      name: 'desiredPassword',
      label: 'Password',
      order: 2,
      view: function(_, X) {
        return {
          class: 'foam.u2.view.PasswordView',
          isAvailable$: X.data.passwordAvailable$,
          autocomplete: 'new-password',
          passwordIcon: true
        }
      },
      validationPredicates: [
        {
          args: ['desiredPassword'],
          query: 'desiredPassword exists && desiredPassword.len>=10',
          errorMessage: 'PASSWORD_ERR'
        },
        {
          args: ['passwordAvailable'],
          query: 'passwordAvailable==true',
          errorMessage: 'WEAK_PASSWORD_ERR'
        }
      ]
    },
    {
      name: 'dao_',
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'disableEmail_',
      documentation: `Set this to true to disable the email input field.`,
      hidden: true
    },
    {
      class: 'String',
      name: 'emailAvailable',
      value: 'valid',
      hidden: true,
      transient: true
    },
    {
      class: 'String',
      name: 'usernameAvailable',
      value: 'valid',
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'passwordAvailable',
      value: true,
      hidden: true,
      transient: true
    },
    {
      class: 'String',
      name: 'referralToken',
      label: 'Referral Code',
      order: 3,
      factory: function() {
        var searchParams = new URLSearchParams(location.search);
        return searchParams.get('referral');
      },
      hidden: true
    }
  ]
});
