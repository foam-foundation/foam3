/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'BaseClientSink',
  implements: [ 'foam.dao.Sink' ],

  properties: [
    {
      class: 'Stub',
      of: 'foam.dao.Sink',
      name: 'delegate',
      notifications: [ 'put', 'remove', 'eof', 'reset' ]
    }
  ]
});

foam.CLASS({
  package: 'foam.dao',
  name: 'ClientSink',
  extends: 'foam.dao.BaseClientSink',
  documentation: 'Nulls out the "subscription" argument for sink methods until remote support is figured out for those.',

  methods: [
    {
      name: 'put',
      code: function(obj, sub) {
        this.SUPER(obj, null);
      },
      javaCode: `super.put(obj, null);`
    },
    {
      name: 'remove',
      code: function(obj, sub) {
        this.SUPER(obj, null);
      },
      javaCode: `super.remove(obj, null);`
    },
    {
      name: 'reset',
      code: function(sub) {
        this.SUPER(null);
      },
      javaCode: `super.reset(null);`
    },
  ]
});
