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
    {
      name: 'TITLE',
      messageMap: {
        en: 'Reset your password',
        fr: 'Réinitialisez votre mot de passe'
      }
    },
    {
      name: 'INSTRUCTION',
      messageMap: {
        en: 'Create a new password for your account',
        fr: 'Créez un nouveau mot de passe pour votre compte'
      }
    },
    {
      name: 'PASSWORD_NOT_MATCH',
      messageMap: {
        en: 'Passwords do not match',
        fr: 'Les mots de passe ne correspondent pas'
      }
    },
    {
      name: 'SUCCESS_MSG',
      messageMap: {
        en: 'Your password was successfully updated',
        fr: 'Votre mot de passe a été mis à jour avec succès'
      }
    },
    {
      name: 'SUCCESS_MSG_TITLE',
      messageMap: {
        en: 'Success',
        fr: 'Succès'
      }
    },
    {
      name: 'ERROR_MSG',
      messageMap: {
        en: 'There was a problem resetting your password',
        fr: 'Il y a eu un problème pour réinitialiser ton mot de passe'
      }
    }
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
      label: { en: 'New Password', fr: 'Nouveau mot de passe'},
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
      label: { en: 'Confirm Password', fr: 'Confirmer le mot de passe' },
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
