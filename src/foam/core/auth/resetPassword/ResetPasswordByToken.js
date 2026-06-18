
  /**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.core.auth.resetPassword',
  name: 'ResetPasswordByToken',
  extends: 'foam.core.auth.resetPassword.ResetPassword',

  documentation: 'Reset Password By Token Model',

  imports: [
    'ctrl',
    'resetPasswordToken',
    'notify'
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.core.auth.User'
  ],

  messages: [
    { name: 'INVALID_TOKEN', message: 'Invalid token' },
    { name: 'TOKEN_ALREADY_USED', message: 'Token already used' },
    { name: 'TOKEN_EXPIRED', message: 'Token expired' }
  ],

  properties: [
    {
      class: 'String',
      name: 'token',
      factory: function() {
        const searchParams = new URLSearchParams(location.search);
        return searchParams.get('token');
      },
      hidden: true
    }
  ],

  methods: [
    function init() {
      this.resetPasswordToken.validateToken(null, this.token)
        .catch((err) => {
          this.loadingError = this[err.message] || err.message;
        });
    },
  ],

  actions: [
    {
      name: 'resetPassword',
      label: 'Confirm',
      buttonStyle: 'PRIMARY',
      section: 'resetPasswordSection',
      isEnabled: function(errors_) {
        return ! errors_;
      },
      isAvailable: function(showSubmitAction) {
        return showSubmitAction;
      },
      code: function(X) {
        const user = this.User.create({
          desiredPassword: this.newPassword
        });

        this.resetPasswordToken.processToken(null, user, this.token)
        .then((_) => {
          this.finalRedirectionCall();

          this.notify(this.SUCCESS_MSG_TITLE, '', this.SUCCESS_MSG, true);
        }).catch((err) => {
          this.notify(err.data, this.ERROR_MSG, this.LogLevel.ERROR, true);
        });
      }
    }
  ]
});
