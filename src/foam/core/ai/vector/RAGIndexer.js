/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector',
  name: 'RAGIndexer',

  documentation: `
    Keeps the chunks of one record in vectorStoreDAO, so Ask AI can search it.
    index() cuts the record's toIndexText() into chunks, embeds them in one
    embeddingService call and stores one VectorEmbedding per chunk, with ids
    <daoKey>:<sourceId>:<n>, e.g. "flowDAO:Getting Started:0". A record
    whose text hashes as its chunks say (sourceHash) is left as it is. Otherwise
    its new chunks replace every chunk it had, so an edit that leaves the doc
    shorter leaves no chunk of the old text behind.
  `,

  javaImports: [
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.Indexable',
    'foam.ai.vector.VectorEmbedding',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lang.FObject',
    'foam.mlang.MLang',
    'java.nio.charset.StandardCharsets',
    'java.security.MessageDigest',
    'java.util.HexFormat',
    'java.util.List'
  ],

  methods: [
    {
      name: 'index',
      documentation: 'Replaces the chunks of obj, a record of the DAO daoKey, with chunks of its current text.',
      args: 'X x, String daoKey, FObject obj',
      javaCode: `
        String   sourceId = String.valueOf(obj.getProperty("id"));
        String[] chunks   = chunks(x, ((Indexable) obj).toIndexText(x));
        String   hash     = chunksHash(chunks);
        DAO      store    = ((DAO) x.get("vectorStoreDAO")).inX(x);
        VectorEmbedding first = (VectorEmbedding) store.find(daoKey + ":" + sourceId + ":0");
        if ( first != null && hash.equals(first.getSourceHash()) ) return;

        // embedded before the old chunks go: a failed call (gateway down) keeps the doc searchable
        VectorEmbedding[] embedded = chunks.length == 0 ? new VectorEmbedding[0]
          : ((EmbeddingService) x.get("embeddingService")).embedAll(x, chunks);
        remove(x, daoKey, sourceId);
        for ( int i = 0 ; i < embedded.length ; i++ ) {
          VectorEmbedding e = embedded[i];
          e.setId(daoKey + ":" + sourceId + ":" + i);
          e.setDaoKey(daoKey);
          e.setSourceId(sourceId);
          e.setSourceHash(hash);
          store.put(e);
        }
      `
    },
    {
      name: 'chunks',
      documentation: 'The chunks a record\'s index text is cut into, as they are embedded.',
      type: 'String[]',
      args: 'X x, String text',
      javaCode: 'return new MarkdownChunkerServiceImpl(x).chunk(x, text);'
    },
    {
      name: 'sourceHash',
      documentation: `What sourceHash holds for this index text: the hash of its chunks, so a
        change to the text or to how it is cut both embed the record again.`,
      type: 'String',
      args: 'X x, String text',
      javaCode: 'return chunksHash(chunks(x, text));'
    },
    {
      name: 'chunksHash',
      type: 'String',
      args: 'String[] chunks',
      javaCode: 'return textHash(String.join(String.valueOf((char) 0), chunks));'
    },
    {
      name: 'textHash',
      documentation: 'SHA-256 of a text, as hex.',
      type: 'String',
      args: 'String text',
      javaCode: `
        try {
          return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch ( java.security.NoSuchAlgorithmException e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      name: 'remove',
      documentation: 'Removes every chunk of the record sourceId of the DAO daoKey.',
      args: 'X x, String daoKey, String sourceId',
      javaCode: `
        // One remove per row, not removeAll: VectorStoreDAO marks its index for
        // a rebuild on remove_, and removeAll would go straight to its delegate.
        DAO store = ((DAO) x.get("vectorStoreDAO")).inX(x);
        List rows = ((ArraySink) store
          .where(MLang.AND(
            MLang.EQ(VectorEmbedding.DAO_KEY,   daoKey),
            MLang.EQ(VectorEmbedding.SOURCE_ID, sourceId)))
          .select(new ArraySink())).getArray();
        for ( Object row : rows ) store.remove((FObject) row);
      `
    }
  ]
});
