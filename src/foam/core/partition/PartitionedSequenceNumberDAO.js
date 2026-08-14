/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionedSequenceNumberDAO',
  extends: 'foam.dao.SequenceNumberDAO',

  javaCode: `
    public PartitionedSequenceNumberDAO(foam.lang.X x, String prefix, foam.dao.DAO delegate) {
      setX(x);
      setPrefix(prefix);
      setDelegate(delegate);
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'prefix'
    }
  ],

  methods: [
    {
      name: 'getObjId',
      args: 'Object obj',
      type: 'Long',
      javaCode: `
        // Called in SequenceNumberDAO.put() to determine the objects' seqno
        String val = (String) getProperty_().get(obj);
        if ( val.length() <= getPrefix().length() ) return 0L;
        try {
          return Long.parseLong(val.substring(getPrefix().length()));
        } catch ( NumberFormatException e ) {
          // Migrated composite id with a non-numeric legacy suffix
          // (<part>-<oldId>): treat as set-but-not-sequential so put_
          // neither restamps it nor bumps the counter.
          return -1L;
        }
      `
    },
    {
      name: 'setObjId',
      args: 'Object obj, long val',
      type: 'Void',
      javaCode: `
        // Called in SequenceNumberDAO.put() to set the objects' seqno
        getProperty_().set(obj, getPrefix() + val);
        setValue_(val + 1);
      `
    }
  ]
});
