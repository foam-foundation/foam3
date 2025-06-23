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
  name: 'TimeoutException',
  implements: ['foam.lang.Exception']
});

foam.CLASS({
  package: 'foam.box',
  name: 'TimeoutBox',
  //  implements: ['foam.box.Box'],
  extends: 'foam.box.ProxyBox',
  requires: [
    'foam.box.TimeoutException',
    'foam.box.Envelope'
  ],
  properties: [
    {
      class: 'Int',
      name: 'timeout',
      // TODO: change this back to 5s once we have the cacheDAO.
      value: 60000,
      preSet: function(old, nu) {
        // TODO: Try to detect CPF-1625
        if ( nu < 5000 ) {
          console.warn("Setting timeout to low value", nu);
          return 5000;
        }
        return nu;
      }
    }
  ],
  methods: [
    function send(envelope) {
      if ( ! envelope.replyBox ) {
        this.delegate.send(envelope);
        return;
      }

      var replyBox = envelope.replyBox;
      var tooLate = false;
      var timer = setTimeout(function() {
        tooLate = true;
        replyBox.send(foam.box.Envelope.create({ message: this.TimeoutException.create() }))
      }.bind(this), this.timeout);

      var self = this;

      this.delegate.send(foam.box.Envelope.create({
        message: envelope.message,
        replyBox: {
          send: function(envelope) {
            if ( ! tooLate ) {
              clearTimeout(timer);
              replyBox.send(envelope);
              return;
            }
          }
        }
      }));

    }
  ]
});
