/**
 * @license
 * Copyright 2017, 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.box',
  name: 'Box',
  proxy: true,
  methods: [
    {
      name: 'send',
      type: 'Void',
      args: [
        {
          name: 'envelope',
          type: 'foam.box.Envelope',
        }
      ],
      swiftThrows: true
    }
  ]
});
