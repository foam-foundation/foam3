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
  name: 'SkeletonBox',
  implements: ['foam.box.Box'],
  flags: ['js', 'swift'],

  requires: [
    'foam.net.NetworkException',
    'foam.box.InvalidMessageException',
    'foam.box.RPCErrorMessage',
    'foam.box.RPCMessage',
    'foam.box.RPCReturnMessage'
  ],

  properties: [
    {
      name: 'data'
    }
  ],

  methods: [
    {
      name: 'call',
      args: [
        {
          name: 'envelope',
          type: 'foam.box.Envelope',
        }
      ],
      code: function(envelope) {
        var p;

        try {
          var message  = envelope.message;
          var replyBox = envelope.replyBox;
          var method   = this.data.cls_.getAxiomByName(message.name);
          var args     = message.args.slice();

          // TODO: This is pretty hackish.  Context-Oriented methods should just be modeled.
          // TODO: at least check that the javaType is foam.lang.X
          if ( method && method.args && method.args[0] && method.args[0].name == 'x' ) {
            args[0] = this.__subContext__;
          }
          p = this.data[message.name].apply(this.data, args);
        } catch(e) {
          replyBox?.send(foam.box.Envelope.create({ message: this.RPCErrorMessage.create({ data: e.message })}));
          return;
        }

        var self = this;

        if ( p instanceof Promise ) {
          p.then(
            function(data) {
              replyBox?.send(foam.box.Envelope.create({
                message: self.RPCReturnMessage.create({ data: data })
              }));
            },
            function(error) {
              replyBox?.send(foam.box.Envelope.create({
                message: self.RPCErrorMessage.create({ data: error && error.toString() })
              }));
            });
        } else {
          replyBox?.send(foam.box.Envelope.create({
            message: this.RPCReturnMessage.create({ data: p })
          }));
        }
      },
      swiftCode: `
let message = message!
do {
  guard let object = message.object as? foam_box_RPCMessage,
        let data = self.data as? foam_core_FObject,
        let method = data.ownClassInfo().axiom(byName: object.name) as? MethodInfo
  else {
    throw InvalidMessageException_create()
  }

  // TODO handle context oriented methods.

  var p = try method.call(data, args: object.args)

  guard let replyBox = message.attributes["replyBox"] as? foam_box_Box else { return }
  if let pFut = p as? Future<Any> { p = try pFut.get() }
  try replyBox.send(Message_create([
    "object": RPCReturnMessage_create(["data": p])
  ]))
} catch let e {
  if let errorBox = message.attributes["errorBox"] as? foam_box_Box {
    try? errorBox.send(Message_create([
      "object": RPCErrorMessage_create([
        "data": e.localizedDescription
      ])
    ]))
  }
}
      `,
    },

    {
      name: 'send',
      code: function(envelope) {
        if ( this.RPCMessage.isInstance(envelope.message) ) {
          this.call(envelope);
          return;
        }

        if ( this.NetworkException.isInstance(envelope.message) ) {
          // todo: is detach right? or should we just pub a special message
          // the idea here is that if the object has been released/lost on the remote side
          // we can clean up here.
          this.data.detach();
          return;
        }

        throw this.InvalidMessageException.create({
          messageType: envelope.cls_ && envelope.cls_.id
        });
      },
      swiftCode: `
let msg = msg!
if let _ = msg.object as? foam_box_RPCMessage {
  call(msg)
  return
}

throw InvalidMessageException_create([
  "messageType": msg.ownClassInfo().id,
])
      `,
    },
  ]
});
