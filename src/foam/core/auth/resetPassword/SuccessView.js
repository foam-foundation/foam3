/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.resetPassword',
  name: 'SuccessView',
  extends: 'foam.u2.View',

  documentation: 'Forgot Password Success View',

  imports: [
    'loginView?',
    'notify',
    'pushMenu',
    'stack'
  ],

  requires: [
    'foam.log.LogLevel'
  ],

  css: `
    <<{
      width: 490px;
      margin: auto;
    }

    << .Message-Container{
      width: 490px;
      height: 121px;
      border-radius: 2px;
      background-color: $backgroundDefault;
      padding-top: 5px;
    }

    << .Reset-Password{
      width: 225;
      height: 30px;
      text-align: left;
      color: $textDefault;
      margin-top: 20px;
      margin-bottom: 30px;
    }

    << p{
      display: inline-block;
    }

    << .success-Text{
      width: 450px;
      height: 16px;
      text-align: left;
      color: $textDefault;
      margin-top: 15px;
      margin-left: 20px;
      margin-right: 288px;
      margin-bottom: 20px;
    }

    << .Back-Button{
      width: 450px;
      height: 40px;
      border-radius: 2px;
      border: solid 1px $blue200;
      margin-left: 20px;
      margin-right: 20px;
      text-align: center;
      line-height: 40px;
      cursor: pointer;
      color: $blue200;
      margin-top: 10px;
    }
  `,

  messages: [
    { name: 'Instructions', message: 'Successfully reset password' }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this
        .addClass(this.myClass())
        .start()
          .start().addClass('md-title-sm', 'Reset-Password').add('Reset Password').end()
          .start().addClass('Message-Container')
            .start().addClass('p-light', 'success-Text').add(this.Instructions).end()
            .start().addClass('Back-Button')
              .add('Back to Sign In')
              .on('click', function() {
                this.pushMenu('sign-in');
              })
            .end()
          .end()
        .end();

      this.notify(this.Instructions, '', this.LogLevel.INFO, true);
    }
  ]
});
