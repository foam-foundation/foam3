/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'CosineComparator',
  implements: ['foam.mlang.order.Comparator'],

  javaImports: [
    'foam.ai.vector.VectorEmbedding'
  ],

  properties: [
    {
      class: 'foam.lang.FloatArray',
      name: 'queryVector'
    }
  ],

  methods: [
    {
      // dot product against queryVector (cosine similarity for unit-normalized vectors).
      // compare() calls this with offset=0, dim=v.length; VectorStoreDAO uses the offset directly.
      name: 'score',
      type: 'Float',
      args: 'float[] flat, int offset, int dim',
      code: function(flat, offset, dim) {
        var q = this.queryVector, s = 0;
        for ( var i = 0; i < dim; i++ ) s += q[i] * flat[offset + i];
        return s;
      },
      javaCode: `
        float[] q = getQueryVector();
        float   s = 0f;
        for ( int i = 0; i < dim; i++ ) s += q[i] * flat[offset + i];
        return s;
      `
    },
    {
      name: 'compare',
      documentation: 'o1 and o2 must be VectorEmbedding instances. Args are typed Any to satisfy the Comparator interface.',
      type: 'Integer',
      args: 'Any o1, Any o2',
      code: function(o1, o2) {
        var v1 = o1.vector, v2 = o2.vector;
        var s1 = this.score(v1, 0, v1.length), s2 = this.score(v2, 0, v2.length);
        return s2 > s1 ? 1 : s2 < s1 ? -1 : 0; // descending
      },
      javaCode: `
        float[] v1 = ((VectorEmbedding) o1).getVector();
        float[] v2 = ((VectorEmbedding) o2).getVector();
        float s1 = score(v1, 0, v1.length);
        float s2 = score(v2, 0, v2.length);
        return Float.compare(s2, s1); // descending
      `
    },
    {
      name: 'createStatement',
      type: 'String',
      code:     function()  { return ''; },
      javaCode: 'return "";'
    },
    {
      name: 'prepareStatement',
      type: 'Void',
      javaThrows: ['java.sql.SQLException'],
      args: 'foam.dao.jdbc.IndexedPreparedStatement stmt',
      code:     function() {},
      javaCode: '// not SQL-backed'
    }
  ]
});
