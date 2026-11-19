/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.test',
  name: 'RAGServiceTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Answering a question over a stand-in embedder and model: a search with
    ReadableSourcePredicate returns only chunks of records the caller can find
    through their own DAO, a chunk with no daoKey is never returned, a record is
    looked up once however many chunks it has, and ask() sends the model only
    readable chunks at or above minScore, lists only their records. When none
    qualifies it makes no model call with documentsOnly, and otherwise sends the
    question alone. A long section is cut in pieces that
    each start with its heading.
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
    'foam.core.ai.vector.ReadableSourcePredicate',
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
    /** Embeds a text by its words: "alpha" points one way, "beta" the other. */
    public static class Embedder implements EmbeddingService {
      public VectorEmbedding embed(X x, String text) { return embedAll(x, new String[] { text })[0]; }
      public VectorEmbedding[] embedAll(X x, String[] texts) {
        VectorEmbedding[] out = new VectorEmbedding[texts.length];
        for ( int i = 0 ; i < texts.length ; i++ ) {
          float a = texts[i].contains("alpha") ? 1f : 0f, b = texts[i].contains("beta") ? 1f : 0f;
          out[i] = new VectorEmbedding.Builder(x).setText(texts[i]).setEmbeddingModel("fake").setVector(new float[] { a, b }).build();
        }
        return out;
      }
    }

    /** Answers a set reply and keeps the prompt it was sent. */
    public static class Model implements LLMService {
      public String reply = "Alpha is the first letter [s1].";
      public String prompt;
      public String system;
      public int    calls;
      public LLMResponse complete(X x, CompletionRequest r) {
        calls++;
        prompt = r.getPrompt();
        system = r.getOptions() == null ? "" : r.getOptions().getSystemPrompt();
        LLMResponse res = new LLMResponse();
        res.setContent(reply);
        return res;
      }
      public LLMResponse chat(X x, ChatRequest r) { throw new UnsupportedOperationException(); }
    }

    /** Counts its finds, so a test sees how often a record is looked up. */
    public static class CountingDAO extends foam.dao.ProxyDAO {
      public int finds;
      public CountingDAO(X x, DAO delegate) { super(x, delegate); }
      public foam.lang.FObject find_(X x, Object id) { finds++; return super.find_(x, id); }
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

    /** The ids a cosine search of the chunks returns for x, nearest first. */
    static List<String> readable(DAO store, X x, float... q) {
      List<String> out = new ArrayList<>();
      for ( Object o : ((ArraySink) store.inX(x).where(new ReadableSourcePredicate.Builder(x).build())
          .orderBy(new CosineComparator.Builder(x).setQueryVector(q).build()).select(new ArraySink())).getArray() ) {
        out.add(((VectorEmbedding) o).getId());
      }
      return out;
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // A long section is cut in pieces that each start with its heading, so a question
        // that names the section finds every piece of it
        String para = "word ".repeat(300).trim();
        MarkdownChunkerServiceImpl chunker = new MarkdownChunkerServiceImpl(x);
        String[] pieces = chunker.chunk(x, "# Doc\\n\\n## 8. Known traps\\n\\n" + para + "\\n\\n" + para + "\\n\\n" + para);
        boolean headed = pieces.length > 1;
        for ( String piece : pieces ) if ( piece.contains("word") ) headed = headed && piece.startsWith("8. Known traps\\n\\n") && piece.length() <= chunker.getMaxChunkChars();
        test(headed, "Every piece of a long section starts with its heading and stays within the size limit, got " + pieces.length + " pieces");

        // Two source docs, s1 and s2; the caller can find s1 only.
        DAO docs = new MDAO(VectorEmbedding.getOwnClassInfo());
        docs.put(chunk("s1", "", "", "", 0f));
        docs.put(chunk("s2", "", "", "", 0f));
        docs.put(chunk("s3", "", "", "", 0f));
        CountingDAO counted = new CountingDAO(x, new FilteredDAO.Builder(x).setPredicate(MLang.EQ(VectorEmbedding.ID, "s1")).setDelegate(docs).build());
        X caller = x.put("docDAO", counted);

        DAO store = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        store.put(chunk("docDAO:s1:0", "docDAO", "s1", "alpha in s1", 0.8f, 0.2f));
        store.put(chunk("docDAO:s1:1", "docDAO", "s1", "more alpha in s1", 0.6f, 0.4f));
        store.put(chunk("docDAO:s2:0", "docDAO", "s2", "secret alpha in s2", 1f, 0f));
        store.put(chunk("free", "", "", "a chunk with no source record", 0.5f, 0.5f));

        List<String> seen = readable(store, caller, 1f, 0f);
        test(seen.equals(List.of("docDAO:s1:0", "docDAO:s1:1")), "Only chunks of the record the caller can find are returned, nearest first, got " + seen);
        ReadableSourcePredicate once = new ReadableSourcePredicate.Builder(caller).build();
        once.f(chunk("a", "docDAO", "s1", "", 0f));
        int afterFirst = counted.finds;
        once.f(chunk("b", "docDAO", "s1", "", 0f));
        test(afterFirst > 0 && counted.finds == afterFirst, "A second chunk of the same record costs no further find, got " + afterFirst + " then " + counted.finds);
        test(! seen.contains("free"), "A chunk with no daoKey is rejected");
        test(readable(store, x.put("docDAO", docs), 1f, 0f).get(0).equals("docDAO:s2:0"), "A caller who can find s2 gets it first");
        List top = ((ArraySink) store.inX(caller).where(new ReadableSourcePredicate.Builder(caller).build())
          .orderBy(new CosineComparator.Builder(x).setQueryVector(new float[] { 1f, 0f }).build()).limit(1).select(new ArraySink())).getArray();
        test(top.size() == 1 && "docDAO:s1:0".equals(((VectorEmbedding) top.get(0)).getId()), "The unreadable nearest chunk does not use up the limit");

        // a record DAO with numeric ids: the chunk's sourceId "42" finds the user 42
        DAO users = new MDAO(foam.core.auth.User.getOwnClassInfo());
        users.put(new foam.core.auth.User.Builder(x).setId(42).build());
        test(new ReadableSourcePredicate.Builder(x.put("userTestDAO", users)).build().f(chunk("userTestDAO:42:0", "userTestDAO", "42", "a user", 1f, 0f)),
          "A chunk of a record with a numeric id is readable");

        // ask(): only readable chunks reach the model, and only their records are listed
        DAO kb = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        kb.put(chunk("docDAO:s1:0", "docDAO", "s1", "alpha is the first letter", 0.8f, 0.2f));
        kb.put(chunk("docDAO:s2:0", "docDAO", "s2", "secret alpha plan", 1f, 0f));
        Model model = new Model();
        X sx = x.put("vectorStoreDAO", kb).put("embeddingService", new Embedder()).put("llmService", model);
        ServerRAGService rag = new ServerRAGService.Builder(sx).build();
        RAGAnswer a = rag.ask(sx.put("docDAO", counted), "What is alpha?", new String[] { "docDAO" }, "fr");
        test(a.getAnswered() && a.getAnswer().contains("[s1]") && a.getSources().length == 1 && "s1".equals(a.getSources()[0].getSourceId()), "The answer lists the readable doc only");
        test(! model.prompt.contains("secret"), "The model is never sent a chunk the user cannot read");
        test(model.prompt.contains("Answer in: French"), "The model is told the language of the user's screens, French for fr");
        // documentsOnly: a question no readable chunk covers gets no answer and no model call
        ServerRAGService only = new ServerRAGService.Builder(sx).setDocumentsOnly(true).build();
        int before = model.calls;
        RAGAnswer far = only.ask(sx.put("docDAO", counted), "What is the capital of France?", new String[] { "docDAO" }, "en");
        test(! far.getAnswered() && far.getSources().length == 0 && model.calls == before, "With documentsOnly, a question with no chunk at or above minScore costs no model call and offers no source");
        test(! only.ask(sx.put("docDAO", counted), "What is alpha?", new String[] { "" }, "en").getAnswered() && model.calls == before, "An empty daoKey reaches no chunk and no model call");
        X nobody = sx.put("docDAO", new FilteredDAO.Builder(x).setPredicate(MLang.EQ(VectorEmbedding.ID, "none")).setDelegate(docs).build());
        test(! only.ask(nobody, "What is alpha?", new String[] { "docDAO" }, "fr").getAnswered() && model.calls == before, "With documentsOnly and no readable doc there is no answer and no model call");
        // by default the same question goes to the model on its own: no documents, no grounding prompt, no sources
        model.reply = "Paris.";
        RAGAnswer open = rag.ask(nobody, "What is the capital of France?", new String[] { "docDAO" }, "en");
        test(open.getAnswered() && "Paris.".equals(open.getAnswer()) && open.getSources().length == 0 && model.calls == before + 1, "By default a question no document covers is answered by the model, with no source");
        test(! model.prompt.contains("Documents:") && model.prompt.contains("Question: What is the capital of France?") && foam.util.SafetyUtil.isEmpty(model.system), "That call carries only the question, without the documents-only prompt");
        model.reply = "Alpha is the first letter [s1].";
        // two readable docs: the model cites them by number, and the sources are the ones it names
        kb.put(chunk("docDAO:s3:0", "docDAO", "s3", "alpha also starts the alphabet", 0.6f, 0.4f));
        X two = sx.put("docDAO", new FilteredDAO.Builder(x).setPredicate(MLang.OR(MLang.EQ(VectorEmbedding.ID, "s1"), MLang.EQ(VectorEmbedding.ID, "s3"))).setDelegate(docs).build());
        model.reply = "Alpha starts the alphabet [2].";
        RAGAnswer pair = rag.ask(two, "What is alpha?", new String[] { "docDAO" }, "en");
        test(model.prompt.contains("[1]\\nalpha is the first letter") && model.prompt.contains("[2]\\nalpha also starts"), "The documents are numbered from 1 in the order of their nearest chunk");
        test(pair.getAnswered() && pair.getSources().length == 1 && "s3".equals(pair.getSources()[0].getSourceId()), "The sources are the documents the answer names by number, got " + pair.getSources().length);
        model.reply = "Alpha is a letter.";
        test(rag.ask(two, "What is alpha?", new String[] { "docDAO" }, "en").getSources().length == 2, "An answer that names no document lists every document it was given");
        model.reply = "NO_ANSWER";
        RAGAnswer none = rag.ask(sx.put("docDAO", counted), "What is alpha?", new String[] { "docDAO" }, "fr");
        test(! none.getAnswered() && none.getSources().length == 1 && "s1".equals(none.getSources()[0].getSourceId()), "NO_ANSWER reads as no answer, with the closest readable doc to open");
      `
    }
  ]
});
