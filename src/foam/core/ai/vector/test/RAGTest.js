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
    Ask AI over a stand-in embedder and model: a search with ReadableSourcePredicate
    returns only chunks of records the caller can read, a store holding two vector lengths answers each
    query from rows of its length, the indexer embeds a record again only when
    its text changed and leaves no chunk of the old text, and ask() sends the
    model only readable chunks and lists only their records.
  `,

  javaImports: [
    'foam.ai.llm.ChatRequest',
    'foam.ai.llm.CompletionRequest',
    'foam.ai.llm.LLMResponse',
    'foam.ai.llm.LLMService',
    'foam.ai.llm.RAGAnswer',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.core.ai.llm.ServerRAGService',
    'foam.core.ai.vector.MarkdownChunkerServiceImpl',
    'foam.core.ai.vector.RAGIndexer',
    'foam.core.ai.vector.ReadableSourcePredicate',
    'foam.core.reflow.Flow',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.FilteredDAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'foam.mlang.MLang',
    'java.util.ArrayList',
    'java.util.List'
  ],

  javaCode: `
    /** Embeds a text by its words: "alpha" points one way, "beta" the other. Counts its calls. */
    public static class Embedder implements EmbeddingService {
      public int     calls;
      public boolean fail;
      public String  model = "fake";
      public String getModel() { return model; }
      public VectorEmbedding embed(X x, String text) { return embedAll(x, new String[] { text })[0]; }
      public VectorEmbedding[] embedAll(X x, String[] texts) {
        calls++;
        if ( fail ) throw new RuntimeException("gateway down");
        VectorEmbedding[] out = new VectorEmbedding[texts.length];
        for ( int i = 0 ; i < texts.length ; i++ ) {
          float a = texts[i].contains("alpha") ? 1f : 0f, b = texts[i].contains("beta") ? 1f : 0f;
          out[i] = new VectorEmbedding.Builder(x).setText(texts[i]).setEmbeddingModel(model).setVector(new float[] { a, b }).build();
        }
        return out;
      }
    }

    /** Answers a set reply and keeps the prompt it was sent. */
    public static class Model implements LLMService {
      public String reply = "Alpha is the first letter [s1].";
      public String prompt;
      public int    calls;
      public LLMResponse complete(X x, CompletionRequest r) {
        calls++;
        prompt = r.getPrompt();
        LLMResponse res = new LLMResponse();
        res.setContent(reply);
        return res;
      }
      public LLMResponse chat(X x, ChatRequest r) { throw new UnsupportedOperationException(); }
    }

    static VectorEmbedding chunk(String id, String daoKey, String sourceId, String text, float... v) {
      VectorEmbedding e = new VectorEmbedding();
      e.setId(id);
      e.setDaoKey(daoKey);
      e.setSourceId(sourceId);
      e.setText(text);
      e.setEmbeddingModel("fake");
      e.setVector(v);
      return e;
    }

    /** The ids a cosine search returns, nearest first; readable: only chunks of records x can read. */
    static List<String> ids(DAO store, X x, boolean readable, float... q) {
      DAO dao = store.inX(x);
      if ( readable ) dao = dao.where(new ReadableSourcePredicate.Builder(x).build());
      List<String> out = new ArrayList<>();
      for ( Object o : ((ArraySink) dao.orderBy(new CosineComparator.Builder(x).setQueryVector(q).build()).select(new ArraySink())).getArray() ) {
        out.add(((VectorEmbedding) o).getId());
      }
      return out;
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // The source records: two docs, s1 and s2. The caller may read s1 only.
        DAO docs = new MDAO(VectorEmbedding.getOwnClassInfo());
        docs.put(chunk("s1", "", "", "", 0f));
        docs.put(chunk("s2", "", "", "", 0f));
        X caller = x.put("docDAO", new FilteredDAO.Builder(x).setPredicate(MLang.EQ(VectorEmbedding.ID, "s1")).setDelegate(docs).build());
        X system = x.put("docDAO", docs);

        DAO store = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        store.put(chunk("docDAO:s1:0", "docDAO", "s1", "alpha in s1", 0.8f, 0.2f));
        store.put(chunk("docDAO:s2:0", "docDAO", "s2", "secret alpha in s2", 1f, 0f));
        store.put(chunk("free", "", "", "a chunk with no source record", 0.5f, 0.5f));

        List<String> seen = ids(store, caller, true, 1f, 0f);
        test(seen.contains("docDAO:s1:0"), "A chunk of a readable record is found, got " + seen);
        test(! seen.contains("docDAO:s2:0"), "A chunk of an unreadable record is never returned, even as the nearest, got " + seen);
        test(! seen.contains("free"), "A chunk with no source record is not returned, got " + seen);
        test(ids(store, system, true, 1f, 0f).get(0).equals("docDAO:s2:0"), "A caller who can read s2 gets it first");
        List top = ((ArraySink) store.inX(caller).where(new ReadableSourcePredicate.Builder(caller).build())
          .orderBy(new CosineComparator.Builder(x).setQueryVector(new float[] { 1f, 0f }).build()).limit(1).select(new ArraySink())).getArray();
        test(top.size() == 1 && "docDAO:s1:0".equals(((VectorEmbedding) top.get(0)).getId()), "The unreadable nearest chunk does not use up the limit");

        store.put(chunk("three", "", "", "a 3-number chunk", 1f, 0f, 0f));
        test(ids(store, caller, false, 1f, 0f, 0f).equals(List.of("three")), "A 3-number query reads only 3-number rows");
        test(! ids(store, caller, false, 1f, 0f).contains("three"), "A 2-number query never reads a 3-number row");

        store.remove(store.find("docDAO:s1:0"));
        test(! ids(store, caller, false, 1f, 0f).contains("docDAO:s1:0"), "A removed chunk leaves the search");

        // The indexer: embeds once, again only when the text changes, and leaves no old chunk
        Embedder embedder = new Embedder();
        DAO index = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        X ix = x.put("vectorStoreDAO", index).put("embeddingService", embedder);
        Flow doc = new Flow();
        doc.setName("Doc A");
        doc.setScript("[{\\"flowName\\":\\"markdown1\\",\\"cmd\\":\\"markdown\\",\\"value\\":{\\"class\\":\\"foam.core.reflow.Markdown\\",\\"markdown\\":\\"# A\\\\n\\\\nalpha one\\\\n\\\\n## B\\\\n\\\\nbeta two\\\\n\\\\n## C\\\\n\\\\nalpha three\\"}}]");
        RAGIndexer indexer = new RAGIndexer();
        indexer.index(ix, "flowDAO", doc);
        int first = ((ArraySink) index.select(new ArraySink())).getArray().size();
        test(embedder.calls == 1 && first > 1, "A doc is cut into chunks and embedded in one call, got " + first + " chunks");
        boolean holds = false;
        for ( Object o : ((ArraySink) index.select(new ArraySink())).getArray() ) holds = holds || ((VectorEmbedding) o).getText().contains("alpha one");
        test(holds && index.find("flowDAO:Doc A:0") != null, "Its chunks hold the doc's markdown, ids from flowDAO:Doc A:0");
        indexer.index(ix, "flowDAO", doc);
        test(embedder.calls == 1, "An unchanged doc is not embedded again");
        embedder.model = "fake-2";
        indexer.index(ix, "flowDAO", doc);
        test(embedder.calls == 2 && "fake-2".equals(((VectorEmbedding) index.find("flowDAO:Doc A:0")).getEmbeddingModel()), "An unchanged doc is embedded again after a model switch");
        Flow shorter = (Flow) doc.fclone();
        shorter.setScript("[{\\"flowName\\":\\"markdown1\\",\\"cmd\\":\\"markdown\\",\\"value\\":{\\"class\\":\\"foam.core.reflow.Markdown\\",\\"markdown\\":\\"# A\\\\n\\\\nbeta only\\"}}]");
        indexer.index(ix, "flowDAO", shorter);
        List left = ((ArraySink) index.select(new ArraySink())).getArray();
        boolean oldText = false;
        for ( Object o : left ) oldText = oldText || ((VectorEmbedding) o).getText().contains("alpha three");
        test(embedder.calls == 3 && left.size() < first && ! oldText, "A shorter edit is embedded again and leaves no chunk of the old text, got " + left.size());
        embedder.fail = true;
        Flow longer = (Flow) doc.fclone();
        longer.setDescription("an edit made while the gateway is down");
        try { indexer.index(ix, "flowDAO", longer); } catch ( RuntimeException e ) { /* the rule logs it */ }
        test(((ArraySink) index.select(new ArraySink())).getArray().size() == left.size(), "A failed embedding call leaves the doc's chunks in place");

        // A long section is cut in pieces that each start with its heading
        String para = "word ".repeat(300).trim();
        MarkdownChunkerServiceImpl chunker = new MarkdownChunkerServiceImpl(x);
        String[] pieces = chunker.chunk(x, "# Doc\\n\\n## 8. Known traps\\n\\n" + para + "\\n\\n" + para + "\\n\\n" + para);
        boolean headed = pieces.length > 1;
        for ( String piece : pieces ) if ( piece.contains("word") ) headed = headed && piece.startsWith("8. Known traps\\n\\n") && piece.length() <= chunker.getMaxChunkChars();
        test(headed, "Every piece of a long section starts with its heading and stays within the size limit, got " + pieces.length + " pieces");

        // ask(): only readable chunks reach the model, and only their records are listed
        DAO kb = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        kb.put(chunk("docDAO:s1:0", "docDAO", "s1", "alpha is the first letter", 0.8f, 0.2f));
        kb.put(chunk("docDAO:s2:0", "docDAO", "s2", "secret alpha plan", 1f, 0f));
        Model model = new Model();
        X sx = x.put("vectorStoreDAO", kb).put("embeddingService", new Embedder()).put("llmService", model);
        ServerRAGService rag = new ServerRAGService.Builder(sx).build();
        RAGAnswer a = rag.ask(sx.put("docDAO", caller.get("docDAO")), "What is alpha?", new String[] { "docDAO" }, "fr");
        test(a.getAnswered() && a.getSources().length == 1 && "s1".equals(a.getSources()[0].getSourceId()), "The answer lists the readable doc only");
        test(! model.prompt.contains("secret"), "The model is never sent a chunk the user cannot read");
        test(model.prompt.contains("Answer in: French"), "The model is told the language of the user's screens, French for fr");
        model.reply = "NO_ANSWER";
        RAGAnswer none = rag.ask(sx.put("docDAO", caller.get("docDAO")), "What is alpha?", new String[] { "docDAO" }, "fr");
        test(! none.getAnswered() && none.getSources().length == 1 && "s1".equals(none.getSources()[0].getSourceId()), "NO_ANSWER reads as no answer, with the closest readable doc to open");
        int before = model.calls;
        RAGAnswer far = rag.ask(sx.put("docDAO", caller.get("docDAO")), "What is the capital of France?", new String[] { "docDAO" }, "en");
        test(! far.getAnswered() && far.getSources().length == 0 && model.calls == before, "An unrelated question reaches no doc, offers none and costs no model call");
        test(! rag.ask(sx.put("docDAO", caller.get("docDAO")), "What is alpha?", new String[] { "" }, "en").getAnswered() && model.calls == before, "An empty daoKey reaches no chunk and no model call");
        X nobody = sx.put("docDAO", new FilteredDAO.Builder(x).setPredicate(MLang.EQ(VectorEmbedding.ID, "none")).setDelegate(docs).build());
        test(! rag.ask(nobody, "What is alpha?", new String[] { "docDAO" }, "fr").getAnswered() && model.calls == before, "With no readable doc there is no answer and no model call");
      `
    }
  ]
});
