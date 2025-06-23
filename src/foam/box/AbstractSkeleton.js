/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box',
  name: 'AbstractSkeleton',
  implements: [ 'foam.box.Skeleton' ],

  abstract: true,

  methods: [
    {
      name: 'tobyte',
      type: 'Byte',
      args: [ { type: 'Object', name: 'o' } ],
      javaCode: `return ((Number) o).byteValue();`
    },
    {
      name: 'todouble',
      type: 'Double',
      args: [ { type: 'Object', name: 'o' } ],
      javaCode: `return ((Number) o).doubleValue();`
    },
    {
      name: 'tofloat',
      type: 'Float',
      args: [ { type: 'Object', name: 'o' } ],
      javaCode: `return ((Number) o).floatValue();`
    },
    {
      name: 'toint',
      type: 'Integer',
      args: [ { type: 'Object', name: 'o' } ],
      javaCode: `return ((Number) o).intValue();`
    },
    {
      name: 'tolong',
      type: 'Long',
      args: [ { type: 'Object', name: 'o' } ],
      javaCode: `return ((Number) o).longValue();`
    },
    {
      name: 'toshort',
      type: 'Short',
      args: [ { type: 'Object', name: 'o' } ],
      javaCode: `return ((Number) o).shortValue();`
    }
  ],

  javaCode: `
    public <T> T[] toArray(Object o, T[] a) {
      if ( o == null || ! o.getClass().isArray() ) return null;

      Object[] arr = (Object[]) o;
      return (T[]) java.util.Arrays.copyOf(arr, arr.length, a.getClass());
    }
  `
});
