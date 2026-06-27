/**
 * @license
 * Copyright 2017, 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box',
  name: 'SessionReplyBox',
  extends: 'foam.box.ProxyBox',

  requires: [
    'foam.box.RPCErrorMessage'
  ],

  imports: [
    'auth?',
    'ctrl?',
    'group?',
    'logAnalyticEvent?',
    'loginSuccess?',
    'requestLogin?',
    'sessionTimer?',
    'subject?'
  ],

  messages: [
    {
      name: 'REFRESH_MSG',
      message: 'Your session has expired. The page will now be refreshed so that you can log in again.',
    }
  ],

  properties: [
    {
      name: 'envelope',
      type: 'Object'
    },
    {
      name: 'clientBox',
    },
    {
      class: 'Boolean',
      name: 'refreshSessionTimer',
      value: true
    }
  ],

  methods: [
    {
      name: 'send',
      code: async function send(envelope) {
        var self = this;
        if (
          this.RPCErrorMessage.isInstance(envelope.message) &&
          envelope.message.data.id === 'foam.core.auth.AuthenticationException'
        ) {
          if ( ! this.auth$ ) {
            return;
          }
          // If the user is already logged in when this happens, then we know
          // that something occurred on the backend to destroy this user's
          // session. Therefore we reset the client state and ask them to log
          // in again.
          var promptlogin = await this.auth.check(null, 'auth.promptlogin');
          var authResult  = await this.auth.check(null, '*');

          if ( this.loginSuccess && ( ! promptlogin || authResult ) ) {
            try {
              this.ctrl.reload();
            } catch ( e ) {
              console.error(e, 'WINDOW_RELOAD');
              // Failed ApplicationController reload, so
              // - alter loginSuccess state manually to hide the top navigation
              // - log analytic event and
              // - force window reload explicitly
              this.loginSuccess = false;

              // Log analytic event
              this.logAnalyticEvent?.({
                name: 'WINDOW_RELOAD',
                userId: this.subject?.realUser.id,
                extra: foam.json.stringify({
                  'ctrl_checked': !! this.ctrl,
                  'ctrl_reload_checked': !! this.ctrl?.reload,
                  'url': globalThis.window.location.href
                })
              });
              globalThis.window.location.reload();
            }
          } else {
            this.requestLogin().then(function() {
              self.clientBox.send(self.envelope);
            });
          }
        } else {
          // fetch the soft session limit from group, and then start the timer
          if ( this.group && this.sessionTimer && this.refreshSessionTimer && this.group && this.group.id !== '' && this.group.softSessionLimit !== 0 ) {
            this.sessionTimer.startTimer(this.group.softSessionLimit);
          }

          this.delegate.send(envelope);
        }
      }
    }
  ]
});
