/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box',
  name: 'KeepAlivePing'
});

foam.CLASS({
  package: 'foam.box',
  name: 'KeepAlivePong'
});


foam.CLASS({
  package: 'foam.box',
  name: 'KeepAliveBox',
  extends: 'foam.box.ProxyBox',
  flags: ['js'],

  requires: [
    'foam.box.Envelope',
    'foam.box.KeepAlivePing',
    'foam.box.KeepAlivePong',
    'foam.box.RetryBox',
    'foam.box.TimeoutBox'
  ],

  documentation: `Implements a TCP style keepalive ping.`,

  imports: [
    'setTimeout',
    'clearTimeout'
  ],

  properties: [
    {
      class: 'Int',
      name: 'time',
      units: 'ms',
      value: 30000
    },
    {
      class: 'Int',
      name: 'interval',
      units: 'ms',
      value: 5000
    },
    {
      name: 'retry',
      value: 3
    },
    {
      name: 'pingCount',
      value: 0
    },
    'idleTimeout',
    'pingTimeout'
  ],

  topics: [
    'timeout'
  ],

  methods: [
    function send(envelope) {
      var self = this;
      
      this.delegate.send(foam.box.Envelope.create({
        message: envelope.message,
        replyBox: {
          delegate: envelope.replyBox,
          send: (envelope) => {
            // If the response was not an error, start the keep-alive timer
            
            // TODO: A parent class would is some sort of isRemoteError would be good here
            if ( ! foam.net.NotConnectedException.isInstance(envelope.message) &&
                 ! foam.net.ConnectionFailedException.isInstance(envelope.message) ) {
              self.resetIdle();
              this.delegate.send(envelope);
            }
          }
        }
      }));
    },
    function resetIdle() {
      // reset idle timer
      this.clearTimeout(this.idleTimeout);
      this.idleTimeout = this.setTimeout(this.onIdle, this.time);
    },
    function doPing() {
      // use a retry+timeout box
      var box = this.RetryBox.create({
        maxAttempts: this.retry,
        maxDelay: 0,
        delegate: this.TimeoutBox.create({
          timeout: this.interval,
          delegate: this.delegate
        })
      });

      // send a ping with a timeout
      box.send(
        this.Envelope.create({
          message: this.KeepAlivePing.create(),
          replyBox: {
            send: (envelope) => {
              // ping failed, notify
              if ( foam.lang.Exception.isInstance(envelope.message) ) {
                this.timeout.pub();
              } else {
                // successful pong, reset idle timer
                this.resetIdle();
              }
            }
          }
        }));
    }
  ],

  listeners: [
    {
      name: 'onIdle',
      code: function() {
        if ( this.isDetached() ) {
          // ignore idle timeout for detached box
          return;
        }
        this.doPing();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.box',
  name: 'KeepAliveServerBox',
  extends: 'foam.box.ProxyBox',
  requires: [
    'foam.box.Envelope',
    'foam.box.KeepAlivePing',
    'foam.box.KeepAlivePong'
  ],
  methods: [
    {
      name: 'send',
      code: function(envelope) {
        // if the envelope contains a KeepAlivePing, reply with a keepalive pong, otherwise pass to delegate
        if ( this.KeepAlivePing.isInstance(envelope.message) ) {
          envelope.replyBox.send(this.Envelope.create({
            message: this.KeepAlivePong.create()
          }));
        } else {
          this.delegate.send(envelope);
        }
      },
      javaCode: `
if ( envelope.getMessage() instanceof foam.box.KeepAlivePing ) {
  envelope.getReplyBox().send(new foam.box.Envelope.Builder(null)
    .setMessage(new foam.box.KeepAlivePong())
    .build()
  );
} else {
  super.send(envelope);
}
      `
    }
  ]
});
