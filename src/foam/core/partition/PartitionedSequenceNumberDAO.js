/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionedSequenceNumberDAO',
  extends: 'foam.dao.SequenceNumberDAO',

  properties: [
    {
      class: 'String',
      name: 'prefix',
      value: 'abc-'
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
        long number = 0L;
        if ( val.length() > getPrefix().length() ) {
          number = Long.parseLong(val.substring(getPrefix().length()));
        }
        return number;
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
