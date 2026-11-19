/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector',
  name: 'RAGIndexer',

  implements: [ 'foam.mlang.Expressions' ],

  documentation: `
    Keeps the chunks of one EmbeddingAware record in vectorStoreDAO, so it can
    be searched by meaning. index() cuts the record's toIndexText() into chunks, embeds
    them in one embeddingService call and stores one VectorEmbedding per
    chunk, with ids <daoKey>:<sourceId>:<n>, e.g. "noteDAO:42:0".
    A record whose stored chunks already hold exactly these texts, embedded
    by the model embeddingService uses now, costs no call, e.g. a record
    saved again with the same text. Otherwise its
    new chunks replace every chunk it had, so an edit that leaves the record
    shorter leaves no chunk of the old text behind.
    The same steps run in a browser, with the browser's chunker, embedder and
    store.
  `,

  requires: [
    { path: 'foam.ai.vector.ClientMarkdownChunkerService', flags: ['js'] },
    { path: 'foam.ai.vector.VectorEmbedding', flags: ['js'] }
  ],

  javaImports: [
    'foam.ai.vector.EmbeddingAware',
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.VectorEmbedding',
    'foam.dao.DAO',
    'foam.lang.FObject',
    'foam.mlang.MLang'
  ],

  methods: [
    {
      name: 'index',
      documentation: `Makes the chunks of obj, a record of the DAO daoKey, hold its current
        text, and returns true if that took an embedding call.`,
      type: 'Boolean',
      async: true,
      args: 'Context x, String daoKey, foam.lang.FObject obj',
      code: async function(x, daoKey, obj) {
        var sourceId = String(obj.id);
        var chunks   = await this.chunks(x, obj.toIndexText(x));
        var store    = x.vectorStoreDAO;
        // a page can switch provider, and a search reads only the vectors of the current model
        var model    = await x.embeddingService.getModel();
        var same     = true;
        for ( var i = 0 ; same && i <= chunks.length ; i++ ) {
          var e = await store.find(daoKey + ':' + sourceId + ':' + i);
          same = i == chunks.length ? ! e : !! e && e.text === chunks[i] && e.embeddingModel === model;
        }
        if ( same ) return false;

        // embedded before the old chunks go: a failed call keeps the record searchable
        await this.replace(x, daoKey, sourceId, chunks.length ? await this.embedAll(x, chunks) : []);
        return true;
      },
      javaCode: `
        String           sourceId = String.valueOf(obj.getProperty("id"));
        String[]         chunks   = chunks(x, ((EmbeddingAware) obj).toIndexText(x));
        EmbeddingService embedder = (EmbeddingService) x.get("embeddingService");
        DAO              store    = ((DAO) x.get("vectorStoreDAO")).inX(x);
        if ( isIndexed(store, daoKey, sourceId, chunks, embedder.getModel()) ) return false;

        // embedded before the old chunks go: a failed call (gateway down) keeps the record searchable
        replace(x, daoKey, sourceId, chunks.length == 0 ? new VectorEmbedding[0] : embedAll(x, chunks));
        return true;
      `
    },
    {
      name: 'replace',
      documentation: `Makes the chunks of the record sourceId of the DAO daoKey be embedded, in
        order, e.g. "noteDAO:42:0" for the first. An empty embedded removes them all. The new
        chunks are written over the old ones before any extra is removed, so a search made
        meanwhile never finds the record with no chunks.`,
      async: true,
      args: 'Context x, String daoKey, String sourceId, foam.ai.vector.VectorEmbedding[] embedded',
      code: async function(x, daoKey, sourceId, embedded) {
        var store = x.vectorStoreDAO;
        var ids   = [];
        for ( var i = 0 ; i < embedded.length ; i++ ) {
          var e = embedded[i];
          e.id       = daoKey + ':' + sourceId + ':' + i;
          e.daoKey   = daoKey;
          e.sourceId = sourceId;
          ids.push(e.id);
          await store.put(e);
        }
        // a shorter text leaves chunks past the new count, e.g. noteDAO:42:2 once it has 2
        var E = this.VectorEmbedding;
        await store.where(this.AND(this.EQ(E.DAO_KEY, daoKey), this.EQ(E.SOURCE_ID, sourceId), this.NOT(this.IN(E.ID, ids)))).removeAll();
      },
      javaCode: `
        DAO      store = ((DAO) x.get("vectorStoreDAO")).inX(x);
        String[] ids   = new String[embedded.length];
        for ( int i = 0 ; i < embedded.length ; i++ ) {
          VectorEmbedding e = embedded[i];
          ids[i] = daoKey + ":" + sourceId + ":" + i;
          e.setId(ids[i]);
          e.setDaoKey(daoKey);
          e.setSourceId(sourceId);
          store.put(e);
        }
        // a shorter text leaves chunks past the new count, e.g. noteDAO:42:2 once it has 2
        store.where(MLang.AND(
          MLang.EQ(VectorEmbedding.DAO_KEY, daoKey),
          MLang.EQ(VectorEmbedding.SOURCE_ID, sourceId),
          MLang.NOT(MLang.IN(VectorEmbedding.ID, ids)))).removeAll();
      `
    },
    {
      name: 'embedAll',
      documentation: `The vectors of texts, one per text, in order. A provider that answers with
        another count fails the call, as a refused one does, so no record loses a chunk.`,
      type: 'foam.ai.vector.VectorEmbedding[]',
      async: true,
      args: 'Context x, String[] texts',
      code: async function(x, texts) {
        var embedded = await x.embeddingService.embedAll(x, texts);
        if ( embedded.length != texts.length ) throw new Error('Asked for ' + texts.length + ' vectors, got ' + embedded.length);
        return embedded;
      },
      javaCode: `
        VectorEmbedding[] embedded = ((EmbeddingService) x.get("embeddingService")).embedAll(x, texts);
        if ( embedded.length != texts.length ) throw new RuntimeException("Asked for " + texts.length + " vectors, got " + embedded.length);
        return embedded;
      `
    },
    {
      name: 'isIndexed',
      documentation: `True when the store holds exactly these chunks for the record, in order, embedded
        by model: a chunk missing, one more, another text or another model all mean no.`,
      type: 'Boolean',
      args: 'foam.dao.DAO store, String daoKey, String sourceId, String[] chunks, String model',
      flags: ['java'],
      javaCode: `
        for ( int i = 0 ; i < chunks.length ; i++ ) {
          VectorEmbedding e = (VectorEmbedding) store.find(daoKey + ":" + sourceId + ":" + i);
          if ( e == null || ! chunks[i].equals(e.getText()) || ! model.equals(e.getEmbeddingModel()) ) return false;
        }
        return store.find(daoKey + ":" + sourceId + ":" + chunks.length) == null;
      `
    },
    {
      name: 'chunks',
      documentation: 'The chunks a record\'s index text is cut into, as they are embedded.',
      type: 'String[]',
      async: true,
      args: 'Context x, String text',
      code: function(x, text) { return this.ClientMarkdownChunkerService.create({}, x).chunk(x, text); },
      javaCode: 'return new MarkdownChunkerServiceImpl(x).chunk(x, text);'
    },
    {
      name: 'remove',
      documentation: 'Removes every chunk of the record sourceId of the DAO daoKey.',
      async: true,
      args: 'Context x, String daoKey, String sourceId',
      code: function(x, daoKey, sourceId) {
        return x.vectorStoreDAO
          .where(this.AND(
            this.EQ(foam.ai.vector.VectorEmbedding.DAO_KEY,   daoKey),
            this.EQ(foam.ai.vector.VectorEmbedding.SOURCE_ID, sourceId)))
          .removeAll();
      },
      javaCode: `
        ((DAO) x.get("vectorStoreDAO")).inX(x)
          .where(MLang.AND(
            MLang.EQ(VectorEmbedding.DAO_KEY,   daoKey),
            MLang.EQ(VectorEmbedding.SOURCE_ID, sourceId)))
          .removeAll();
      `
    }
  ]
});
