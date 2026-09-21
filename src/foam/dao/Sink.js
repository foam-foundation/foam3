/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.dao',
  name: 'Sink',

  documentation: 'Interface for receiving information updates. Primarily used as the target for DAO.select() calls.',

  methods: [
    {
      name: 'put',
      args: [
        {
          name: 'obj',
          type: 'Any'
        },
        {
          name: 'sub',
          type: 'foam.lang.Detachable'
        }
      ]
    },
    {
      name: 'remove',
      args: [
        {
          name: 'obj',
          type: 'Any'
        },
        {
          name: 'sub',
          type: 'foam.lang.Detachable'
        }
      ]
    },
    {
      name: 'eof'
    },
    {
      name: 'reset',
      args: [
        {
          name: 'sub',
          type: 'foam.lang.Detachable'
        }
      ]
    },
    {
      name: 'isOrderIndependent',
      type: 'Boolean',
      documentation: `True when the result does not depend on the order objects are
        put, so an index may drop the ORDER BY of an unlimited select instead of
        collecting and sorting every matching row. Defaults to false: a wrong
        false costs a sort, a wrong true returns rows in the wrong order.`,
      javaCode: 'return false;'
    }
  ]
});
