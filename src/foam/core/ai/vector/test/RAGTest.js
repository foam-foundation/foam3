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
    An EmbeddingAware DAO over a stand-in embedder: each save marks the record
    NEW, DIRTY or DISCARDED with no AI call, and EmbeddingSync embeds what was
    marked. An edit leaves no chunk of the old text, a save that leaves the
    text as it was keeps the status, chunks of several records go in one call,
    a failing provider costs three calls and one warning per sync while one
    refused record does not stop the others, the first sync removes the chunks
    of a record that is gone, a record whose stored chunks already hold its
    text needs no call, a save starts a sync in the background, a record
    edited while its embedding call runs is embedded again by the next sync, and
    a context with no embedder or chunk store saves and removes without error,
    marking a record EMBEDDED fires no rule and writes no journal line, a save
    that lands while the sync marks the record is not overwritten, a record that
    cannot be read is skipped with one warning and the others are embedded, a
    call carries at most textsPerCall chunks, a sync asked for while one runs does
    not wait for it, a context with nothing configured makes no warning, the sweep
    leaves chunks alone while the DAO holds no record, and a refused thread
    submit does not fail the save.
  `,

  javaImports: [
    'foam.ai.vector.EmbeddingAware',
    'foam.ai.vector.EmbeddingAwareDAO',
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.EmbeddingStatus',
    'foam.ai.vector.EmbeddingSync',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.core.ai.vector.RAGIndexer',
    'foam.core.auth.LifecycleState',
    'foam.core.dao.Operation',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.ruler.Rule',
    'foam.core.ruler.RuleGroup',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.EasyDAO',
    'foam.dao.JournalType',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.MLang',
    'foam.mlang.sink.Count',
    'foam.test.TestUtils',
    'java.io.File',
    'java.util.concurrent.CompletableFuture',
    'java.util.concurrent.CountDownLatch',
    'java.util.concurrent.Future',
    'java.util.concurrent.TimeUnit',
    'java.util.concurrent.atomic.AtomicInteger',
    'java.util.function.BooleanSupplier'
  ],

  javaCode: `
    /** Embeds a text by its words: "alpha" points one way, "beta" the other. Counts its calls. Fails every call when fail is set, and a call holding the text failOn. */
    public static class Embedder implements EmbeddingService {
      public int     calls;
      public boolean fail;
      public String  failOn;
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
        for ( String t : texts ) if ( failOn != null && t.contains(failOn) ) throw new RuntimeException("text refused");
        VectorEmbedding[] out = new VectorEmbedding[texts.length];
        for ( int i = 0 ; i < texts.length ; i++ ) {
          float a = texts[i].contains("alpha") ? 1f : 0f, b = texts[i].contains("beta") ? 1f : 0f;
          out[i] = new VectorEmbedding.Builder(x).setText(texts[i]).setEmbeddingModel("fake").setVector(new float[] { a, b }).build();
        }
        return out;
      }
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

    /** A DAO that stops after the first find_ once armed, so a test can save a record while the sync holds it. */
    public static class PausingDAO extends ProxyDAO {
      public volatile boolean pause;
      public final CountDownLatch paused = new CountDownLatch(1);
      public final CountDownLatch resume = new CountDownLatch(1);
      public FObject find_(X x, Object id) {
        FObject found = super.find_(x, id);
        if ( pause ) {
          pause = false;
          paused.countDown();
          try { resume.await(5, TimeUnit.SECONDS); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
        }
        return found;
      }
    }

    /** An agency whose pool is full: every job is refused. */
    public static class RefusingAgency implements Agency {
      public Future<?> submit(X x, ContextAgent agent, String description) { throw new RuntimeException("pool is full"); }
      public void schedule(X x, ContextAgent agent, String description, long delay) { throw new RuntimeException("pool is full"); }
    }

    static RAGNote note(String id, String body) {
      RAGNote n = new RAGNote();
      n.setId(id);
      n.setTitle("Note " + id);
      n.setBody(body);
      return n;
    }

    /** Stores the chunks of a record that is not in noteDAO, as left by an earlier run of the server. */
    static void seed(X x, String daoKey, RAGNote n) {
      DAO source = new MDAO(RAGNote.getOwnClassInfo());
      source.put(n);
      new RAGIndexer().index(x, daoKey, n, source);
    }

    static RAGNote edit(DAO dao, String id) { return (RAGNote) dao.find(id).fclone(); }

    static EmbeddingStatus status(DAO dao, String id) { return ((EmbeddingAware) dao.find(id)).getEmbeddingStatus(); }

    static long count(DAO dao, foam.mlang.predicate.Predicate p) { return ((Count) dao.where(p).select(MLang.COUNT())).getValue(); }

    static long chunksOf(DAO store, String id) {
      return count(store, MLang.AND(MLang.EQ(VectorEmbedding.DAO_KEY, "noteDAO"), MLang.EQ(VectorEmbedding.SOURCE_ID, id)));
    }

    static boolean anyChunkHolds(DAO store, String text) {
      for ( Object o : ((ArraySink) store.select(new ArraySink())).getArray() ) {
        if ( ((VectorEmbedding) o).getText().contains(text) ) return true;
      }
      return false;
    }

    /** Waits up to 5 seconds for a write made in the background. */
    static boolean await(BooleanSupplier done) throws InterruptedException {
      for ( int i = 0 ; i < 50 && ! done.getAsBoolean() ; i++ ) Thread.sleep(100);
      return done.getAsBoolean();
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // EasyDAO adds EmbeddingAwareDAO because RAGNote implements EmbeddingAware, and the
        // decorator adds itself to this embeddingSync. The test runs each sync itself; the
        // sync a save starts is checked further down.
        Embedder      fake  = new Embedder();
        DAO           store = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        EmbeddingSync sync  = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X             tx    = x.put("vectorStoreDAO", store).put("embeddingService", fake).put("embeddingSync", sync);
        DAO           notes = new EasyDAO.Builder(tx).setOf(RAGNote.getOwnClassInfo()).setName("noteDAO").setAuthorize(false).build().inX(tx);
        String        text3 = "alpha one\\n\\n## Part\\n\\nbeta two\\n\\n## Last\\n\\nalpha three";

        // the chunks of note z, a record removed while the server was down: no remove_ saw it
        seed(tx, "noteDAO", note("z", "alpha z"));
        fake.calls = 0;
        notes.put(note("n1", text3));
        RAGNote hidden = note("n2", "beta hidden");
        hidden.setDraft(true);
        notes.put(hidden);
        test(status(notes, "n1") == EmbeddingStatus.NEW && fake.calls == 0, "A new embeddable record is NEW, and the save makes no AI call");
        test(status(notes, "n2") == EmbeddingStatus.DISCARDED, "A new record that is not embeddable is DISCARDED");
        sync.sync(tx);
        long first = chunksOf(store, "n1");
        test(status(notes, "n1") == EmbeddingStatus.EMBEDDED && fake.calls == 1 && first > 1 && store.find("noteDAO:n1:0") != null,
          "One sync embeds a NEW record in one call and marks it EMBEDDED, got " + status(notes, "n1") + ", " + fake.calls + " calls, " + first + " chunks");
        test(chunksOf(store, "n2") == 0 && status(notes, "n2") == EmbeddingStatus.DISCARDED, "A DISCARDED record gets no chunks");
        test(chunksOf(store, "z") == 0, "The first sync removes the chunks of a record that is gone");
        sync.sync(tx);
        test(fake.calls == 1, "A second sync makes no embedding call");

        RAGNote n = edit(notes, "n1");
        n.setEmbeddingStatus(EmbeddingStatus.DIRTY);
        notes.put(n);
        test(status(notes, "n1") == EmbeddingStatus.EMBEDDED, "A put that only sets the status leaves the status as it was");
        n = edit(notes, "n1");
        n.setPinned(true);
        notes.put(n);
        test(status(notes, "n1") == EmbeddingStatus.EMBEDDED, "A put that changes a field outside the text leaves the status as it was");
        n = edit(notes, "n1");
        n.setBody("beta only");
        notes.put(n);
        test(status(notes, "n1") == EmbeddingStatus.DIRTY && fake.calls == 1, "A text edit marks the record DIRTY with no AI call");
        sync.sync(tx);
        test(status(notes, "n1") == EmbeddingStatus.EMBEDDED && fake.calls == 2 && chunksOf(store, "n1") < first && ! anyChunkHolds(store, "alpha three"),
          "The next sync embeds the DIRTY record and leaves no chunk of the old text, got " + chunksOf(store, "n1") + " chunks");

        n = edit(notes, "n1");
        n.setBody("alpha edited while the gateway is down");
        notes.put(n);
        long kept = chunksOf(store, "n1");
        fake.fail = true;
        sync.sync(tx);
        test(status(notes, "n1") == EmbeddingStatus.DIRTY && chunksOf(store, "n1") == kept,
          "A failed embedding call leaves the record DIRTY and its chunks in place, for the next sync to retry");
        fake.fail = false;
        sync.sync(tx);
        test(status(notes, "n1") == EmbeddingStatus.EMBEDDED, "The next sync retries it");

        int calls = fake.calls;
        n = edit(notes, "n1");
        n.setBody("alpha edited again");
        notes.put(n);
        notes.put(note("n3", "alpha three"));
        sync.sync(tx);
        test(fake.calls == calls + 1 && status(notes, "n1") == EmbeddingStatus.EMBEDDED && status(notes, "n3") == EmbeddingStatus.EMBEDDED,
          "The chunks of two waiting records go in one call, got " + ( fake.calls - calls ) + " calls");
        calls = fake.calls;
        for ( String id : new String[] { "l", "m", "o" } ) notes.put(note(id, "alpha"));
        sync.setTextsPerCall(1);
        sync.sync(tx);
        test(fake.calls == calls + 3, "With textsPerCall 1, three one-chunk records take three calls, got " + ( fake.calls - calls ));
        sync.setTextsPerCall(64);

        // A record loaded from a journal at boot: its chunks are already stored, so the sync finds them unchanged
        RAGNote d = note("d", "beta d");
        seed(tx, "noteDAO", d);
        calls = fake.calls;
        notes.put(d);
        test(status(notes, "d") == EmbeddingStatus.NEW, "A record whose chunks were stored before is NEW until a sync");
        sync.sync(tx);
        test(status(notes, "d") == EmbeddingStatus.EMBEDDED && fake.calls == calls, "A NEW record whose stored chunks hold its text turns EMBEDDED with no AI call");

        // A record whose text changed while the server was down: its stored chunks hold the old
        // text, and it loads NEW from the journal, so the sync embeds it again
        seed(tx, "noteDAO", note("k", "beta old"));
        calls = fake.calls;
        notes.put(note("k", "beta new"));
        sync.sync(tx);
        test(status(notes, "k") == EmbeddingStatus.EMBEDDED && fake.calls == calls + 1
          && count(store, MLang.AND(MLang.EQ(VectorEmbedding.SOURCE_ID, "k"), MLang.CONTAINS(VectorEmbedding.TEXT, "beta new"))) == 1
          && count(store, MLang.AND(MLang.EQ(VectorEmbedding.SOURCE_ID, "k"), MLang.CONTAINS(VectorEmbedding.TEXT, "beta old"))) == 0,
          "A NEW record whose stored chunks hold an older text is embedded again in one AI call, and its chunks hold the new text");

        n = edit(notes, "n1");
        n.setDraft(true);
        notes.put(n);
        test(status(notes, "n1") == EmbeddingStatus.DISCARDED && chunksOf(store, "n1") == 0, "A record that stops being embeddable is DISCARDED and loses its chunks on the save");
        n = edit(notes, "n1");
        n.setDraft(false);
        notes.put(n);
        test(status(notes, "n1") == EmbeddingStatus.DIRTY, "A record that is embeddable again is DIRTY, though its text is the same");
        sync.sync(tx);
        test(status(notes, "n1") == EmbeddingStatus.EMBEDDED && chunksOf(store, "n1") > 0, "and the next sync embeds it again");

        notes.remove(notes.find("n1"));
        test(notes.find("n1") == null && chunksOf(store, "n1") == 0, "A removed record leaves with its chunks");
        notes.removeAll();
        test(count(store, MLang.EQ(VectorEmbedding.DAO_KEY, "noteDAO")) == 0, "removeAll leaves no chunk of any record");

        // A provider that is down, e.g. none is configured: a sync stops after two failed calls
        // in a row, so an app with no provider makes three calls and logs one warning per run
        String[] ids = { "e", "f", "g" };
        for ( String id : ids ) notes.put(note(id, "alpha"));
        sync.sync(tx);
        for ( String id : ids ) {
          n = edit(notes, id);
          n.setBody("alpha edited while the provider is down");
          notes.put(n);
        }
        Warnings warnings = new Warnings();
        X        down     = tx.put("logger", warnings);
        calls     = fake.calls;
        fake.fail = true;
        sync.sync(down);
        sync.sync(down);
        boolean allDirty = status(notes, "e") == EmbeddingStatus.DIRTY && status(notes, "f") == EmbeddingStatus.DIRTY && status(notes, "g") == EmbeddingStatus.DIRTY;
        // per sync: the call for all 3, then one record alone, then a second alone
        test(fake.calls == calls + 6 && warnings.count == 2 && allDirty,
          "A failing provider costs three calls and one warning per sync and leaves the 3 records DIRTY, got " + ( fake.calls - calls ) + " calls, " + warnings.count + " warnings");
        fake.fail = false;
        sync.sync(down);
        test(status(notes, "e") == EmbeddingStatus.EMBEDDED && status(notes, "f") == EmbeddingStatus.EMBEDDED && status(notes, "g") == EmbeddingStatus.EMBEDDED && warnings.count == 2,
          "Once the provider is back, the next sync embeds all 3 with no warning");

        // One record the provider always refuses, e.g. a text it rejects: the sync warns once,
        // leaves that record for the next sync and embeds the others. Note h is first in the
        // DAO, so a sync that stopped at it would embed nothing.
        fake.failOn = "refused";
        notes.put(note("h", "alpha refused"));
        notes.put(note("i", "alpha"));
        notes.put(note("j", "beta"));
        warnings.count = 0;
        warnings.seen  = "";
        calls          = fake.calls;
        sync.sync(down);
        // the call for all 3 fails, then each goes alone: h refused, i and j embedded
        test(status(notes, "h") == EmbeddingStatus.NEW && status(notes, "i") == EmbeddingStatus.EMBEDDED && status(notes, "j") == EmbeddingStatus.EMBEDDED
          && fake.calls == calls + 4 && warnings.count == 1,
          "A record the provider refuses keeps its status with one warning, and the others are embedded, got " + ( fake.calls - calls ) + " calls, " + warnings.count + " warnings: " + warnings.seen);
        fake.failOn = null;

        // A save starts a sync in the background and returns before the AI call
        Embedder      slow      = new Embedder();
        EmbeddingSync live      = new EmbeddingSync.Builder(x).build();
        DAO           liveStore = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        X             lx        = x.put("vectorStoreDAO", liveStore).put("embeddingService", slow).put("embeddingSync", live);
        live.setX(lx); // the sync a save starts runs in the sync's own context
        DAO           liveDAO   = new EasyDAO.Builder(lx).setOf(RAGNote.getOwnClassInfo()).setName("liveDAO").setAuthorize(false).build().inX(lx);
        liveDAO.put(note("a", "alpha live"));
        test(await(() -> status(liveDAO, "a") == EmbeddingStatus.EMBEDDED) && slow.calls == 1 && count(liveStore, MLang.EQ(VectorEmbedding.SOURCE_ID, "a")) > 0,
          "A save starts a sync, and the record is embedded with no sync called, got " + status(liveDAO, "a") + ", " + slow.calls + " calls");
        slow.fail = true;
        int liveCalls = slow.calls;
        RAGNote liveEdit = edit(liveDAO, "a");
        liveEdit.setBody("alpha edited while the provider is down");
        liveDAO.put(liveEdit);
        // one record alone: its call, then its call on its own; both fail
        test(await(() -> slow.calls == liveCalls + 2) && status(liveDAO, "a") == EmbeddingStatus.DIRTY,
          "A save whose sync fails leaves the record DIRTY for the cron, got " + ( slow.calls - liveCalls ) + " calls");
        liveDAO.put(note("b", "beta live"));
        // a and b: the call for both, then a alone, then b alone; two alone failing means the provider is down
        test(await(() -> slow.calls == liveCalls + 5), "A second failing record marks the provider down, got " + ( slow.calls - liveCalls ) + " calls");
        test(await(() -> live.getDown_()), "The sync marks the provider down");
        liveDAO.put(note("c", "alpha c live"));
        test(! live.getRequested_().get(), "Once the provider is down, saves start no sync until a sync gets through");
        slow.fail = false;
        live.sync(lx);
        test(status(liveDAO, "a") == EmbeddingStatus.EMBEDDED && status(liveDAO, "b") == EmbeddingStatus.EMBEDDED && status(liveDAO, "c") == EmbeddingStatus.EMBEDDED,
          "The cron's sync embeds all three");

        // The rule engine and a journal run above and below the decorator. A user's save fires the
        // rules and writes a journal line; a sync marking the record EMBEDDED must do neither, since
        // the status is not stored and no user changed the record.
        X rx = TestUtils.mockDAO(x, "localRuleDAO");
        DAO ruleDAO = (DAO) rx.get("localRuleDAO");
        RuleGroup group = new RuleGroup();
        group.setId("ragSync:count puts");
        ((DAO) rx.get("ruleGroupDAO")).put(group);
        AtomicInteger beforePuts = new AtomicInteger();
        AtomicInteger afterPuts  = new AtomicInteger();
        for ( boolean after : new boolean[] { false, true } ) {
          Rule counter = new Rule();
          counter.setId("ragSyncCount" + after);
          counter.setName("rule. counts the puts of ruledNoteDAO " + ( after ? "after" : "before" ));
          counter.setRuleGroup("ragSync:count puts");
          counter.setDaoKey("ruledNoteDAO");
          counter.setOperation(Operation.CREATE_OR_UPDATE);
          counter.setAfter(after);
          counter.setLifecycleState(LifecycleState.ACTIVE);
          AtomicInteger puts = after ? afterPuts : beforePuts;
          counter.setAction((x1, obj, oldObj, ruler, rule, agent) -> puts.incrementAndGet());
          ruleDAO.put_(rx, counter);
        }
        String dir = System.getProperty("java.io.tmpdir") + File.separator + "ragsync_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        Embedder ruledFake = new Embedder();
        EmbeddingSync ruledSync = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X ruledX = rx.put(Storage.class, fs).put(FileSystemStorage.class, fs)
          .put("vectorStoreDAO", new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build())
          .put("embeddingService", ruledFake).put("embeddingSync", ruledSync);
        DAO ruled = new EasyDAO.Builder(ruledX).setOf(RAGNote.getOwnClassInfo()).setName("ruledNoteDAO").setAuthorize(false)
          .setJournalType(JournalType.SINGLE_JOURNAL).setJournalName("ragSyncRuled").build().inX(ruledX);
        File ruledJournal = fs.get("ragSyncRuled");
        ruled.put(note("r1", "alpha ruled"));
        test(await(() -> beforePuts.get() == 1 && afterPuts.get() == 1 && ruledJournal.length() > 0), "A user's save fires the rules and writes a journal line, so the checks below could see one, got " + beforePuts + " and " + afterPuts + " rule runs, " + ruledJournal.length() + " bytes");
        long bytes = ruledJournal.length();
        ruledSync.sync(ruledX);
        Thread.sleep(500);
        test(status(ruled, "r1") == EmbeddingStatus.EMBEDDED, "The sync embedded the record, got " + status(ruled, "r1"));
        test(beforePuts.get() == 1 && afterPuts.get() == 1, "Marking it EMBEDDED fires no rule, got " + beforePuts + " and " + afterPuts + " rule runs");
        test(ruledJournal.length() == bytes, "Marking it EMBEDDED writes no journal line, " + ruledJournal.length() + " bytes was " + bytes);
        RAGNote ruledEdit = edit(ruled, "r1");
        ruledEdit.setBody("beta ruled edit");
        ruled.put(ruledEdit);
        test(await(() -> beforePuts.get() == 2 && afterPuts.get() == 2 && ruledJournal.length() > bytes) && status(ruled, "r1") == EmbeddingStatus.DIRTY, "A user's edit fires the rules again and writes a journal line");

        // a record edited while its embedding call runs: the chunks just written hold the old text,
        // so it stays DIRTY and the next sync embeds the later text
        notes.put(note("r", "alpha first"));
        fake.onEmbed = () -> notes.put(note("r", "beta later"));
        sync.sync(tx);
        test(status(notes, "r") == EmbeddingStatus.DIRTY, "A record edited while its call runs stays DIRTY, got " + status(notes, "r"));
        sync.sync(tx);
        test(status(notes, "r") == EmbeddingStatus.EMBEDDED && chunksOf(store, "r") > 0 && ! anyChunkHolds(store, "alpha first") && anyChunkHolds(store, "beta later"),
          "The next sync ends with the chunks of the later text");

        // no embedder, chunk store or thread pool in the context: saves and removes still work
        X     bare  = x.put("embeddingService", null).put("vectorStoreDAO", null).put("threadPool", null).put("embeddingSync", null);
        DAO   plain = new EasyDAO.Builder(bare).setOf(RAGNote.getOwnClassInfo()).setName("bareNoteDAO").setAuthorize(false).build().inX(bare);
        boolean worked = true;
        try {
          plain.put(note("p1", "alpha"));
          RAGNote hiddenP = edit(plain, "p1");
          hiddenP.setDraft(true);
          plain.put(hiddenP);
          plain.remove(plain.find("p1"));
        } catch ( RuntimeException e ) { worked = false; }
        test(worked && plain.find("p1") == null, "A context with no embedder or chunk store saves and removes without error");

        // A user's save lands between the sync reading the record and writing its status back:
        // the save must win, not be overwritten by the older copy.
        PausingDAO pausing = new PausingDAO();
        pausing.setX(x);
        pausing.setDelegate(new MDAO(RAGNote.getOwnClassInfo()));
        EmbeddingSync raceSync = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X raceX = tx.put("embeddingSync", raceSync);
        DAO race = new EmbeddingAwareDAO.Builder(raceX).setName("raceDAO").setDelegate(pausing).build().inX(raceX);
        race.put(note("w", "alpha first"));
        pausing.pause = true;
        Thread syncing = new Thread(() -> raceSync.sync(raceX));
        syncing.start();
        test(pausing.paused.await(5, TimeUnit.SECONDS), "The sync is between reading the record and writing its status");
        RAGNote windowEdit = edit(race, "w");
        windowEdit.setBody("beta saved in the window");
        Thread saving = new Thread(() -> race.put(windowEdit));
        saving.start();
        Thread.sleep(300);
        pausing.resume.countDown();
        syncing.join(5000);
        saving.join(5000);
        RAGNote afterRace = (RAGNote) race.find("w");
        test(afterRace.getBody().equals("beta saved in the window") && status(race, "w") == EmbeddingStatus.DIRTY,
          "A save that lands while the sync marks the record is kept and leaves it DIRTY, got " + afterRace.getBody() + ", " + status(race, "w"));

        // A record whose text cannot be built is skipped with one warning; the others are embedded and the provider is not marked down
        Warnings poisonWarnings = new Warnings();
        EmbeddingSync poisonSync = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X poisonX = tx.put("embeddingSync", poisonSync).put("logger", poisonWarnings);
        DAO poisoned = new EasyDAO.Builder(poisonX).setOf(RAGNote.getOwnClassInfo()).setName("poisonNoteDAO").setAuthorize(false).build().inX(poisonX);
        for ( String id : new String[] { "pa", "pz", "pb" } ) poisoned.put(note(id, "alpha " + id));
        RAGNote.explodeOn = "pz";
        try {
          poisonSync.sync(poisonX);
        } finally {
          RAGNote.explodeOn = null;
        }
        test(status(poisoned, "pa") == EmbeddingStatus.EMBEDDED && status(poisoned, "pb") == EmbeddingStatus.EMBEDDED && status(poisoned, "pz") == EmbeddingStatus.NEW
          && poisonWarnings.count == 1 && ! poisonSync.getDown_(),
          "A record that cannot be read is skipped with one warning, the others are embedded and the provider is not down, got " + poisonWarnings.count + " warnings: " + poisonWarnings.seen);
        poisonSync.sync(poisonX);
        test(status(poisoned, "pz") == EmbeddingStatus.EMBEDDED, "The next sync embeds it once it can be read");

        // A call carries at most textsPerCall chunks: five chunks at 2 a call take three calls
        Embedder     capFake = new Embedder();
        EmbeddingSync capSync = new EmbeddingSync.Builder(x).setEmbedOnSave(false).setTextsPerCall(2).build();
        DAO          capStore = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        X            capX = x.put("vectorStoreDAO", capStore).put("embeddingService", capFake).put("embeddingSync", capSync);
        DAO          capNotes = new EasyDAO.Builder(capX).setOf(RAGNote.getOwnClassInfo()).setName("noteDAO").setAuthorize(false).build().inX(capX);
        capNotes.put(note("big", "alpha 1\\n\\n## Two\\n\\nbeta 2\\n\\n## Three\\n\\nalpha 3\\n\\n## Four\\n\\nbeta 4\\n\\n## Five\\n\\nalpha 5"));
        capSync.sync(capX);
        long capChunks = chunksOf(capStore, "big");
        test(capChunks >= 3 && capFake.calls == ( capChunks + 1 ) / 2 && status(capNotes, "big") == EmbeddingStatus.EMBEDDED,
          "A record of " + capChunks + " chunks goes in " + capFake.calls + " calls of at most 2 chunks");

        // A sync asked for while one runs returns at once instead of waiting for it
        Embedder       busyFake = new Embedder();
        EmbeddingSync  busySync = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X              busyX = x.put("vectorStoreDAO", new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build())
          .put("embeddingService", busyFake).put("embeddingSync", busySync);
        DAO            busyNotes = new EasyDAO.Builder(busyX).setOf(RAGNote.getOwnClassInfo()).setName("busyNoteDAO").setAuthorize(false).build().inX(busyX);
        busyNotes.put(note("b1", "alpha busy"));
        boolean[] returnedAtOnce = { false };
        busyFake.onEmbed = () -> {
          Thread other = new Thread(() -> busySync.sync(busyX));
          other.start();
          try { other.join(2000); } catch ( InterruptedException e ) { Thread.currentThread().interrupt(); }
          returnedAtOnce[0] = ! other.isAlive();
        };
        busySync.sync(busyX);
        test(returnedAtOnce[0] && status(busyNotes, "b1") == EmbeddingStatus.EMBEDDED, "A sync asked for while one runs does not wait for it");

        // Nothing configured: no warning, no error, and the record stays NEW
        Warnings quiet = new Warnings();
        EmbeddingSync emptySync = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X emptyX = x.put("embeddingService", null).put("vectorStoreDAO", null).put("threadPool", null).put("embeddingSync", emptySync).put("logger", quiet);
        DAO emptyNotes = new EasyDAO.Builder(emptyX).setOf(RAGNote.getOwnClassInfo()).setName("emptyNoteDAO").setAuthorize(false).build().inX(emptyX);
        emptyNotes.put(note("e1", "alpha"));
        emptySync.sync(emptyX);
        test(quiet.count == 0 && ! emptySync.getDown_() && status(emptyNotes, "e1") == EmbeddingStatus.NEW, "A sync with no embedder, chunk store or thread pool does nothing quietly");

        // The sweep leaves the chunks alone while the DAO holds no record, and runs once it holds one
        Embedder     sweepFake = new Embedder();
        DAO          sweepStore = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        EmbeddingSync sweepSync = new EmbeddingSync.Builder(x).setEmbedOnSave(false).build();
        X            sweepX = x.put("vectorStoreDAO", sweepStore).put("embeddingService", sweepFake).put("embeddingSync", sweepSync);
        DAO          sweepNotes = new EasyDAO.Builder(sweepX).setOf(RAGNote.getOwnClassInfo()).setName("sweepNoteDAO").setAuthorize(false).build().inX(sweepX);
        seed(sweepX, "sweepNoteDAO", note("g", "alpha gone"));
        sweepSync.sync(sweepX);
        test(sweepStore.find("sweepNoteDAO:g:0") != null, "The sweep leaves the chunks alone while the DAO holds no record");
        sweepNotes.put(note("h", "beta here"));
        sweepSync.sync(sweepX);
        test(sweepStore.find("sweepNoteDAO:g:0") == null && status(sweepNotes, "h") == EmbeddingStatus.EMBEDDED, "Once the DAO holds a record, the sweep removes the chunks of the record that is gone");

        // A refused thread submit does not fail the save, and the next save may ask again
        EmbeddingSync fullSync = new EmbeddingSync.Builder(x).build();
        X fullX = x.put("vectorStoreDAO", new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build())
          .put("embeddingService", new Embedder()).put("embeddingSync", fullSync);
        fullSync.setX(fullX.put("threadPool", new RefusingAgency()));
        DAO fullNotes = new EasyDAO.Builder(fullX).setOf(RAGNote.getOwnClassInfo()).setName("fullNoteDAO").setAuthorize(false).build().inX(fullX);
        boolean fullSaved = true;
        try { fullNotes.put(note("f1", "alpha")); } catch ( RuntimeException e ) { fullSaved = false; }
        test(fullSaved && fullNotes.find("f1") != null && ! fullSync.getRequested_().get(), "A refused thread submit does not fail the save and leaves no sync waiting");

        // A DAO with no name does not break the registry
        EmbeddingSync nameSync = new EmbeddingSync.Builder(x).build();
        boolean nameOk = true;
        try {
          for ( int i = 0 ; i < 2 ; i++ ) nameSync.add(new EmbeddingAwareDAO.Builder(x).setName(null).setDelegate(new MDAO(RAGNote.getOwnClassInfo())).build());
        } catch ( RuntimeException e ) { nameOk = false; }
        test(nameOk, "Adding a DAO with no name does not throw");
      `
    }
  ]
});
