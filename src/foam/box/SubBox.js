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
  name: 'SubBox',
  extends: 'foam.box.ProxyBox',

  requires: [
    'foam.box.SubBoxMessage'
  ],

  properties: [
    {
      class: 'String',
      name: 'name'
    }
  ],

  methods: [
    {
      name: 'send',
      code: function(envelope) {
        this.delegate.send(foam.box.Envelope.create({
          message: this.SubBoxMessage.create({
            message: envelope.message,
            name: this.name,
          }),
          replyBox: envelope.replyBox
        }));
      },
      swiftCode: `
msg?.object = SubBoxMessage_create([
  "name": name,
  "object": msg?.object
])
try delegate.send(msg);`,
      javaCode: `
foam.box.SubBoxMessage message = new foam.box.SubBoxMessage.Builder(null)
  .setName(getName())
  .setMessage(envelope.getMessage())
  .build();

getDelegate().send(new foam.box.Envelope(message, envelope.getReplyBox()));
`
    }
  ]
});
