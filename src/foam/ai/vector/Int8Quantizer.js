/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'Int8Quantizer',

  implements: [
    'foam.ai.vector.Quantizer'
  ],

  documentation: `
    One signed byte per dimension plus one scale per vector, a quarter of the
    memory of floats. The scale is the vector's largest component divided by
    127, so that component maps to 127 or -127. Bytes are
    [4-byte big-endian float scale][one byte per dimension].
  `,

  javaImports: [ 'java.nio.ByteBuffer' ],

  constants: [
    { name: 'FORMAT', type: 'String', value: 'int8' }
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
        double max = 0;
        for ( float f : vector ) max = Math.max(max, Math.abs(f));
        float  scale = max == 0 ? 0f : (float) (max / 127.0);
        byte[] out   = ByteBuffer.allocate(4 + vector.length).putFloat(scale).array();
        if ( scale != 0f )
          for ( int i = 0 ; i < vector.length ; i++ )
            out[4 + i] = (byte) Math.round(vector[i] / scale);
        return out;
      `
    },
    {
      name: 'decode',
      javaType: 'float[]',
      args: 'byte[] data',
      code: function(data) {
        if ( ! data || data.length < 4 ) return [];
        var scale = new DataView(Uint8Array.from(data.slice(0, 4)).buffer).getFloat32(0);
        var v     = new Array(data.length - 4);
        for ( var i = 0 ; i < v.length ; i++ ) {
          var b = data[4 + i] & 0xff;
          v[i] = (b > 127 ? b - 256 : b) * scale;
        }
        return v;
      },
      javaCode: `
        if ( data == null || data.length < 4 ) return new float[0];
        float   scale = scaleAt_(data, 0);
        float[] v     = new float[data.length - 4];
        for ( int i = 0 ; i < v.length ; i++ ) v[i] = data[4 + i] * scale;
        return v;
      `
    },
    {
      name: 'encodedSize',
      type: 'Integer',
      args: 'Integer dims',
      code: function(dims) { return 4 + dims; },
      javaCode: 'return 4 + dims;'
    },
    {
      name: 'dot',
      type: 'Float',
      args: 'float[] q, byte[] data, int offset',
      javaCode: `
        float s    = 0;
        int   base = offset + 4;
        for ( int j = 0 ; j < q.length ; j++ ) s += q[j] * data[base + j];
        return s * scaleAt_(data, offset);
      `
    },
    {
      name: 'scaleAt_',
      type: 'Float',
      args: 'byte[] data, int offset',
      javaCode: `
        int bits = ((data[offset] & 0xff) << 24) | ((data[offset + 1] & 0xff) << 16)
                 | ((data[offset + 2] & 0xff) <<  8) |  (data[offset + 3] & 0xff);
        return Float.intBitsToFloat(bits);
      `
    }
  ]
});
