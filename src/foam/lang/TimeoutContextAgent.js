/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'TimeoutContextAgent',
  implements: [ 'foam.lang.ContextAgent' ],

  properties: [
    {
      class: 'Long',
      name: 'timeout',
      units: 'ms'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: 'throw new RuntimeException("Not implemented");'
    },
    {
      name: 'onTimeout',
      type: 'Void',
      documentation: 'onTimeout handler that executes before the agent task is cancelled due to timeout',
      javaCode: '// default to noop, but can be overridden on call site'
    }
  ]
});
