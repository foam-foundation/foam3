/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box',
  name: 'SessionedMessage',
  properties: [
    {
      class: 'String',
      name: 'sessionId'
    },
    {
      class: 'Object',
      name: 'message'
    }
  ]
});

foam.CLASS({
  package: 'foam.box',
  name: 'SessionClientBox',
  extends: 'foam.box.ProxyBox',

  requires: [
    'foam.box.Envelope',
    'foam.box.SessionReplyBox',
    'foam.box.SessionedMessage'
  ],

  imports: [
    'sessionID as jsSessionID'
  ],

  constants: [
    {
      name: 'SESSION_KEY',
      value: 'sessionId',
      type: 'String'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'sessionID',
      factory: function() { return this.jsSessionID; }
    }
  ],

  methods: [
    {
      name: 'send',
      code: function send(envelope) {
        this.delegate.send(this.Envelope.create({
          message: this.SessionedMessage.create({ sessionId: this.sessionID, message: envelope.message }),
          replyBox: this.SessionReplyBox.create({
            envelope,
            clientBox: this,
            delegate: envelope.replyBox
          })
        }));
      },
      swiftCode: `
let msg = msg!
msg.attributes[foam_box_SessionClientBox.SESSION_KEY] = sessionID
msg.attributes["replyBox"] = SessionReplyBox_create([
  "msg": msg,
  "clientBox": self,
  "delegate": msg.attributes["replyBox"] as? foam_box_Box,
])
try delegate.send(msg)
      `,
      javaCode: `
getDelegate().send(new foam.box.Envelope(new foam.box.SessionedMessage(getSessionID(), envelope.getMessage()), envelope.getReplyBox()));
`
    }
  ]
});
