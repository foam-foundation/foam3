/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'Float32Quantizer',

  implements: [
    'foam.ai.vector.Quantizer'
  ],

  documentation: 'No quantization: four big-endian bytes per dimension (IEEE-754 binary32).',

  javaImports: [ 'java.nio.ByteBuffer' ],

  constants: [
    { name: 'FORMAT', type: 'String', value: 'f32' }
  ],

  methods: [
    {
      name: 'formatId',
      type: 'String',
      code: function() { return this.FORMAT; },
      javaCode: 'return FORMAT;'
    },
    {
      name: 'encode',
      javaType: 'byte[]',
      args: 'float[] vector',
      javaCode: `
        ByteBuffer out = ByteBuffer.allocate(encodedSize(vector.length));
        for ( float f : vector ) out.putFloat(f);
        return out.array();
      `
    },
    {
      name: 'decode',
      javaType: 'float[]',
      args: 'byte[] data',
      code: function(data) {
        var bytes = Uint8Array.from(data || []);
        var view  = new DataView(bytes.buffer);
        var v     = new Array(Math.floor(bytes.length / 4));
        for ( var i = 0 ; i < v.length ; i++ ) v[i] = view.getFloat32(i * 4);
        return v;
      },
      javaCode: `
        float[] v = new float[data == null ? 0 : data.length / 4];
        for ( int i = 0 ; i < v.length ; i++ ) v[i] = toFloat_(data, i * 4);
        return v;
      `
    },
    {
      name: 'encodedSize',
      type: 'Integer',
      args: 'Integer dims',
      code: function(dims) { return 4 * dims; },
      javaCode: 'return 4 * dims;'
    },
    {
      name: 'dot',
      type: 'Float',
      args: 'float[] q, byte[] data, int offset',
      javaCode: `
        float s = 0;
        for ( int j = 0 ; j < q.length ; j++ ) s += q[j] * toFloat_(data, offset + j * 4);
        return s;
      `
    },
    {
      name: 'toFloat_',
      type: 'Float',
      args: 'byte[] data, int o',
      javaCode: `
        return Float.intBitsToFloat(((data[o] & 0xff) << 24) | ((data[o + 1] & 0xff) << 16)
                                  | ((data[o + 2] & 0xff) <<  8) |  (data[o + 3] & 0xff));
      `
    }
  ]
});
