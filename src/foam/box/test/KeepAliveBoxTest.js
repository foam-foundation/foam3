/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.test',
  name: 'KeepAliveBoxTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    KeepAliveBox keeps a quiet WebSocket open: it pings before the server's
    idle timeout and passes every reply on to the caller. Runs on a fake clock.
  `,

  requires: [
    'foam.box.Envelope',
    'foam.box.KeepAliveBox',
    'foam.box.KeepAlivePing',
    'foam.box.KeepAlivePong',
    'foam.box.RPCMessage',
    'foam.box.RPCReturnMessage',
    'foam.box.WebSocketBox',
    'foam.dao.EasyDAO',
    'foam.net.NotConnectedException'
  ],

  constants: [
    {
      name: 'SERVER_IDLE_LIMIT',
      documentation: 'Jetty closes a WebSocket that carried nothing for this long.',
      value: 30000
    }
  ],

  methods: [
    async function runTest(x) {
      this.testReplyReachesCaller(x);
      this.testNetworkErrorReachesCaller(x);
      this.testOneWayMessageHasNoReplyBox(x);
      this.testQuietSocketStaysOpen(x);
      this.testListeningClientPings(x);
    },

    function fakeClock() {
      var clock = { now: 0, timers: [], nextId: 1 };
      clock.setTimeout = function(fn, ms) {
        var id = clock.nextId++;
        clock.timers.push({ id: id, at: clock.now + ( ms || 0 ), fn: fn });
        return id;
      };
      clock.clearTimeout = function(id) {
        clock.timers = clock.timers.filter(function(t) { return t.id !== id; });
      };
      // Moves time on one second at a time and runs the timers that are due.
      clock.advance = function(ms) {
        var end = clock.now + ms;
        while ( clock.now < end ) {
          clock.now += 1000;
          var due = clock.timers.filter(function(t) { return t.at <= clock.now; });
          clock.timers = clock.timers.filter(function(t) { return t.at > clock.now; });
          due.forEach(function(t) { t.fn(); });
        }
      };
      return clock;
    },

    function fakeSocket(clock, answer) {
      /* The server end of a socket: answers every message at once, and
         keeps the longest time it carried nothing. A frame that comes at
         the idle limit is too late: the server has closed the socket. */
      var self   = this;
      var socket = { sent: [], lastFrameAt: clock.now, longestQuiet: 0 };
      socket.quietFor = function() { return clock.now - socket.lastFrameAt; };
      socket.send = function(envelope) {
        socket.longestQuiet = Math.max(socket.longestQuiet, socket.quietFor());
        socket.sent.push(envelope);
        socket.lastFrameAt = clock.now;
        if ( ! envelope.replyBox ) return;
        var message = self.KeepAlivePing.isInstance(envelope.message) ?
          self.KeepAlivePong.create() :
          answer();
        envelope.replyBox.send(self.Envelope.create({ message: message }));
      };
      return socket;
    },

    function keepAliveBox(x, clock, socket) {
      return this.KeepAliveBox.create({ delegate: socket }, x.createSubContext({
        setTimeout:   clock.setTimeout,
        clearTimeout: clock.clearTimeout
      }));
    },

    function call(box, onReply) {
      box.send(this.Envelope.create({
        message:  this.RPCMessage.create({ name: 'find_', args: [] }),
        replyBox: { send: onReply }
      }));
    },

    function testReplyReachesCaller(x) {
      var clock   = this.fakeClock();
      var socket  = this.fakeSocket(clock, () => this.RPCReturnMessage.create({ data: 42 }));
      var box     = this.keepAliveBox(x, clock, socket);
      var replies = [];

      this.call(box, function(e) { replies.push(e.message); });

      x.test(replies.length === 1 && replies[0].data === 42, 'a reply reaches the caller');
      x.test(socket.sent.length === 1, 'a reply is not sent back to the server');
    },

    function testNetworkErrorReachesCaller(x) {
      var clock   = this.fakeClock();
      var socket  = this.fakeSocket(clock, () => this.NotConnectedException.create());
      var box     = this.keepAliveBox(x, clock, socket);
      var replies = [];

      this.call(box, function(e) { replies.push(e.message); });

      x.test(replies.length === 1 && this.NotConnectedException.isInstance(replies[0]),
        'a network error reaches the caller, so RetryBox can retry');
      clock.advance(5 * 60 * 1000);
      x.test(socket.sent.length === 1, 'no ping after a network error: the socket is gone');
    },

    function testOneWayMessageHasNoReplyBox(x) {
      var clock  = this.fakeClock();
      var socket = this.fakeSocket(clock, () => this.RPCReturnMessage.create());
      var box    = this.keepAliveBox(x, clock, socket);

      box.send(this.Envelope.create({ message: this.RPCMessage.create({ name: 'put_' }) }));

      x.test(socket.sent.length === 1 && ! socket.sent[0].replyBox,
        'a message that wants no reply goes out without a reply box');
    },

    function testQuietSocketStaysOpen(x) {
      var clock  = this.fakeClock();
      var socket = this.fakeSocket(clock, () => this.RPCReturnMessage.create());
      var box    = this.keepAliveBox(x, clock, socket);

      // The listen call: after it nothing is sent, as with a listener nobody changes.
      this.call(box, function() {});
      clock.advance(5 * 60 * 1000);
      var longestQuiet = Math.max(socket.longestQuiet, socket.quietFor());

      var pings = socket.sent.filter(e => this.KeepAlivePing.isInstance(e.message)).length;
      x.test(longestQuiet < this.SERVER_IDLE_LIMIT,
        'a quiet socket is never idle for the server\'s 30 s limit in five minutes, longest quiet: ' + longestQuiet + ' ms');
      x.test(pings >= 10, 'pings keep going while the socket stays quiet, pings: ' + pings);
    },

    function testListeningClientPings(x) {
      var dao = this.EasyDAO.create({
        of:                    this.cls_,
        daoType:               'CLIENT',
        serviceName:           'keepAliveTestDAO',
        remoteListenerSupport: true
      });

      // Walk the boxes down to the socket, without opening it.
      var box = dao.serverBox;
      while ( box && ! this.KeepAliveBox.isInstance(box) && ! this.WebSocketBox.isInstance(box) ) {
        box = box.delegate;
      }

      x.test(this.KeepAliveBox.isInstance(box) && this.WebSocketBox.isInstance(box.delegate),
        'a client with remoteListenerSupport pings its WebSocket');
    }
  ]
});
