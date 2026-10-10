/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionedSequenceNumberDAO',
  extends: 'foam.dao.SequenceNumberDAO',

  documentation: `Numbers the last segment of a composite <part>~...~<seqNo>
    id. Only the segment after the last separator is read or written, so the
    id keeps every partition prefix the levels above stamped on it, however
    many there are.`,

  javaImports: [
    'foam.core.partition.AbstractPartitionedDAO'
  ],

  javaCode: `
    public PartitionedSequenceNumberDAO(foam.lang.X x, foam.dao.DAO delegate) {
      setX(x);
      setDelegate(delegate);
    }
  `,

  methods: [
    {
      name: 'getObjId',
      args: 'Object obj',
      type: 'Long',
      javaCode: `
        // Called in SequenceNumberDAO.put() to determine the objects' seqno
        String val  = (String) getProperty_().get(obj);
        String tail = val.substring(val.lastIndexOf(AbstractPartitionedDAO.SEPARATOR) + 1);
        if ( tail.isEmpty() ) return 0L;
        try {
          return Long.parseLong(tail);
        } catch ( NumberFormatException e ) {
          // Migrated composite id with a non-numeric legacy suffix
          // (<part>~<oldId>): treat as set-but-not-sequential so put_
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
        String id = (String) getProperty_().get(obj);
        getProperty_().set(obj, id.substring(0, id.lastIndexOf(AbstractPartitionedDAO.SEPARATOR) + 1) + val);
        setValue_(val + 1);
      `
    }
  ]
});
