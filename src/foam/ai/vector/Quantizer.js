/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.ai.vector',
  name: 'Quantizer',

  documentation: `
    How a vector is packed into bytes, for the in-memory index and the journal.
    Implement it to plug in another precision. Float32Quantizer is the default (see
    VectorStoreDAO.quantizer); Int8Quantizer and Fp16Quantizer are built in too (see Quantizers).

    Every vector handed to encode and dot is already normalised to unit length by
    VectorIndex, so a quantizer only packs numbers and a score is a cosine
    similarity to within the format's rounding. formatId is written on every journaled row
    (VectorEmbedding.vectorFormat) and is how the row is decoded later, so it must
    never change for an implementation. A custom quantizer is readable by the
    stores configured with it.
  `,

  methods: [
    {
      name: 'formatId',
      documentation: 'Stable name of the byte layout, for example "int8"; stored on every row.',
      type: 'String'
    },
    {
      name: 'encode',
      documentation: 'Bytes for a unit-length vector, exactly encodedSize(vector.length) long.',
      javaType: 'byte[]',
      args: 'float[] vector'
    },
    {
      name: 'decode',
      documentation: `The unit-length floats that encode() bytes stand for
        (approximately, for a lossy format).`,
      javaType: 'float[]',
      args: 'byte[] data'
    },
    {
      name: 'encodedSize',
      documentation: 'Byte length of encode() for a vector of this many dimensions.',
      type: 'Integer',
      args: 'Integer dims'
    },
    {
      name: 'dot',
      documentation: `Dot product of a unit-length query with the vector stored at
        data[offset .. offset + encodedSize(q.length)), computed on the bytes so a
        search allocates nothing per row.`,
      type: 'Float',
      args: 'float[] q, byte[] data, int offset'
    }
  ]
});
