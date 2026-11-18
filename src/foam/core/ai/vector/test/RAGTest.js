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
    its text changed and leaves no chunk of the old text, an EmbeddingAware DAO
    marks each save NEW, DIRTY or DISCARDED and EmbeddingSync embeds what it
    marked, chunks of several records go in one call, a failing provider costs
    three calls and one warning per sync while one refused record does not stop
    the others, the first sync removes the chunks of a record that is gone, a
    save starts a sync in the background,
    marking a flowDAO doc embedded adds no history row, journal line or
    lastModified, and ask() sends the model only readable chunks and lists only
    their records.
  `,

  javaImports: [
    'foam.ai.llm.ChatRequest',
    'foam.ai.llm.CompletionRequest',
    'foam.ai.llm.LLMResponse',
    'foam.ai.llm.LLMService',
    'foam.ai.llm.RAGAnswer',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.EmbeddingAware',
    'foam.ai.vector.EmbeddingAwareDAO',
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.EmbeddingStatus',
    'foam.ai.vector.EmbeddingSync',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.core.ai.llm.ServerRAGService',
    'foam.core.ai.vector.MarkdownChunkerServiceImpl',
    'foam.core.ai.vector.RAGIndexer',
    'foam.core.ai.vector.ReadableSourcePredicate',
    'foam.core.fs.FileSystemStorage',
    'foam.core.reflow.Flow',
    'foam.core.reflow.FlowHistoryRecord',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.FilteredDAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.X',
    'foam.mlang.MLang',
    'foam.mlang.sink.Count',
    'java.io.File',
    'java.util.Date',
    'java.util.function.BooleanSupplier',
    'java.util.ArrayList',
    'java.util.List'
  ],

  javaCode: `
    /** Embeds a text by its words: "alpha" points one way, "beta" the other. Counts its calls. Fails every call when fail is set, and a call holding the text failOn. */
    public static class Embedder implements EmbeddingService {
      public int     calls;
      public boolean fail;
      public String  failOn;
      public String  model = "fake";
      public String getModel() { return model; }
      public VectorEmbedding embed(X x, String text) { return embedAll(x, new String[] { text })[0]; }
      public VectorEmbedding[] embedAll(X x, String[] texts) {
        calls++;
        if ( fail ) throw new RuntimeException("gateway down");
        for ( String t : texts ) if ( failOn != null && t.contains(failOn) ) throw new RuntimeException("text refused");
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

    /**
     * Counts the warnings EmbeddingAwareDAO and EmbeddingSync send, and keeps their text so a
     * failed check can show them; prints nothing. Other warnings on the same logger are not
     * counted: an MDAO of a few rows warns once that its search was unindexed, because
     * scanning so few rows is cheaper than using the embeddingStatus index.
     */
    public static class Warnings implements foam.core.logger.Logger {
      public int    count;
      public String seen = "";
      public void log(Object... args) { }
      public void info(Object... args) { }
      public void warning(Object... args) {
        // Loggers.logger(x, this) puts the caller's class name first
        if ( ! String.valueOf(args[0]).startsWith("Embedding") ) return;
        count++;
        seen += java.util.Arrays.toString(args) + " ";
      }
      public void error(Object... args) { }
      public void debug(Object... args) { }
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

    /** A Knowledge Base style doc: one markdown block, tagged knowledge when knowledge is true. */
    static Flow doc(String name, String markdown, boolean knowledge) {
      Flow f = new Flow();
      f.setName(name);
      if ( knowledge ) f.setKeywords(new String[] { "knowledge" });
      f.setScript("[{\\"flowName\\":\\"markdown1\\",\\"cmd\\":\\"markdown\\",\\"value\\":{\\"class\\":\\"foam.core.reflow.Markdown\\",\\"markdown\\":\\"" + markdown.replace("\\n", "\\\\n") + "\\"}}]");
      return f;
    }

    static Flow edit(DAO dao, String name) { return (Flow) dao.find(name).fclone(); }

    static EmbeddingStatus status(DAO dao, String name) { return ((EmbeddingAware) dao.find(name)).getEmbeddingStatus(); }

    static long count(DAO dao, foam.mlang.predicate.Predicate p) { return ((Count) dao.where(p).select(MLang.COUNT())).getValue(); }

    static long chunksOf(DAO store, String daoKey, String sourceId) {
      return count(store, MLang.AND(MLang.EQ(VectorEmbedding.DAO_KEY, daoKey), MLang.EQ(VectorEmbedding.SOURCE_ID, sourceId)));
    }

    /** Waits up to 5 seconds for an asynchronous write, e.g. a journal line or a history row. */
    static boolean await(BooleanSupplier done) throws InterruptedException {
      for ( int i = 0 ; i < 50 && ! done.getAsBoolean() ; i++ ) Thread.sleep(100);
      return done.getAsBoolean();
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

        // The indexer: embeds once, again only when the text or the model changes, and leaves no old chunk
        Embedder embedder = new Embedder();
        DAO index = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        X ix = x.put("vectorStoreDAO", index).put("embeddingService", embedder);
        Flow docA = doc("Doc A", "# A\\n\\nalpha one\\n\\n## B\\n\\nbeta two\\n\\n## C\\n\\nalpha three", true);
        RAGIndexer indexer = new RAGIndexer();
        test(indexer.index(ix, "flowDAO", docA), "The indexer reports the call it made");
        int first = ((ArraySink) index.select(new ArraySink())).getArray().size();
        test(embedder.calls == 1 && first > 1, "A doc is cut into chunks and embedded in one call, got " + first + " chunks");
        boolean holds = false;
        for ( Object o : ((ArraySink) index.select(new ArraySink())).getArray() ) holds = holds || ((VectorEmbedding) o).getText().contains("alpha one");
        test(holds && index.find("flowDAO:Doc A:0") != null, "Its chunks hold the doc's markdown, ids from flowDAO:Doc A:0");
        test(! indexer.index(ix, "flowDAO", docA) && embedder.calls == 1, "A doc whose stored chunks hold its text is not embedded again");
        embedder.model = "fake-2";
        test(indexer.index(ix, "flowDAO", docA) && embedder.calls == 2 && "fake-2".equals(((VectorEmbedding) index.find("flowDAO:Doc A:0")).getEmbeddingModel()), "An unchanged doc is embedded again after a model switch");
        Flow shorter = doc("Doc A", "# A\\n\\nbeta only", true);
        indexer.index(ix, "flowDAO", shorter);
        List left = ((ArraySink) index.select(new ArraySink())).getArray();
        boolean oldText = false;
        for ( Object o : left ) oldText = oldText || ((VectorEmbedding) o).getText().contains("alpha three");
        test(embedder.calls == 3 && left.size() < first && ! oldText, "A shorter edit is embedded again and leaves no chunk of the old text, got " + left.size());
        index.put(chunk("flowDAO:Doc A:" + left.size(), "flowDAO", "Doc A", "a chunk left over", 1f, 0f));
        test(indexer.index(ix, "flowDAO", shorter) && embedder.calls == 4 && index.find("flowDAO:Doc A:" + left.size()) == null, "One chunk too many is not the same chunks: the doc is embedded again and the extra chunk goes");
        embedder.fail = true;
        try { indexer.index(ix, "flowDAO", docA); } catch ( RuntimeException e ) { /* the sync logs it */ }
        test(((ArraySink) index.select(new ArraySink())).getArray().size() == left.size(), "A failed embedding call leaves the doc's chunks in place");
        embedder.fail  = false;
        embedder.model = "fake";

        // EmbeddingAwareDAO and EmbeddingSync on a DAO of the test's own: EasyDAO adds the decorator
        // because Flow implements EmbeddingAware, and the decorator adds itself to this embeddingSync
        Embedder      fake  = new Embedder();
        DAO           noteStore = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        // the test runs each sync itself; the sync a save starts is checked further down
        EmbeddingSync sync  = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X             tx    = x.put("vectorStoreDAO", noteStore).put("embeddingService", fake).put("embeddingSync", sync);
        DAO notes = new EasyDAO.Builder(tx).setOf(Flow.getOwnClassInfo()).setName("noteDAO").setAuthorize(false).build().inX(tx);
        String text3 = "# A\\n\\nalpha one\\n\\n## B\\n\\nbeta two\\n\\n## C\\n\\nalpha three";
        // the chunks of Note Z, a record removed while the server was down: no remove_ saw it
        new RAGIndexer().index(tx, "noteDAO", doc("Note Z", "# Z\\n\\nalpha z", true));
        fake.calls = 0;
        notes.put(doc("Note A", text3, true));
        notes.put(doc("Note B", "# B\\n\\nbeta", false));
        test(status(notes, "Note A") == EmbeddingStatus.NEW && fake.calls == 0, "A new embeddable record is NEW, and the save makes no AI call");
        test(status(notes, "Note B") == EmbeddingStatus.DISCARDED, "A new record that is not embeddable is DISCARDED");
        sync.sync(tx);
        test(status(notes, "Note A") == EmbeddingStatus.EMBEDDED && fake.calls == 1 && chunksOf(noteStore, "noteDAO", "Note A") > 1,
          "One sync embeds a NEW record in one call and marks it EMBEDDED, got " + status(notes, "Note A") + ", " + fake.calls + " calls");
        test(chunksOf(noteStore, "noteDAO", "Note B") == 0 && status(notes, "Note B") == EmbeddingStatus.DISCARDED, "A DISCARDED record gets no chunks");
        test(chunksOf(noteStore, "noteDAO", "Note Z") == 0, "The first sync removes the chunks of a record that is gone");
        sync.sync(tx);
        test(fake.calls == 1, "A second sync makes no embedding call");

        Flow note = edit(notes, "Note A");
        note.setEmbeddingStatus(EmbeddingStatus.DIRTY);
        notes.put(note);
        test(status(notes, "Note A") == EmbeddingStatus.EMBEDDED, "A put that only sets the status leaves the status as it was");
        note = edit(notes, "Note A");
        note.setCategory("moved");
        notes.put(note);
        test(status(notes, "Note A") == EmbeddingStatus.EMBEDDED, "A put that changes a field outside the text leaves the status as it was");
        note = edit(notes, "Note A");
        note.setDescription("alpha edited");
        notes.put(note);
        test(status(notes, "Note A") == EmbeddingStatus.DIRTY && fake.calls == 1, "A text edit marks the record DIRTY with no AI call");
        sync.sync(tx);
        test(status(notes, "Note A") == EmbeddingStatus.EMBEDDED && fake.calls == 2, "The next sync embeds the DIRTY record");

        note = edit(notes, "Note A");
        note.setDescription("alpha edited while the gateway is down");
        notes.put(note);
        long kept = chunksOf(noteStore, "noteDAO", "Note A");
        fake.fail = true;
        sync.sync(tx);
        test(status(notes, "Note A") == EmbeddingStatus.DIRTY && chunksOf(noteStore, "noteDAO", "Note A") == kept,
          "A failed embedding call leaves the record DIRTY and its chunks in place, for the next sync to retry");
        fake.fail = false;
        sync.sync(tx);
        test(status(notes, "Note A") == EmbeddingStatus.EMBEDDED, "The next sync retries it");

        int calls = fake.calls;
        note = edit(notes, "Note A");
        note.setDescription("alpha edited again");
        notes.put(note);
        notes.put(doc("Note C", "# C\\n\\nalpha c", true));
        sync.sync(tx);
        test(fake.calls == calls + 1 && status(notes, "Note A") == EmbeddingStatus.EMBEDDED && status(notes, "Note C") == EmbeddingStatus.EMBEDDED,
          "The chunks of two waiting records go in one call, got " + ( fake.calls - calls ) + " calls");
        calls = fake.calls;
        for ( String n : new String[] { "Note L", "Note M", "Note N" } ) notes.put(doc(n, "# " + n + "\\n\\nalpha", true));
        sync.setTextsPerCall(1);
        sync.sync(tx);
        test(fake.calls == calls + 3, "With textsPerCall 1, three one-chunk records take three calls, got " + ( fake.calls - calls ));
        sync.setTextsPerCall(64);

        // A record loaded from a journal at boot: its chunks are already stored, so the sync finds them unchanged
        Flow d = doc("Note D", "# D\\n\\nbeta d", true);
        new RAGIndexer().index(tx, "noteDAO", d);
        calls = fake.calls;
        notes.put(d);
        test(status(notes, "Note D") == EmbeddingStatus.NEW, "A record whose chunks were stored before is NEW until a sync");
        sync.sync(tx);
        test(status(notes, "Note D") == EmbeddingStatus.EMBEDDED && fake.calls == calls, "A NEW record whose stored chunks hold its text turns EMBEDDED with no AI call");

        // A record whose text changed while the server was down: its stored chunks hold the old
        // text, and it loads NEW from the journal, so the sync embeds it again
        new RAGIndexer().index(tx, "noteDAO", doc("Note K", "# K\\n\\nbeta old", true));
        calls = fake.calls;
        notes.put(doc("Note K", "# K\\n\\nbeta new", true));
        sync.sync(tx);
        test(status(notes, "Note K") == EmbeddingStatus.EMBEDDED && fake.calls == calls + 1
          && count(noteStore, MLang.AND(MLang.EQ(VectorEmbedding.SOURCE_ID, "Note K"), MLang.CONTAINS(VectorEmbedding.TEXT, "beta new"))) == 1
          && count(noteStore, MLang.AND(MLang.EQ(VectorEmbedding.SOURCE_ID, "Note K"), MLang.CONTAINS(VectorEmbedding.TEXT, "beta old"))) == 0,
          "A NEW record whose stored chunks hold an older text is embedded again in one AI call, and its chunks hold the new text");

        note = edit(notes, "Note A");
        note.setKeywords(new String[0]);
        notes.put(note);
        test(status(notes, "Note A") == EmbeddingStatus.DISCARDED && chunksOf(noteStore, "noteDAO", "Note A") == 0, "A record that stops being embeddable is DISCARDED and loses its chunks on the save");
        note = edit(notes, "Note A");
        note.setKeywords(new String[] { "knowledge" });
        notes.put(note);
        test(status(notes, "Note A") == EmbeddingStatus.DIRTY, "A record that is embeddable again is DIRTY, though its text is the same");
        sync.sync(tx);
        test(status(notes, "Note A") == EmbeddingStatus.EMBEDDED && chunksOf(noteStore, "noteDAO", "Note A") > 0, "and the next sync embeds it again");

        notes.remove(notes.find("Note A"));
        test(notes.find("Note A") == null && chunksOf(noteStore, "noteDAO", "Note A") == 0, "A removed record leaves with its chunks");
        notes.removeAll();
        test(count(noteStore, MLang.EQ(VectorEmbedding.DAO_KEY, "noteDAO")) == 0, "removeAll leaves no chunk of any record");

        // A provider that is down, e.g. none is configured: a sync stops after two failed calls
        // in a row, so an app with no provider makes two calls and logs one warning per run
        for ( String n : new String[] { "Note E", "Note F", "Note G" } ) notes.put(doc(n, "# " + n + "\\n\\nalpha", true));
        sync.sync(tx);
        for ( String n : new String[] { "Note E", "Note F", "Note G" } ) {
          note = edit(notes, n);
          note.setDescription("alpha edited while the provider is down");
          notes.put(note);
        }
        Warnings warnings = new Warnings();
        X        down     = tx.put("logger", warnings);
        calls     = fake.calls;
        fake.fail = true;
        sync.sync(down);
        sync.sync(down);
        boolean allDirty = status(notes, "Note E") == EmbeddingStatus.DIRTY && status(notes, "Note F") == EmbeddingStatus.DIRTY && status(notes, "Note G") == EmbeddingStatus.DIRTY;
        // per sync: the call for all 3, then one record alone, then a second alone
        test(fake.calls == calls + 6 && warnings.count == 2 && allDirty,
          "A failing provider costs three calls and one warning per sync and leaves the 3 records DIRTY, got " + ( fake.calls - calls ) + " calls, " + warnings.count + " warnings");
        fake.fail = false;
        sync.sync(down);
        test(status(notes, "Note E") == EmbeddingStatus.EMBEDDED && status(notes, "Note F") == EmbeddingStatus.EMBEDDED && status(notes, "Note G") == EmbeddingStatus.EMBEDDED && warnings.count == 2,
          "Once the provider is back, the next sync embeds all 3 with no warning");

        // One record the provider always refuses, e.g. a text it rejects: the sync warns once,
        // leaves that record for the next sync and embeds the others. Note H is first in the
        // DAO, so a sync that stopped at it would embed nothing.
        fake.failOn = "refused";
        notes.put(doc("Note H", "# H\\n\\nalpha refused", true));
        notes.put(doc("Note I", "# I\\n\\nalpha", true));
        notes.put(doc("Note J", "# J\\n\\nbeta", true));
        warnings.count = 0;
        warnings.seen  = "";
        calls          = fake.calls;
        sync.sync(down);
        // the call for all 3 fails, then each goes alone: H refused, I and J embedded
        test(status(notes, "Note H") == EmbeddingStatus.NEW && status(notes, "Note I") == EmbeddingStatus.EMBEDDED && status(notes, "Note J") == EmbeddingStatus.EMBEDDED
          && fake.calls == calls + 4 && warnings.count == 1,
          "A record the provider refuses keeps its status with one warning, and the others are embedded, got " + ( fake.calls - calls ) + " calls, " + warnings.count + " warnings: " + warnings.seen);
        fake.failOn = null;

        // A save starts a sync in the background and returns before the AI call
        Embedder      slow    = new Embedder();
        EmbeddingSync live    = new EmbeddingSync.Builder(x).build();
        DAO           liveStore = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        X             lx      = x.put("vectorStoreDAO", liveStore).put("embeddingService", slow).put("embeddingSync", live);
        live.setX(lx); // the sync a save starts runs in the sync's own context
        DAO           liveDAO = new EasyDAO.Builder(lx).setOf(Flow.getOwnClassInfo()).setName("liveDAO").setAuthorize(false).build().inX(lx);
        liveDAO.put(doc("Live A", "# Live\\n\\nalpha live", true));
        test(await(() -> status(liveDAO, "Live A") == EmbeddingStatus.EMBEDDED) && slow.calls == 1 && chunksOf(liveStore, "liveDAO", "Live A") > 0,
          "A save starts a sync, and the record is embedded with no sync called, got " + status(liveDAO, "Live A") + ", " + slow.calls + " calls");
        slow.fail = true;
        int liveCalls = slow.calls;
        Flow liveEdit = edit(liveDAO, "Live A");
        liveEdit.setDescription("alpha edited while the provider is down");
        liveDAO.put(liveEdit);
        // one record alone: its call, then its call on its own; both fail
        test(await(() -> slow.calls == liveCalls + 2) && status(liveDAO, "Live A") == EmbeddingStatus.DIRTY,
          "A save whose sync fails leaves the record DIRTY for the cron, got " + ( slow.calls - liveCalls ) + " calls");
        liveDAO.put(doc("Live B", "# Live B\\n\\nbeta live", true));
        // A and B: the call for both, then A alone, then B alone; two alone failing means the provider is down
        test(await(() -> slow.calls == liveCalls + 5), "A second failing record marks the provider down, got " + ( slow.calls - liveCalls ) + " calls");
        test(await(() -> live.getDown_()), "The sync marks the provider down");
        liveDAO.put(doc("Live C", "# Live C\\n\\nalpha c live", true));
        test(! live.getRequested_().get(), "Once the provider is down, saves start no sync until a sync gets through");
        slow.fail = false;
        live.sync(lx);
        test(status(liveDAO, "Live A") == EmbeddingStatus.EMBEDDED && status(liveDAO, "Live B") == EmbeddingStatus.EMBEDDED && status(liveDAO, "Live C") == EmbeddingStatus.EMBEDDED,
          "The cron's sync embeds all three");

        // The real flowDAO: marking a doc embedded adds no history row, no journal line and no lastModified.
        // flowDAO runs a history rule on every save and journals each change; the sync writes the status
        // below the rules, and the status is not stored.
        DAO  flows   = ((DAO) x.get("flowDAO")).inX(x);
        DAO  history = (DAO) x.get("localFlowHistoryDAO");
        File journal = ((FileSystemStorage) x.get(FileSystemStorage.class)).get("flows");
        String name  = "RAGTest doc " + System.currentTimeMillis();
        foam.mlang.predicate.Predicate ofDoc = MLang.EQ(FlowHistoryRecord.OBJECT_ID, name);
        DAO dao = (DAO) x.get("flowDAO");
        while ( dao instanceof ProxyDAO && ! ( dao instanceof EmbeddingAwareDAO ) ) dao = ((ProxyDAO) dao).getDelegate();
        EmbeddingSync server = (EmbeddingSync) x.get("embeddingSync");
        boolean onSave = server.getEmbedOnSave();
        server.setEmbedOnSave(false);
        test(dao instanceof EmbeddingAwareDAO, "EasyDAO gave flowDAO an EmbeddingAwareDAO");
        try {
          flows.put(doc(name, "# Real\\n\\nalpha in flowDAO", true));
          test(status(flows, name) == EmbeddingStatus.NEW, "A saved knowledge doc is NEW in flowDAO");
          test(await(() -> count(history, ofDoc) == 1 && journal.length() > 0), "Its save wrote one history row and the journal");
          long rows     = count(history, ofDoc);
          long bytes    = journal.length();
          Date modified = ((Flow) flows.find(name)).getLastModified();
          Thread.sleep(500);
          test(journal.length() == bytes, "The journal is still before the sync, " + journal.length() + " was " + bytes);

          ((EmbeddingAwareDAO) dao).embed_(tx, flows.find(name));
          Thread.sleep(1000);
          test(status(flows, name) == EmbeddingStatus.EMBEDDED, "The sync step marks the doc EMBEDDED");
          test(count(history, ofDoc) == rows, "Marking it EMBEDDED adds no history row, got " + count(history, ofDoc) + " was " + rows);
          test(journal.length() == bytes, "Marking it EMBEDDED writes no journal line, " + journal.length() + " bytes was " + bytes);
          test(java.util.Objects.equals(((Flow) flows.find(name)).getLastModified(), modified), "Marking it EMBEDDED leaves lastModified as it was");

          Flow f = edit(flows, name);
          f.setDescription("an edit by a user");
          flows.put(f);
          test(status(flows, name) == EmbeddingStatus.DIRTY, "A user's text edit marks the doc DIRTY");
          test(await(() -> count(history, ofDoc) == rows + 1 && journal.length() > bytes), "and writes a history row and a journal line, so the checks above could see one");
        } finally {
          Object left2 = flows.find(name);
          if ( left2 != null ) flows.remove((foam.lang.FObject) left2);
          server.setEmbedOnSave(onSave);
        }

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
