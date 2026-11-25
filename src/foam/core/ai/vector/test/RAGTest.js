/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.test',
  name: 'RAGTest',
  extends: 'foam.core.test.Test',

  documentation: `
    EmbeddingAwareDAO over a stand-in embedder: a put embeds the record, an
    edit embeds it again and leaves no chunk of the old text, a put that leaves
    the text as it was makes no AI call, a record that turns not embeddable
    loses its chunks, a remove clears them, a failing provider does not fail
    the put, a save made while the earlier save's embedding call is in flight
    ends with the chunks of the later text, and a context with no embedder or
    chunk store saves and removes without error. The test replaces the
    "threadPool" of the context with an agency that runs each job on the
    calling thread, so the background embedding is finished when the put
    returns and the test checks the chunks with no sleep.
  `,

  javaImports: [
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.MDAO',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.mlang.MLang',
    'foam.mlang.sink.Count',
    'java.util.concurrent.CompletableFuture',
    'java.util.concurrent.Future'
  ],

  javaCode: `
    /** Embeds a text by its words: "alpha" points one way, "beta" the other. Counts its calls; fails every call when fail is set. */
    public static class Embedder implements EmbeddingService {
      public int     calls;
      public boolean fail;
      /** Runs once, while a call is in flight, e.g. to save the record again. */
      public Runnable onEmbed;
      public VectorEmbedding embed(X x, String text) { return embedAll(x, new String[] { text })[0]; }
      public VectorEmbedding[] embedAll(X x, String[] texts) {
        calls++;
        if ( onEmbed != null ) {
          Runnable r = onEmbed;
          onEmbed = null;
          r.run();
        }
        if ( fail ) throw new RuntimeException("gateway down");
        VectorEmbedding[] out = new VectorEmbedding[texts.length];
        for ( int i = 0 ; i < texts.length ; i++ ) {
          float a = texts[i].contains("alpha") ? 1f : 0f, b = texts[i].contains("beta") ? 1f : 0f;
          out[i] = new VectorEmbedding.Builder(x).setText(texts[i]).setEmbeddingModel("fake").setVector(new float[] { a, b }).build();
        }
        return out;
      }
    }

    /** Runs each job at once on the calling thread, so a test needs no wait. */
    public static class InlineAgency implements Agency {
      public Future<?> submit(X x, ContextAgent agent, String description) {
        agent.execute(x);
        return CompletableFuture.completedFuture(null);
      }
      public void schedule(X x, ContextAgent agent, String description, long delay) {
        agent.execute(x);
      }
    }

    static RAGNote note(String id, String body) {
      RAGNote n = new RAGNote();
      n.setId(id);
      n.setTitle("Note " + id);
      n.setBody(body);
      return n;
    }

    static RAGNote edit(DAO dao, String id) { return (RAGNote) dao.find(id).fclone(); }

    static long chunksOf(DAO store, String id) {
      return ((Count) store.where(MLang.AND(MLang.EQ(VectorEmbedding.DAO_KEY, "noteDAO"), MLang.EQ(VectorEmbedding.SOURCE_ID, id))).select(MLang.COUNT())).getValue();
    }

    static boolean anyChunkHolds(DAO store, String text) {
      for ( Object o : ((ArraySink) store.select(new ArraySink())).getArray() ) {
        if ( ((VectorEmbedding) o).getText().contains(text) ) return true;
      }
      return false;
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Embedder fake  = new Embedder();
        DAO      store = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        X        tx    = x.put("vectorStoreDAO", store).put("embeddingService", fake).put("threadPool", new InlineAgency());
        // EasyDAO adds EmbeddingAwareDAO because RAGNote implements EmbeddingAware
        DAO      notes = new EasyDAO.Builder(tx).setOf(RAGNote.getOwnClassInfo()).setName("noteDAO").setAuthorize(false).build().inX(tx);

        notes.put(note("n1", "alpha one\\n\\n## Part\\n\\nbeta two\\n\\n## Last\\n\\nalpha three"));
        long first = chunksOf(store, "n1");
        test(fake.calls == 1 && first > 1 && store.find("noteDAO:n1:0") != null, "A put embeds the record in one call, as noteDAO:n1:0 and on, got " + first + " chunks, " + fake.calls + " calls");

        RAGNote pinned = edit(notes, "n1");
        pinned.setPinned(true);
        notes.put(pinned);
        test(fake.calls == 1 && chunksOf(store, "n1") == first, "A put that leaves the text as it was makes no AI call");

        RAGNote shorter = edit(notes, "n1");
        shorter.setBody("beta only");
        notes.put(shorter);
        test(fake.calls == 2 && chunksOf(store, "n1") < first && ! anyChunkHolds(store, "alpha three"), "An edit embeds the record again and leaves no chunk of the old text, got " + chunksOf(store, "n1") + " chunks");

        RAGNote draft = edit(notes, "n1");
        draft.setDraft(true);
        notes.put(draft);
        test(chunksOf(store, "n1") == 0 && fake.calls == 2, "A record that turns not embeddable loses its chunks, with no AI call");

        RAGNote published = edit(notes, "n1");
        published.setDraft(false);
        notes.put(published);
        test(fake.calls == 3 && chunksOf(store, "n1") > 0, "A record that turns embeddable again is embedded");

        notes.put(note("n2", "alpha two"));
        notes.remove(notes.find("n1"));
        test(notes.find("n1") == null && chunksOf(store, "n1") == 0 && chunksOf(store, "n2") > 0, "A remove clears that record's chunks and no other's");
        notes.removeAll();
        test(chunksOf(store, "n2") == 0, "A removeAll clears the chunks of every record");

        fake.fail = true;
        boolean saved = true;
        try { notes.put(note("n3", "beta three")); } catch ( RuntimeException e ) { saved = false; }
        test(saved && notes.find("n3") != null && chunksOf(store, "n3") == 0, "A failing provider does not fail the put: the record is stored with no chunks");
        fake.fail = false;

        // the record is saved again while the first save's embedding call runs
        fake.onEmbed = () -> notes.put(note("n4", "beta later"));
        notes.put(note("n4", "alpha first"));
        test(chunksOf(store, "n4") > 0 && ! anyChunkHolds(store, "alpha first") && anyChunkHolds(store, "beta later"), "A save made while an earlier save is embedding ends with the chunks of the later text");

        // no embedder and no chunk store in the context: saves and removes still work
        X     bare  = x.put("embeddingService", null).put("vectorStoreDAO", null).put("threadPool", new InlineAgency());
        DAO   plain = new EasyDAO.Builder(bare).setOf(RAGNote.getOwnClassInfo()).setName("bareNoteDAO").setAuthorize(false).build().inX(bare);
        boolean worked = true;
        try {
          plain.put(note("p1", "alpha"));
          plain.remove(plain.find("p1"));
        } catch ( RuntimeException e ) { worked = false; }
        test(worked && plain.find("p1") == null, "A context with no embedder or chunk store saves and removes without error");
      `
    }
  ]
});
