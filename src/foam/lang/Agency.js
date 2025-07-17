/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.lang',
  name: 'Agency',

  methods: [
    {
      name: 'submit',
      type: 'java.util.concurrent.Future<?>',
      args: 'Context x, foam.lang.ContextAgent agent, String description'
    },
    {
      name: 'schedule',
      type: 'Void',
      args: 'Context x, foam.lang.ContextAgent agent, String description, long delay'
    }
  ]
});
