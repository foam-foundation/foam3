/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'PartitionedSequenceNumberDAO',
  extends: 'foam.dao.SequenceNumberDAO',

  properties: [
    {
      class: 'String',
      name: 'prefix',
      value: 'abc-'
    },
  ],

  methods: [
    {
      name: 'getObjId',
      args: 'Object obj',
      type: 'Long',
      javaCode: `
        String val = (String) getProperty_().get(obj);
        Long number = 0L;
        if ( val.length() > getPrefix().length() ) {
          number = Long.parseLong(val.substring(getPrefix().length()));
        }
        return number;
      `
    },
    {
      name: 'setObjId',
      args: 'Object obj, Long val',
      type: 'Void',
      javaCode: `
        getProperty_().set(obj, getPrefix() + val);
        setValue_(val + 1);
      `
    }
  ]
});