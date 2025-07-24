/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'TimeoutAgent',
  implements: [ 'foam.lang.ContextAgent' ],

  properties: [
    {
      class: 'Long',
      name: 'timeout',
      units: 'ms'
    },
    {
      class: 'Object',
      javaType: 'foam.lang.ContextAgent',
      name: 'delegate'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: 'getDelegate().execute(x);'
    },
    {
      name: 'onTimeout',
      type: 'Void',
      documentation: 'onTimeout handler that executes before the agent task is cancelled due to timeout',
      javaCode: '// default to noop, but can be overridden on call site'
    }
  ]
});
