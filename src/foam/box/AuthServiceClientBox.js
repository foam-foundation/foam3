/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box',
  name: 'AuthServiceClientBox',
  extends: 'foam.box.ProxyBox',

  documentation: 'Like SessionClientBox but does decorate the replyBox',

  requires: [
    'foam.box.SessionedMessage'
  ],

  imports: [ 'sessionID' ],

  constants: [
    {
      name: 'SESSION_KEY',
      value: 'sessionId'
    }
  ],

  methods: [
    {
      name: 'send',
      code: function send(envelope) {
        this.delegate.send(foam.box.Envelope.create({
          message: this.SessionedMessage.create({
            sessionId: this.sessionID,
            message: envelope.message,
          }),
          replyBox: envelope.replyBox
        }));
      }
    }
  ]
});
