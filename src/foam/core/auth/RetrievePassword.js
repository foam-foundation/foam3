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
    'pushMenu',
    'resetPasswordService',
    'resetPasswordToken',
    'stack',
    'translationService'
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.core.auth.DuplicateEmailException',
    'foam.core.auth.User',
    'foam.core.auth.UserNotFoundException',
    'foam.u2.dialog.NotificationMessage'
  ],

  messages: [
    { name: 'TITLE', message: 'Forgot Password?' },
    { name: 'INSTRUCTION', message: 'Enter the email you used to create your account in order to reset your password.' },
    { name: 'TOKEN_INSTRUC_TITLE',      message: 'Password Reset Instructions Sent' },
    { name: 'TOKEN_INSTRUC',            message: 'Please check your inbox to continue' },
    { name: 'CODE_INSTRUC_TITLE',       message: 'Verification code sent' },
    { name: 'CODE_INSTRUC',             message: 'Please check your inbox to reset your password' },
    { name: 'REDIRECTION_TO',           message: 'Back to Sign in' },
    { name: 'DUPLICATE_ERROR_MSG',      message: 'This account requires username' },
    { name: 'ERROR_MSG',                message: 'Issue resetting your password. Please try again' },
    { name: 'USER_NOT_FOUND_ERROR_MSG', message: 'Unable to find user with email: '},
    { name: 'USER_NOT_FOUND_ERROR_TITLE', message: 'Invalid Email'}
  ],

  sections: [
    {
      name: 'resetPasswordSection',
      title: 'Reset Password',
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
      label: 'Submit',
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

          this.ctrl.add(this.NotificationMessage.create({
            message: instructionTitle,
            description: instruction,
            type: this.LogLevel.INFO,
            transient: true
          }));
          if ( ! this.resetByCode ) this.pushMenu('sign-in');
        } catch(err) {
          var msg = this.ERROR_MSG;
          if ( this.UserNotFoundException.isInstance(err.data.exception) ) {
            msg = err.data.message =  this.USER_NOT_FOUND_ERROR_MSG + this.email;
            err.data.title = this.USER_NOT_FOUND_ERROR_TITLE;
          }
          if ( this.DuplicateEmailException.isInstance(err.data.exception) ) {
            this.usernameRequired = true;
            msg =  err.data.message = this.DUPLICATE_ERROR_MSG;
          }
          if ( ! X.wizardController?.status == 'IN_PROGRESS' ) {
            this.ctrl.add(this.NotificationMessage.create({
              message: msg,
              type: this.LogLevel.ERROR,
              transient: true
            }));
          }
          throw err;
        }
      }
    }
  ]
});
