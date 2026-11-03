/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionedSequenceNumberDAO',
  extends: 'foam.dao.SequenceNumberDAO',

  documentation: `Numbers String ids of the form <part>~...~<n>. The number is
    whatever follows the last separator, so the same leaf works at any depth:
    two levels down it holds ids like 1~5~7 while it only knows its own part.`,

  methods: [
    {
      name: 'getObjId',
      args: 'Object obj',
      type: 'Long',
      javaCode: `
        // Called in SequenceNumberDAO.put() to determine the objects' seqno.
        // A new record arrives with nothing after the last separator ("1~5~").
        String val = (String) getProperty_().get(obj);
        String key = val.substring(val.lastIndexOf(AbstractPartitionedDAO.SEPARATOR) + 1);
        if ( key.isEmpty() ) return 0L;
        try {
          return Long.parseLong(key);
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
        // Called in SequenceNumberDAO.put() to set the objects' seqno after its partitions
        String id = (String) getProperty_().get(obj);
        getProperty_().set(obj, id.substring(0, id.lastIndexOf(AbstractPartitionedDAO.SEPARATOR) + 1) + val);
        setValue_(val + 1);
      `
    }
  ]
});
