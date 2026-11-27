/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'VectorEmbedding',

  requires: [
    'foam.ai.vector.Quantizers'
  ],

  javaImports: [
    'foam.ai.vector.Quantizer',
    'foam.ai.vector.Quantizers',
    'foam.util.SafetyUtil',
    'java.util.Base64'
  ],

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'text'        // original chunk; omit for DAO-record embeddings
    },
    {
      documentation: `DAO key of the source record (e.g. "alpacaSampleDAO").
        Empty for text-chunk embeddings. When set, sourceId is the primary
        key of the record in that DAO.`,
      class: 'String',
      name: 'daoKey'
    },
    {
      class: 'String',
      name: 'sourceId'   // classId, doc path, flow name, or DAO record primary key
    },
    {
      class: 'String',
      name: 'kind'       // 'class' | 'property' | 'method'
    },
    {
      class: 'String',
      name: 'embeddingModel'  // e.g. 'nomic-embed-text'
    },
    {
      documentation: `The embedding as floats, as the embedding service returns it.
        VectorStoreDAO scales it to unit length, packs it into vectorData with the
        configured Quantizer (Float32Quantizer unless set) and drops the floats before
        the row is journaled, so a 1024-dim vector costs about 5.5 KB in the journal as
        float32 (about 1.4 KB as int8) instead of about 12 KB of text.

        A row read back from a VectorStoreDAO therefore has no vector: read it with
        floats(), which returns the unit-length values. Rows journaled before
        VectorStoreDAO packed vectors still hold floats; they load and are searchable,
        and are packed on their next put.`,
      class: 'foam.lang.FloatArray',
      name: 'vector'
    },
    {
      documentation: `The stored vector: the encode() bytes of the Quantizer named by
        vectorFormat, base64. Written by VectorStoreDAO; never set it directly.`,
      class: 'String',
      name: 'vectorData',
      shortName: 'vd',
      hidden: true
    },
    {
      documentation: `Quantizer.formatId of vectorData, for example "int8" or "fp16";
        a row is always decoded by it. Empty on a row that holds floats instead.`,
      class: 'String',
      name: 'vectorFormat',
      shortName: 'vf',
      hidden: true
    },
    {
      // Populated by VectorStoreDAO.select_ at query time; not stored in the journal.
      class: 'Float',
      name: 'score',
      storageTransient: true
    }
  ],

  methods: [
    {
      name: 'floats',
      documentation: `This row's vector as floats, decoded with the built-in quantizer
        named by vectorFormat (see Quantizers). A row in a custom format is decoded
        through the VectorStoreDAO that configures it; here it throws in Java and
        has no vector in JS.`,
      javaType: 'float[]',
      code: function() {
        if ( this.vector && this.vector.length ) return this.vector;
        var q = this.vectorData && this.Quantizers.builtIn(this.vectorFormat);
        if ( ! q ) return [];
        var bin = atob(this.vectorData), bytes = new Array(bin.length);
        for ( var i = 0 ; i < bin.length ; i++ ) bytes[i] = bin.charCodeAt(i);
        return q.decode(bytes);
      },
      javaCode: `
        if ( getVector() != null && getVector().length > 0 ) return getVector();
        if ( SafetyUtil.isEmpty(getVectorData()) ) return new float[0];
        Quantizer q = Quantizers.builtIn(getVectorFormat());
        if ( q == null ) throw new IllegalArgumentException(
          "Unknown vector format " + getVectorFormat() + " for " + getId());
        return q.decode(Base64.getDecoder().decode(getVectorData()));
      `
    },
    function toSummary() {
      return this.daoKey ? `${this.daoKey}:${this.sourceId}` : `${this.kind}:${this.sourceId}`;
    }
  ]
});
