/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'Fp16Quantizer',

  implements: [
    'foam.ai.vector.Quantizer'
  ],

  documentation: `
    IEEE-754 binary16 (half precision), two big-endian bytes per dimension, as Java
    Float.floatToFloat16 / float16ToFloat write and read them: half the memory of
    floats with almost no loss. Those two methods exist from Java 20, so a build
    that targets an older Java cannot compile this class.
  `,

  constants: [
    { name: 'FORMAT', type: 'String', value: 'fp16' }
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
        byte[] out = new byte[encodedSize(vector.length)];
        for ( int i = 0 ; i < vector.length ; i++ ) {
          short h = Float.floatToFloat16(vector[i]);
          out[i * 2]     = (byte) (h >>> 8);
          out[i * 2 + 1] = (byte)  h;
        }
        return out;
      `
    },
    {
      name: 'decode',
      javaType: 'float[]',
      args: 'byte[] data',
      code: function(data) {
        var v = new Array(Math.floor((data || []).length / 2));
        for ( var i = 0 ; i < v.length ; i++ ) {
          v[i] = this.halfToFloat_(((data[i * 2] & 0xff) << 8) | (data[i * 2 + 1] & 0xff));
        }
        return v;
      },
      javaCode: `
        float[] v = new float[data == null ? 0 : data.length / 2];
        for ( int i = 0 ; i < v.length ; i++ ) v[i] = toFloat_(data, i * 2);
        return v;
      `
    },
    {
      name: 'encodedSize',
      type: 'Integer',
      args: 'Integer dims',
      code: function(dims) { return 2 * dims; },
      javaCode: 'return 2 * dims;'
    },
    {
      name: 'dot',
      type: 'Float',
      args: 'float[] q, byte[] data, int offset',
      javaCode: `
        float s = 0;
        for ( int j = 0 ; j < q.length ; j++ ) s += q[j] * toFloat_(data, offset + j * 2);
        return s;
      `
    },
    {
      name: 'toFloat_',
      documentation: 'The binary16 value whose two bytes start at data[o].',
      type: 'Float',
      args: 'byte[] data, int o',
      javaCode: `
        return Float.float16ToFloat((short) (((data[o] & 0xff) << 8) | (data[o + 1] & 0xff)));
      `
    },
    {
      name: 'halfToFloat_',
      documentation: `The binary16 value h (16 bits) as a JS number; Java uses
        Float.float16ToFloat.`,
      flags: [ 'js' ],
      code: function(h) {
        var sign = h & 0x8000 ? -1 : 1;
        var exp  = (h >> 10) & 0x1f;
        var mant = h & 0x3ff;
        if ( exp === 0 )    return sign * mant * Math.pow(2, -24);
        if ( exp === 0x1f ) return mant ? NaN : sign * Infinity;
        return sign * (1 + mant / 1024) * Math.pow(2, exp - 15);
      }
    }
  ]
});
