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
  name: 'RPCReturnBox',

  implements: [ 'foam.box.Box' ],

  requires: [
    'foam.box.RPCReturnMessage'
  ],

  properties: [
    {
      name: 'promise',
      factory: function() {
        return new Promise((resolve, reject) => {
          this.resolve_ = resolve;
          this.reject_  = reject;
        });
      },
      swiftType: 'Future<Any?>',
      swiftFactory: 'return Future()'
    },
    {
      name: 'resolve_'
    },
    {
      name: 'reject_'
    },
    {
      class: 'Object',
      name: 'semaphore',
      javaType: 'java.util.concurrent.Semaphore',
      javaFactory: 'return new java.util.concurrent.Semaphore(0);'
    },
    {
      class: 'Object',
      name: 'envelope',
      type: 'foam.box.Envelope'
    }
  ],

  methods: [
    {
      name: 'send',
      code: function send(envelope) {
        var message = envelope.message;
        
        if ( this.RPCReturnMessage.isInstance(message) ) {
          this.resolve_(message.data);
          return;
        }
        // TODO: This is kind of odd, if message is an RPCErrorMessage
        // we surface that as the error rather than the inner RemoteException
        if ( foam.lang.Exception.isInstance(message) ) {
          this.reject_(message);
          return;
        }
        if ( message instanceof Error ) {
          this.reject_(message);
          return;
        }

        this.__context__.warn('Invalid message to RPCReturnBox.');
      },
      javaCode: `
setEnvelope(envelope);
getSemaphore().release();
`,
      swiftCode: `
let msg = msg!
if let o = msg.object as? foam_box_RPCReturnMessage {
  promise.set(o.data)
  return
}
promise.error(FoamError(msg.object))
      `
    }
  ]
});
