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
