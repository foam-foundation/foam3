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
    'foam.box.TimeoutBox',
    'foam.net.NetworkException'
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
      documentation: `How long the connection may stay quiet before a ping.
        Keep it under the server's idle timeout: Jetty closes a quiet
        WebSocket after 30 s.`,
      value: 15000
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
      var replyBox = envelope.replyBox;

      if ( ! replyBox ) {
        this.delegate.send(envelope);
        return;
      }

      this.delegate.send(this.Envelope.create({
        message: envelope.message,
        replyBox: {
          send: (reply) => {
            // A reply means the connection works: ping again after 'time'
            // of quiet. A network error means it does not, so stop pinging
            // until the next call gets through.
            if ( ! this.NetworkException.isInstance(reply.message) ) {
              this.resetIdle();
            }
            replyBox.send(reply);
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
