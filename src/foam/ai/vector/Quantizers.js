/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'Quantizers',

  documentation: `
    The built-in Quantizers, listed in one place. A VectorIndex reads these plus
    the quantizer it is configured with; VectorEmbedding.floats() uses them to
    decode a row outside any store.
  `,

  requires: [
    'foam.ai.vector.Float32Quantizer',
    'foam.ai.vector.Fp16Quantizer',
    'foam.ai.vector.Int8Quantizer'
  ],

  javaImports: [
    'foam.ai.vector.Float32Quantizer',
    'foam.ai.vector.Fp16Quantizer',
    'foam.ai.vector.Int8Quantizer',
    'foam.ai.vector.Quantizer'
  ],

  // Quantizers hold no state, so one instance of each serves every caller.
  constants: [
    {
      name: 'INT8',
      javaType: 'Quantizer',
      factory: function() { return foam.ai.vector.Int8Quantizer.create(); },
      javaValue: 'new Int8Quantizer()'
    },
    {
      name: 'FP16',
      javaType: 'Quantizer',
      factory: function() { return foam.ai.vector.Fp16Quantizer.create(); },
      javaValue: 'new Fp16Quantizer()'
    },
    {
      name: 'F32',
      javaType: 'Quantizer',
      factory: function() { return foam.ai.vector.Float32Quantizer.create(); },
      javaValue: 'new Float32Quantizer()'
    }
  ],

  static: [
    {
      name: 'builtIn',
      documentation: 'The built-in Quantizer for a vectorFormat, or null for any other format.',
      type: 'foam.ai.vector.Quantizer',
      args: 'String format',
      code: function(format) {
        var all = [ this.INT8, this.FP16, this.F32 ];
        for ( var i = 0 ; i < all.length ; i++ ) if ( all[i].formatId() === format ) return all[i];
        return null;
      },
      javaCode: `
        for ( Quantizer q : new Quantizer[] { INT8, FP16, F32 } )
          if ( q.formatId().equals(format) ) return q;
        return null;
      `
    }
  ]
});
