/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'AbstractSink',
  implements: [ 'foam.dao.Sink' ],

  documentation: 'Abstract base class for implementing Sink interface.',

  methods: [
    {
      name: 'isOrderIndependent',
      code: function() { return false; }
    },
    {
      name: 'put',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: '// NOOP'
    },
    {
      name: 'remove',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: '// NOOP'
    },
    {
      name: 'eof',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: '// NOOP'
    },
    {
      name: 'reset',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: '// NOOP'
    }
  ]
});
