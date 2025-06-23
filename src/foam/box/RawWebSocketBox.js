/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.box',
  name: 'RawWebSocketBox',
  implements: ['foam.box.Box'],
  requires: [
    'foam.box.ReplyBox',
    {
      path: 'foam.box.ReplyBox2',
      flags: ['js']
    },
    {
      path: 'foam.json.Parser',
      flags: ['js']
    },
    'foam.box.ReturnBox',
    'foam.box.SubBox',
    'foam.net.ConnectionFailedException',
    'foam.net.NotConnectedException',
    {
      path: 'foam.json.Outputter',
      flags: ['js']
    }
  ],

  exports: [
    'subBox'
  ],

  javaCode: `
    protected static final ThreadLocal<foam.lib.formatter.FObjectFormatter> formatter_ = new ThreadLocal<foam.lib.formatter.FObjectFormatter>() {
      @Override
      protected foam.lib.formatter.JSONFObjectFormatter initialValue() {
        foam.lib.formatter.JSONFObjectFormatter formatter = new foam.lib.formatter.JSONFObjectFormatter();
        // Needed because JS JSON parser doesn't support unquoted keys.
        formatter.setQuoteKeys(true);
        formatter.setOutputShortNames(true);
        formatter.setOutputDefaultValues(false);
        formatter.setPropertyPredicate(new foam.lib.AndPropertyPredicate(new foam.lib.PropertyPredicate[] {new foam.lib.NetworkPropertyPredicate(), new foam.lib.PermissionedPropertyPredicate()}));
        return formatter;
      }

      @Override
      public foam.lib.formatter.FObjectFormatter get() {
        foam.lib.formatter.FObjectFormatter formatter = super.get();
        formatter.reset();
        return formatter;
      }
    };

    protected static final ThreadLocal<foam.util.UIDGenerator> uidGenerator_ = new ThreadLocal<foam.util.UIDGenerator>() {
      @Override
      protected foam.util.UIDGenerator initialValue() {
        return new foam.util.AUIDGenerator(null, "websockets");
      }
    };
  `,
  
  constants: [
    {
      name: 'NEXT_ID',
      value: [0]
    }
  ],

  properties: [
    {
      class: 'Object',
      name: 'socket',
      javaType: 'foam.net.WebSocket'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.json.Parser',
      name: 'parser',
      generateJava: false,
      factory: function() {
        return this.Parser.create({
          strict:          true,
        });
      },
    },
    {
      class: 'FObjectProperty',
      of: 'foam.json.Outputter',
      swiftType: 'foam_swift_parse_json_output_Outputter',
      name: 'outputter',
      generateJava: false,
      factory: function() {
        return this.Outputter.create().copyFrom(foam.json.Network);
      }
    },
    {
      class: 'Map',
      name: 'replies',
      javaFactory: `return new java.util.concurrent.ConcurrentHashMap<String, Box>();`,
    }
  ],

  methods: [
    function init() {
      this.socket.disconnected.sub(() => {
        for ( let box of Object.values(this.replies) ) {
          box.send(foam.box.Envelope.create({
            message: this.ConnectionFailedException.create()
          }));
        }
      });

      this.socket.message.sub(this.onMessage);
    },
    {
      name: 'subBox',
      args: [
        { name: 'delegate', type: 'foam.box.Box' },
        { name: 'once', type: 'Boolean' },
      ],
      code: function subBox(delegate, once = true) {
        var self = this;
        var name = this.NEXT_ID[0]++;
        
        this.replies[name] = {
          send: function(message, replyBox) {
            if ( once ) delete self.replies[name]
            delegate.send(message, replyBox);
          }
        };

        return this.SubBox.create({
          name,
          delegate: this.ReturnBox.create(),
        });
      },
      javaCode: `

`
    },
    {
      name: 'send',
      code: function send(envelope) {
        if ( this.socket.isConnected ) {
          envelope.replyBox?.send(foam.box.Envelope.create({ message: this.NotConnectedException.create() }));
          return;
        }
        
        var outgoing = foam.box.Envelope.create({
          message: envelope.message,
          replyBox: this.subBox(envelope.replyBox, true)
        });

        var payload = this.outputter.stringify(outgoing);
        this.socket.send(payload);
      },
      javaCode: `
foam.box.Envelope outgoing = envelope;
foam.box.Box replyBox = envelope.getReplyBox();
if ( replyBox != null ) {
  foam.box.Box exportReplyBox = new foam.box.SubBox.Builder(getX())
    .setName(uidGenerator_.get().generate())
    .setDelegate(new foam.box.ReturnBox())
    .build();

  outgoing = new foam.box.Envelope(outgoing.getMessage(), exportReplyBox);
}


foam.lib.formatter.FObjectFormatter formatter = formatter_.get();
formatter.setX(getX());
formatter.output(outgoing);

String payload = formatter.builder().toString();
formatter.setX(null);

try {
  getSocket().send(payload);
} catch ( java.io.IOException e ) {
  throw new RuntimeException(e);
}
`
    }
  ],
  
  listeners: [
    {
      name: 'onMessage',
      code: function(s, _, msgStr) {
        try {
          var envelope = this.parser.parseString(msgStr, this.__context__);
          var message = envelope.message;
          var replyBox = envelope.replyBox;

          if ( ! foam.box.SubBoxMessage.isInstance(message) ) {
            console.warn("Got a non sub box message to our websocket, ignoring");
            return
          }

          // unwrap sub box message
          var name = message.name;
          message = message.message;
          
          var delegate = this.replies[name]
          if ( delegate ) {
            delegate.send(foam.box.Envelope.create({ message, replyBox }));
          } else {
            console.log("Failed to find reply box for message, payload was", msgStr);
          }
        } catch (e) {
          console.error("WSS Error:", e);
        }
      }
    }
  ]
});
