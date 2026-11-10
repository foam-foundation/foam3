/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector.test',
  name: 'CosineComparatorJSTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding'
  ],

  documentation: `
    Rows read from a server VectorStoreDAO carry only their packed vector
    (vectorData, decoded by vectorFormat), so the browser must decode every
    built-in format correctly or browser-side sorting goes wrong.
  `,

  methods: [
    function runTest(x) {
      var cc = this.CosineComparator.create({ queryVector: [ 1, 0, 0 ] });
      var self = this;
      function row(id, format, bytes) {
        return self.VectorEmbedding.create({ id: id, vectorFormat: format, vectorData: btoa(String.fromCharCode.apply(null, bytes)) });
      }

      // int8: [scale 0.5 as big-endian float32 = 0x3F000000][bytes 127, -127 (0x81), 0].
      var f = row('a', 'int8', [ 0x3f, 0, 0, 0, 127, 129, 0 ]).floats();
      x.test(f.length === 3, 'floats() decodes one value per int8 byte');
      x.test(f[0] === 63.5 && f[1] === -63.5 && f[2] === 0, 'floats() reads 0x81 as -127, not 129, and multiplies by the scale');

      var withFloats = this.VectorEmbedding.create({ id: 'b', vector: [ 0.1, 0.2, 0.3 ] });
      x.test(withFloats.floats() === withFloats.vector, 'floats() uses the float vector when the row still has it');

      var near = row('near', 'int8', [ 0x3f, 0, 0, 0, 127, 0, 0 ]);
      var far  = row('far',  'int8', [ 0x3f, 0, 0, 0, 129, 0, 0 ]);
      x.test(cc.compare(near, far) < 0 && cc.compare(far, near) > 0, 'compare sorts the row pointing along the query first');

      // fp16 1.0 is 0x3C00, -2.0 is 0xC000; f32 1.0 is 0x3F800000 (big-endian).
      var h = row('h', 'fp16', [ 0x3c, 0x00, 0xc0, 0x00 ]).floats();
      x.test(h.length === 2 && h[0] === 1 && h[1] === -2, 'floats() decodes an fp16 row by its vectorFormat');
      var g = row('g', 'f32', [ 0x3f, 0x80, 0x00, 0x00 ]).floats();
      x.test(g.length === 1 && g[0] === 1, 'floats() decodes an f32 row by its vectorFormat');

      x.test(row('u', 'custom-x', [ 1, 2, 3 ]).floats().length === 0, 'a format the browser does not know decodes to no vector');
    }
  ]
});
