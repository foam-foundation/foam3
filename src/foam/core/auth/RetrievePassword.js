/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'RetrievePassword',

  documentation: 'Forgot Password Resend Model',

  imports: [
    'ctrl',
    'loginView?',
    'notify',
    'pushMenu',
    'resetPasswordService',
    'resetPasswordToken',
    'stack',
    'translationService'
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.comics.v2.userfeedback.UserFeedbackAlertType',
    'foam.comics.v2.userfeedback.UserFeedbackAware',
    'foam.comics.v2.userfeedback.UserFeedbackException',
    'foam.comics.v2.userfeedback.UserFeedbackStatus',
    'foam.core.auth.DuplicateEmailException',
    'foam.core.auth.User',
    'foam.core.auth.UserNotFoundException',
    'foam.u2.dialog.NotificationMessage'
  ],

  messages: [
    {
      name: 'TOKEN_INSTRUC_TITLE',
      messageMap: {
        en: 'Password Reset Instructions Sent',
        fr: 'Réinitialisation du mot de passe instructions envoyées'
      }
    },
    {
      name: 'TOKEN_INSTRUC',
      messageMap: {
        en: 'Please check your inbox to continue',
        fr: 'Veuillez vérifier votre boîte mail pour continuer'
      }
    },
    {
      name: 'CODE_INSTRUC_TITLE',
      messageMap: {
        en: 'Verification code sent',
        fr: 'Code de vérification envoyé'
      }
    },
    {
      name: 'CODE_INSTRUC',
      messageMap: {
        en: 'Please check your inbox to reset your password',
        fr: 'Veuillez vérifier votre boîte de réception pour réinitialiser votre mot de passe'
      }
    },
    {
      name: 'DUPLICATE_ERROR_MSG',
      messageMap: {
        en: 'This account requires username',
        fr: 'Ce compte nécessite un nom d\'utilisateur'
      }
    },
    {
      name: 'ERROR_MSG',
      messageMap: {
        en: 'Issue resetting your password. Please try again',
        fr: 'Problème pour réinitialiser votre mot de passe. Veuillez réessayer'
      }
    },
    {
      name: 'USER_NOT_FOUND_ERROR_MSG',
      messageMap: {
        en: 'Unable to find user with email: ',
        fr: 'Impossible de trouver un utilisateur avec un e-mail'
      }
    },
    {
      name: 'USER_NOT_FOUND_ERROR_TITLE',
      messageMap: {
        en: 'Invalid Email',
        fr: 'Email invalide'
      }
    }
  ],

  sections: [
    {
      name: 'resetPasswordSection',
      title: { en: 'Reset Password', fr: 'Réinitialiser le mot de passe'},
      view: { class: 'foam.u2.dialog.PopupSectionView' },
      help: 'Enter your account email and we will send you an email with a link to create a new one.'
    },
    {
      name: 'resetPasswordWizardSection',
      properties: [ 'email', 'username' ]
    }
  ],

  properties: [
    {
      class: 'EMail',
      name: 'email',
      section: 'resetPasswordSection',
      required: true,
      createVisibility: function(usernameRequired, readOnlyIdentifier) {
       return usernameRequired ? foam.u2.DisplayMode.HIDDEN :
        readOnlyIdentifier ? foam.u2.DisplayMode.DISABLED : foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'Boolean',
      name: 'readOnlyIdentifier',
      hidden: true
    },
    {
      class: 'String',
      name: 'username',
      createVisibility: function(usernameRequired) {
       return usernameRequired ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(usernameRequired, username) {
        return usernameRequired && ! username ? 'Username is required.' : '';
      },
      section: 'resetPasswordSection'
    },
    {
      class: 'Boolean',
      name: 'usernameRequired',
      hidden: true
    },
    {
      class: 'Boolean',
      name: 'hasBackLink',
      documentation: 'checks if back link to login page is needed',
      value: true,
      hidden: true
    },
    {
      class: 'Boolean',
      name: 'resetByCode',
      hidden: true
    }
  ],

  actions: [
    {
      name: 'sendEmail',
      label: { en: 'Submit', fr: 'Présenté' },
      buttonStyle: 'PRIMARY',
      section: 'resetPasswordSection',
      isEnabled: function(errors_) {
        return ! errors_;
      },
      code: async function(X) {
        var instructionTitle, instruction;
        try {
          if ( this.resetByCode ) {
            await this.resetPasswordService.resetPasswordByCode(null, this.email, this.username);
            instructionTitle = this.CODE_INSTRUC_TITLE;
            instruction = this.CODE_INSTRUC;
          } else {
            const user = await this.User.create({ email: this.email, userName: this.username });
            await this.resetPasswordToken.generateToken(null, user);
            instructionTitle = this.TOKEN_INSTRUC_TITLE;
            instruction = this.TOKEN_INSTRUC;
          }

          this.notify(instructionTitle, instruction, this.LogLevel.INFO, true);
          // REVIEW: this is undesirable for token reset for the
          // test scenario I have to work with - Joel
          // There appears to be a lot of legacy password reset logic,
          // unsure what is still used.
          // if ( ! this.resetByCode ) this.pushMenu('sign-in');

          // TODO: close popup
        } catch(err) {
          var e = err;
          var msg = this.ERROR_MSG;
          var logLevel = this.LogLevel.ERROR;
          var subMsg;
          if ( foam.box.RPCErrorMessage.isInstance(e) )
            e = e.data;
          if ( this.UserFeedbackException.isInstance(e.exception) )
            e = e.exception;
          if ( e && this.UserFeedbackAware.isInstance(e) && e.userFeedback &&
               e.alertType == this.UserFeedbackAlertType.NOTIFICATION ) {
            var uf = e.userFeedback;
            msg = e.message = uf.message;
            subMsg = uf.subMessage;
            logLevel = uf.status == this.UserFeedbackStatus.ERROR ? this.LogLevel.ERROR : this.LogLevel.INFO;
          } else if ( this.UserNotFoundException.isInstance(e.exception) ) {
            msg = e.message = this.USER_NOT_FOUND_ERROR_MSG + this.email;
          } else if ( this.DuplicateEmailException.isInstance(e.exception) ) {
            this.usernameRequired = true;
            msg = e.message = this.DUPLICATE_ERROR_MSG;
          } else if ( e.message && e.message.contains("Invalid") ) {
            msg = e.message = this.USER_NOT_FOUND_ERROR_TITLE;
          }
          this.notify(msg, subMsg, logLevel, true);
          throw err;
        }
      }
    }
  ]
});
