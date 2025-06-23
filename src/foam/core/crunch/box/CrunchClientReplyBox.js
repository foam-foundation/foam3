/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.box',
  name: 'CrunchClientReplyBox',
  extends: 'foam.box.ProxyBox',

  documentation: `
    This box decorates reply boxes sent to CrunchClientBox.
  `,

  requires: [
    'foam.box.RPCErrorMessage',
    'foam.box.RemoteException',
    'foam.box.RPCReturnMessage',
    'foam.core.crunch.CapabilityIntercept'
  ],

  imports: [
    'crunchController'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.box.Envelope',
      name: 'envelope',
    },
    {
      class: 'FObjectProperty',
      name: 'clientBox',
      type: 'foam.box.Box'
    }
  ],

  methods: [
    {
      name: 'send',
      code: function send(envelope) {
        var self = this;
        var message = envelope.message;
        if (
          this.RPCErrorMessage.isInstance(message) &&
          this.RemoteException.isInstance(message.data) &&
          this.CapabilityIntercept.isInstance(message.data.exception)
        ) {
          var intercept = message.data.exception;
          intercept.message = message.data.message;

          // Configure events CapabilityIntercept completion
          intercept.resolve = function (value) {
            self.delegate.send(foam.box.Envelope.create({ message: self.RPCReturnMessage.create({ data: value }) }));
          };
          intercept.reject = function (value) {
            self.delegate.send(foam.box.Envelope.create({ message: new Error(value) }));
          };
          intercept.resend = function () {
            self.clientBox.send(self.envelope);
          };

          // Ask CrunchController to handle the intercept
          this.crunchController.handleIntercept(intercept);
          return;
        }

        this.delegate.send(envelope);
      }
    }
  ]
});
