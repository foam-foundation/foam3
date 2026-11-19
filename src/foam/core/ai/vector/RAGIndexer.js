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
    be searched by meaning. index() cuts the record's toIndexText() into chunks,
    embeds them in one embeddingService call and stores one VectorEmbedding per
    chunk, with ids <daoKey>:<sourceId>:<n>, e.g. "noteDAO:42:0". A record whose
    stored chunks already hold exactly these texts costs no call, e.g. a record
    saved again with the same text. Otherwise its new chunks replace every chunk
    it had, so an edit that leaves the record shorter leaves no chunk of the old
    text behind. A failed embedding call keeps the old chunks.
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
      documentation: `
        Makes the chunks of obj, a record of the DAO daoKey, hold its text, and
        returns true if it wrote chunks. source is the DAO that stores the
        record: when the call that embeds the text returns, the stored record
        is read again, and if its text is no longer the one embedded, the
        vectors are dropped, because the save that changed it runs its own
        index(). The vectors are written one DAO put after that check, so the
        gap is that short, not as long as an embedding call.
      `,
      type: 'Boolean',
      async: true,
      args: 'Context x, String daoKey, foam.lang.FObject obj, foam.dao.DAO source',
      code: async function(x, daoKey, obj, source) {
        var sourceId = String(obj.id);
        var text     = obj.toIndexText(x);
        var chunks   = await this.chunks(x, text);
        var store    = x.vectorStoreDAO;
        var same     = true;
        for ( var i = 0 ; same && i <= chunks.length ; i++ ) {
          var e = await store.find(daoKey + ':' + sourceId + ':' + i);
          same = i == chunks.length ? ! e : !! e && e.text === chunks[i];
        }
        if ( same ) return false;

        // embedded before the old chunks go: a failed call keeps the record searchable
        var embedded = chunks.length ? await this.embedAll(x, chunks) : [];
        var now = await source.find_(x, obj.id);
        if ( ! now || now.toIndexText(x) !== text ) return false;
        await this.replace(x, daoKey, sourceId, embedded);
        return true;
      },
      javaCode: `
        String   sourceId = String.valueOf(obj.getProperty("id"));
        String   text     = ((EmbeddingAware) obj).toIndexText(x);
        String[] chunks   = chunks(x, text);
        DAO      store    = ((DAO) x.get("vectorStoreDAO")).inX(x);
        if ( isIndexed(store, daoKey, sourceId, chunks) ) return false;

        // embedded before the old chunks go: a failed call (gateway down) keeps the record searchable
        VectorEmbedding[] embedded = chunks.length == 0 ? new VectorEmbedding[0] : embedAll(x, chunks);
        FObject now = source.find_(x, obj);
        if ( now == null || ! text.equals(((EmbeddingAware) now).toIndexText(x)) ) return false;
        replace(x, daoKey, sourceId, embedded);
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
        another count fails the call, as a refused one does, so no record loses a chunk. A sync
        passes the chunks of several records at once.`,
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
      documentation: `True when the store holds exactly these chunk texts for the record, in order:
        a chunk missing, one more or another text all mean no.`,
      type: 'Boolean',
      args: 'foam.dao.DAO store, String daoKey, String sourceId, String[] chunks',
      flags: ['java'],
      javaCode: `
        for ( int i = 0 ; i < chunks.length ; i++ ) {
          VectorEmbedding e = (VectorEmbedding) store.find(daoKey + ":" + sourceId + ":" + i);
          if ( e == null || ! chunks[i].equals(e.getText()) ) return false;
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
