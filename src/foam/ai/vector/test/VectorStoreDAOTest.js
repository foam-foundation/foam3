/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector.test',
  name: 'VectorStoreDAOTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorIndex',
    'foam.ai.vector.VectorStoreDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Count',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.Collections',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map',
    'java.util.Random',
    'java.util.concurrent.ExecutorService',
    'java.util.concurrent.Executors',
    'java.util.concurrent.Future',
    'java.util.concurrent.atomic.AtomicBoolean',
    'java.util.concurrent.atomic.AtomicInteger',
    'static foam.mlang.MLang.EQ'
  ],

  documentation: `
    VectorStoreDAO answers a CosineComparator select from its index. Every
    search is checked against an exact scan of the same stored vectors, so a wrong
    rank, a lost row or a row from another model fails the test.
  `,

  methods: [
    {
      name: 'runTest',
      javaCode: `
        final X      ctx = x;
        final Random rnd = new Random(42);

        class Fx {
          VectorEmbedding emb(String id, String model, String kind, float[] v) {
            return new VectorEmbedding.Builder(ctx).setId(id).setEmbeddingModel(model).setKind(kind).setVector(v).build();
          }

          float[] rand(int dims) {
            float[] v = new float[dims];
            for ( int i = 0 ; i < dims ; i++ ) v[i] = (float) rnd.nextGaussian();
            return v;
          }

          VectorStoreDAO store() {
            return new VectorStoreDAO.Builder(ctx).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
          }

          // A search loads the index; until then puts only reach the DAO.
          void load(VectorStoreDAO dao) {
            search(dao, rand(16), "m", null, 0, 1);
          }

          List<VectorEmbedding> search(DAO dao, float[] q, String model, Predicate p, long skip, long limit) {
            CosineComparator cc = new CosineComparator.Builder(ctx).setQueryVector(q).setEmbeddingModel(model).build();
            DAO d = p == null ? dao : dao.where(p);
            ArraySink s = (ArraySink) d.orderBy(cc).skip(skip).limit(limit).select(new ArraySink());
            List<VectorEmbedding> out = new ArrayList<>();
            for ( Object o : s.getArray() ) out.add((VectorEmbedding) o);
            return out;
          }

          List<VectorEmbedding> rows(VectorStoreDAO dao) {
            ArraySink s = (ArraySink) dao.getDelegate().select(new ArraySink());
            List<VectorEmbedding> out = new ArrayList<>();
            for ( Object o : s.getArray() ) out.add((VectorEmbedding) o);
            return out;
          }

          // Cosine between a query and a row's vector, computed independently of the index.
          float cos(float[] q, VectorEmbedding e) {
            float[] v = e.getVector();
            double  s = 0, nq = 0, nv = 0;
            for ( int i = 0 ; i < q.length ; i++ ) { s += q[i] * v[i]; nq += q[i] * q[i]; nv += v[i] * v[i]; }
            return (float) (s / Math.sqrt(nq * nv));
          }

          double cosine(float[] a, float[] b) {
            double ab = 0, aa = 0, bb = 0;
            for ( int i = 0 ; i < a.length ; i++ ) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
            return aa == 0 || bb == 0 ? 0 : ab / Math.sqrt(aa * bb);
          }

          int dims(VectorEmbedding e) {
            return e.getVector().length;
          }

          // True when got is exactly ranks [skip, skip+got.size()) of a brute-force scan.
          boolean matchesBrute(List<VectorEmbedding> got, List<VectorEmbedding> all, float[] q, String model, Predicate p, long skip, long limit) {
            List<VectorEmbedding> b = new ArrayList<>();
            for ( VectorEmbedding e : all ) {
              if ( dims(e) != q.length ) continue;
              if ( ! SafetyUtil.isEmpty(model) && ! model.equals(e.getEmbeddingModel()) ) continue;
              if ( p != null && ! p.f(e) ) continue;
              b.add(e);
            }
            b.sort((e1, e2) -> Float.compare(cos(q, e2), cos(q, e1)));
            long expected = Math.max(0, Math.min(limit, b.size() - skip));
            if ( got.size() != expected ) return false;
            for ( int i = 0 ; i < got.size() ; i++ ) {
              float score = got.get(i).getScore();
              if ( Math.abs(score - cos(q, got.get(i))) > 1e-4 ) return false;              // score is the row's true cosine
              if ( Math.abs(score - cos(q, b.get((int) skip + i))) > 1e-4 ) return false;   // and sits at the right rank
            }
            return true;
          }
        }
        Fx fx = new Fx();

        // ── exact ranking, paging, self match ─────────────────────────────────
        VectorStoreDAO dao = fx.store();
        for ( int i = 0 ; i < 500 ; i++ ) dao.put(fx.emb("r" + i, "m", i % 10 == 0 ? "x" : "y", fx.rand(32)));
        float[] q = fx.rand(32);
        List<VectorEmbedding> got = fx.search(dao, q, "m", null, 0, 10);
        test(fx.matchesBrute(got, fx.rows(dao), q, "m", null, 0, 10), "top 10 equals an exact scan of the stored vectors");
        test(fx.matchesBrute(fx.search(dao, q, "m", null, 3, 4), fx.rows(dao), q, "m", null, 3, 4), "skip 3 limit 4 returns ranks 4 to 7");

        VectorEmbedding r7 = (VectorEmbedding) dao.find("r7");
        test(r7.getVector().length == 32, "the stored row keeps the floats it was given");
        got = fx.search(dao, r7.getVector(), "m", null, 0, 1);
        test(got.size() == 1 && "r7".equals(got.get(0).getId()) && got.get(0).getScore() > 0.999f, "a stored vector finds itself first");

        // ── filter before scoring ─────────────────────────────────────────────
        Predicate kindX = EQ(VectorEmbedding.KIND, "x");
        got = fx.search(dao, q, "m", kindX, 0, 20);
        test(fx.matchesBrute(got, fx.rows(dao), q, "m", kindX, 0, 20), "a filtered search returns a full top 20 of the matching rows, in exact order");
        expect(fx.search(dao, q, "m", kindX, 0, 100).size(), 50, "limit 100 over 50 matching rows returns all 50");

        // ── paging through rows with equal scores ─────────────────────────────
        // Identical chunks have identical vectors, so their scores tie. Each page is a separate
        // search with k = skip + limit, so ties must break the same way whatever k is.
        VectorStoreDAO ties = fx.store();
        float[] tv = fx.rand(16);
        for ( int i = 0 ; i < 50 ; i++ ) {
          // Other rows between the tied ones make the top-k heap replace and reorder entries.
          ties.put(fx.emb(String.format("o%02da", i), "m", "y", fx.rand(16)));
          ties.put(fx.emb(String.format("t%02d", i), "m", "y", tv.clone()));
          ties.put(fx.emb(String.format("o%02db", i), "m", "y", fx.rand(16)));
        }
        List<String> paged = new ArrayList<>();
        for ( int page = 0 ; page < 5 ; page++ )
          for ( VectorEmbedding e : fx.search(ties, tv, "m", null, page * 10L, 10) ) paged.add(e.getId());
        boolean pagedInOrder = paged.size() == 50;
        for ( int i = 0 ; i < paged.size() && pagedInOrder ; i++ )
          pagedInOrder = paged.get(i).equals(String.format("t%02d", i));
        test(pagedInOrder, "five pages of ten over fifty tied rows, among other rows, return each row once, in id order");

        // ── vectors of extreme scale ──────────────────────────────────────────
        // The squared length of a component of 1e20 overflows a float, and of 1e-30 underflows it.
        VectorStoreDAO scales = fx.store();
        float[] huge = fx.rand(16), small = fx.rand(16);
        for ( int i = 0 ; i < 16 ; i++ ) { huge[i] *= 1e20f; small[i] *= 1e-30f; }
        scales.put(fx.emb("huge", "m", "y", huge));
        scales.put(fx.emb("small", "m", "y", small));
        got = fx.search(scales, huge, "m", null, 0, 1);
        test(got.size() == 1 && "huge".equals(got.get(0).getId()) && got.get(0).getScore() > 0.999f,
          "a vector of very large components is indexed by its direction");
        got = fx.search(scales, small, "m", null, 0, 1);
        test(got.size() == 1 && "small".equals(got.get(0).getId()) && got.get(0).getScore() > 0.999f,
          "and so is one of very small components, instead of being rejected as all zeros");

        // ── models and dimensions never mix ───────────────────────────────────
        for ( int i = 0 ; i < 50 ; i++ ) {
          dao.put(fx.emb("o" + i, "other", "y", fx.rand(32)));
          dao.put(fx.emb("s" + i, "m",     "y", fx.rand(8)));   // same model name, other dimension count
          dao.put(fx.emb("t" + i, "tiny",  "y", fx.rand(8)));
        }
        got = fx.search(dao, q, "m", null, 0, 600);
        boolean onlyM32 = got.size() == 500;
        for ( VectorEmbedding e : got ) onlyM32 = onlyM32 && "m".equals(e.getEmbeddingModel()) && fx.dims(e) == 32;
        test(onlyM32, "a search for model m with a 32-dim query sees only m's 32-dim rows");
        got = fx.search(dao, q, "", null, 0, 10);
        test(fx.matchesBrute(got, fx.rows(dao), q, "", null, 0, 10), "with no model, every 32-dim row competes and 8-dim rows are skipped");
        float[] q8 = fx.rand(8);
        got = fx.search(dao, q8, "m", null, 0, 100);
        boolean onlyM8 = got.size() == 50;
        for ( VectorEmbedding e : got ) onlyM8 = onlyM8 && "m".equals(e.getEmbeddingModel()) && fx.dims(e) == 8;
        test(onlyM8, "an 8-dim query for model m sees only m's 8-dim rows");

        // ── update, move between models, remove ───────────────────────────────
        float[] a = fx.rand(32), b = fx.rand(32);
        dao.put(fx.emb("u", "m", "y", a));
        dao.put(fx.emb("u", "m", "y", b));
        got = fx.search(dao, b, "m", null, 0, 5);
        int uCount = 0;
        for ( VectorEmbedding e : got ) if ( "u".equals(e.getId()) ) uCount++;
        test("u".equals(got.get(0).getId()) && uCount == 1, "an update replaces the vector instead of adding a second row");
        dao.put(fx.emb("u", "other", "y", b));
        got = fx.search(dao, b, "m", null, 0, 5);
        test(! "u".equals(got.get(0).getId()), "a row moved to another model leaves the old model's search");
        test("u".equals(fx.search(dao, b, "other", null, 0, 1).get(0).getId()), "and appears in the new model's search");
        dao.remove(dao.find("u"));
        test(! "u".equals(fx.search(dao, b, "other", null, 0, 1).get(0).getId()), "a removed row is no longer found");

        for ( int i = 0 ; i < 500 ; i += 2 ) dao.remove(dao.find("r" + i));
        boolean selfFound = true;
        for ( int i = 1 ; i < 500 ; i += 50 ) {
          VectorEmbedding e = (VectorEmbedding) dao.find("r" + i);
          List<VectorEmbedding> top = fx.search(dao, e.getVector(), "m", null, 0, 1);
          selfFound = selfFound && top.size() == 1 && ("r" + i).equals(top.get(0).getId());
        }
        test(selfFound, "after removing every other row, each remaining row still finds itself first");
        test(fx.matchesBrute(fx.search(dao, q, "m", null, 0, 10), fx.rows(dao), q, "m", null, 0, 10), "ranking stays exact after removals");

        // ── rows already in the delegate (a replayed journal) ──────────────────
        MDAO raw = new MDAO(VectorEmbedding.getOwnClassInfo());
        for ( int i = 0 ; i < 100 ; i++ ) raw.put(fx.emb("L" + i, "m", "y", fx.rand(16)));   // rows that still hold floats
        VectorStoreDAO lazy = new VectorStoreDAO.Builder(x).setDelegate(raw).build();
        float[] l5 = ((VectorEmbedding) raw.find("L5")).getVector();
        got = fx.search(lazy, l5, "m", null, 0, 1);
        test(got.size() == 1 && "L5".equals(got.get(0).getId()), "the index loads rows already in the delegate on first search");

        // ── removeAll ─────────────────────────────────────────────────────────
        dao.removeAll();
        expect(fx.search(dao, q, "m", null, 0, 10).size(), 0, "removeAll empties the index");
        dao.put(fx.emb("after", "m", "y", q));
        got = fx.search(dao, q, "m", null, 0, 10);
        test(got.size() == 1 && "after".equals(got.get(0).getId()), "rows put after removeAll are searchable");

        // ── limits and bad input ──────────────────────────────────────────────
        got = fx.search(dao, q, "m", null, 0, Integer.MAX_VALUE);
        test(got.size() == 1, "a limit of 2^31 returns the matching rows instead of sizing an array to the limit");

        float[] nan = fx.rand(32);
        nan[3] = Float.NaN;
        boolean nanRejected = false;
        try { dao.put(fx.emb("nan", "m", "y", nan)); } catch (IllegalArgumentException e) { nanRejected = true; }
        test(nanRejected && dao.find("nan") == null, "a vector holding NaN is rejected and not stored");
        test(VectorIndex.normalized(nan)[0] == 0f, "a NaN vector normalises to zeros, never a NaN score");

        boolean zeroRejected = false;
        try { dao.put(fx.emb("zero", "m", "y", new float[16])); } catch (IllegalArgumentException e) { zeroRejected = true; }
        test(zeroRejected && dao.find("zero") == null, "an all-zero vector is rejected: it has no direction to compare");

        VectorEmbedding badRow = fx.emb("bad", "m", "y", nan);
        MDAO withBad = new MDAO(VectorEmbedding.getOwnClassInfo());
        withBad.put(badRow);   // a row that reached the delegate without passing VectorStoreDAO
        withBad.put(fx.emb("good", "m", "y", q));
        VectorStoreDAO tolerant = new VectorStoreDAO.Builder(x).setDelegate(withBad).build();
        got = fx.search(tolerant, q, "m", null, 0, 10);
        test(got.size() == 1 && "good".equals(got.get(0).getId()), "a stored row holding NaN is skipped instead of breaking every search");

        // ── remove before the index has loaded ────────────────────────────────
        MDAO preload = new MDAO(VectorEmbedding.getOwnClassInfo());
        for ( int i = 0 ; i < 20 ; i++ ) preload.put(fx.emb("P" + i, "m", "y", fx.rand(16)));
        VectorStoreDAO unloaded = new VectorStoreDAO.Builder(x).setDelegate(preload).build();
        float[] p3 = ((VectorEmbedding) preload.find("P3")).getVector();
        unloaded.remove(preload.find("P3"));
        got = fx.search(unloaded, p3, "m", null, 0, 20);
        boolean p3Gone = got.size() == 19;
        for ( VectorEmbedding e : got ) p3Gone = p3Gone && ! "P3".equals(e.getId());
        test(p3Gone, "a row removed before the first search never appears in results");

        // ── a search returns only rows the delegate lets the caller read ──────
        // The delegate hides kind "secret", as an authorizing decorator would. The
        // 20 secret rows are the closest to the query, so a search that trusted the
        // index would return them; the visible rows must fill the page instead.
        MDAO hiddenRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        Map<Object, Integer> findCalls = new HashMap<>();
        DAO  guarded    = new ProxyDAO(x, hiddenRows) {
          @Override
          public FObject find_(X x, Object id) {
            findCalls.merge(id, 1, Integer::sum);
            FObject o = super.find_(x, id);
            return o != null && "secret".equals(((VectorEmbedding) o).getKind()) ? null : o;
          }
        };
        VectorStoreDAO authed = new VectorStoreDAO.Builder(x).setDelegate(guarded).build();
        float[] qa = fx.rand(16);
        for ( int i = 0 ; i < 20 ; i++ ) {
          float[] v = qa.clone();
          v[i % 16] += 0.01f;
          authed.put(fx.emb("s" + i, "m", "secret", v));
        }
        for ( int i = 0 ; i < 30 ; i++ ) authed.put(fx.emb("v" + i, "m", "y", fx.rand(16)));
        got = fx.search(authed, qa, "m", null, 0, 5);
        List<VectorEmbedding> visibleRows = new ArrayList<>();
        for ( VectorEmbedding e : fx.rows(authed) ) if ( "y".equals(e.getKind()) ) visibleRows.add(e);
        test(fx.matchesBrute(got, visibleRows, qa, "m", null, 0, 5),
          "a search skips rows the delegate will not return and still fills the page with the next best");
        boolean onceEach = ! findCalls.isEmpty();
        for ( int n : findCalls.values() ) onceEach = onceEach && n == 1;
        test(onceEach, "when a search goes deeper, each hit is checked with the delegate once, not once per round");

        // ── updating a found row with a new vector ────────────────────────────
        VectorStoreDAO upd = fx.store();
        for ( int i = 0 ; i < 10 ; i++ ) upd.put(fx.emb("u" + i, "m", "y", fx.rand(16)));
        fx.search(upd, fx.rand(16), "m", null, 0, 1);
        float[] fresh = fx.rand(16);
        VectorEmbedding u3 = (VectorEmbedding) upd.find("u3").fclone();
        u3.setVector(fresh);
        upd.put(u3);
        got = fx.search(upd, fresh, "m", null, 0, 1);
        test(got.size() == 1 && "u3".equals(got.get(0).getId()) && got.get(0).getScore() > 0.99f,
          "after the update, a search for the new vector finds the row");

        // ── a query that cannot be scored ─────────────────────────────────────
        float[] nanQ = fx.rand(16);
        nanQ[0] = Float.NaN;
        boolean nanQRejected = false;
        try { fx.search(upd, nanQ, "m", null, 0, 3); } catch (IllegalArgumentException e) { nanQRejected = true; }
        test(nanQRejected, "a query holding NaN is rejected instead of ranking rows by NaN");
        got = fx.search(upd, new float[16], "m", null, 0, 3);
        boolean allZero = got.size() == 3;
        for ( VectorEmbedding e : got ) allZero = allZero && e.getScore() == 0f;
        test(allZero, "an all-zero query returns k rows that all score 0");

        // ── a large store (25,000 rows) ───────────────────────────────────────
        VectorStoreDAO big = fx.store();
        for ( int i = 0 ; i < 25000 ; i++ ) big.put(fx.emb("b" + i, "m", i % 100 == 0 ? "x" : "y", fx.rand(16)));
        float[] qb = fx.rand(16);
        test(fx.matchesBrute(fx.search(big, qb, "m", null, 0, 10), fx.rows(big), qb, "m", null, 0, 10), "a search over 25,000 rows equals an exact scan");
        test(fx.matchesBrute(fx.search(big, qb, "m", kindX, 0, 50), fx.rows(big), qb, "m", kindX, 0, 50), "a filtered search over 25,000 rows equals an exact scan");

        // ── removeAll with a predicate ────────────────────────────────────────
        VectorStoreDAO partial = fx.store();
        for ( int i = 0 ; i < 40 ; i++ ) partial.put(fx.emb("pa" + i, "m", i % 2 == 0 ? "x" : "y", fx.rand(16)));
        fx.load(partial);
        partial.where(kindX).removeAll();
        test(partial.getIndex().isLoaded() && partial.getIndex().size() == 20,
          "removeAll with a predicate leaves the index loaded, holding only the rows that remain");
        got = fx.search(partial, fx.rand(16), "m", null, 0, 100);
        boolean onlyY = got.size() == 20;
        for ( VectorEmbedding e : got ) onlyY = onlyY && "y".equals(e.getKind());
        test(onlyY, "removeAll with a predicate removes exactly the matching rows from search");

        // A search that runs while rows are removed never sees an empty index.
        final VectorStoreDAO churn = fx.store();
        final float[] churnQ = fx.rand(16);
        for ( int i = 0 ; i < 20 ; i++ ) churn.put(fx.emb("cy" + i, "m", "y", fx.rand(16)));
        fx.search(churn, churnQ, "m", null, 0, 10);
        final AtomicBoolean churning = new AtomicBoolean(true);
        final AtomicInteger shortPages = new AtomicInteger();
        ExecutorService churnPool = Executors.newFixedThreadPool(4);
        List<Future<?>> churnFutures = new ArrayList<>();
        for ( int t = 0 ; t < 4 ; t++ ) {
          churnFutures.add(churnPool.submit(() -> {
            while ( churning.get() )
              if ( fx.search(churn, churnQ, "m", null, 0, 10).size() < 10 ) shortPages.incrementAndGet();
          }));
        }
        for ( int round = 0 ; round < 200 ; round++ ) {
          churn.put(fx.emb("cx" + round, "m", "x", fx.rand(16)));
          churn.where(kindX).removeAll();
        }
        churning.set(false);
        for ( Future<?> f : churnFutures ) f.get();
        churnPool.shutdown();
        expect(shortPages.get(), 0, "a search during removeAll calls never returns a short page");

        // ── first use from many threads at once ───────────────────────────────
        MDAO coldRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        for ( int i = 0 ; i < 500 ; i++ ) coldRows.put(fx.emb("k" + i, "m", "y", fx.rand(16)));
        final VectorStoreDAO cold = new VectorStoreDAO.Builder(x).setDelegate(coldRows).build();
        ExecutorService coldPool = Executors.newFixedThreadPool(8);
        List<Future<?>> coldFutures = new ArrayList<>();
        for ( int t = 0 ; t < 8 ; t++ ) {
          final int tt = t;
          coldFutures.add(coldPool.submit(() -> {
            if ( tt % 2 == 0 ) cold.put(fx.emb("kc" + tt, "m", "y", fx.rand(16)));
            else fx.search(cold, fx.rand(16), "m", null, 0, 10);
          }));
        }
        boolean coldOk = true;
        for ( Future<?> f : coldFutures ) {
          try { f.get(); } catch (Exception e) { coldOk = false; }
        }
        coldPool.shutdown();
        test(coldOk, "8 threads using a fresh store for the first time run without errors");
        expect((long) cold.getIndex().size(), 504L, "the first use from many threads builds one index holding every row");

        // ── concurrent puts and searches ──────────────────────────────────────
        final VectorStoreDAO conc = fx.store();
        for ( int i = 0 ; i < 2000 ; i++ ) conc.put(fx.emb("c" + i, "m", "y", fx.rand(16)));
        ExecutorService pool    = Executors.newFixedThreadPool(8);
        List<Future<?>> futures = new ArrayList<>();
        for ( int t = 0 ; t < 4 ; t++ ) {
          final int tt = t;
          futures.add(pool.submit(() -> { for ( int i = 0 ; i < 500 ; i++ ) conc.put(fx.emb("w" + tt + "-" + i, "m", "y", fx.rand(16))); }));
          futures.add(pool.submit(() -> {
            for ( int i = 0 ; i < 100 ; i++ ) {
              if ( fx.search(conc, fx.rand(16), "m", null, 0, 10).size() != 10 ) throw new RuntimeException("short result");
            }
          }));
        }
        boolean concurrentOk = true;
        for ( Future<?> f : futures ) {
          try { f.get(); } catch (Exception e) { concurrentOk = false; }
        }
        pool.shutdown();
        test(concurrentOk, "4 writers and 4 searchers run together without errors or short results");
        long rows = ((Count) conc.getDelegate().select(new Count())).getValue();
        expect(rows, 4000L, "every concurrent put reached the DAO");
        expect((long) conc.getIndex().size(), rows, "the index holds exactly the DAO's rows after concurrent puts");

        // ── concurrent puts and removes of the SAME ids ───────────────────────
        // Without each write and its index update happening as one step, two puts
        // of one id can reach the index in the opposite order to the DAO, or a
        // remove can leave the row in the index.
        final VectorStoreDAO same = fx.store();
        for ( int i = 0 ; i < 20 ; i++ ) same.put(fx.emb("id" + i, "m", "y", fx.rand(16)));
        fx.search(same, fx.rand(16), "m", null, 0, 1);   // load the index, so later writes update it
        ExecutorService pool2 = Executors.newFixedThreadPool(8);
        List<Future<?>> sameFutures = new ArrayList<>();
        for ( int t = 0 ; t < 8 ; t++ ) {
          final int seed = t;
          sameFutures.add(pool2.submit(() -> {
            Random r = new Random(seed);
            for ( int i = 0 ; i < 400 ; i++ ) {
              String id = "id" + r.nextInt(20);
              if ( r.nextInt(4) == 0 ) {
                FObject o = same.find(id);
                if ( o != null ) same.remove(o);
              } else {
                same.put(fx.emb(id, "m", "y", fx.rand(16)));
              }
            }
          }));
        }
        boolean sameOk = true;
        for ( Future<?> f : sameFutures ) {
          try { f.get(); } catch (Exception e) { sameOk = false; }
        }
        pool2.shutdown();
        test(sameOk, "8 threads putting and removing the same 20 ids run without errors");
        long sameRows = ((Count) same.getDelegate().select(new Count())).getValue();
        expect((long) same.getIndex().size(), sameRows, "after same-id puts and removes, the index holds exactly the DAO's rows");
        boolean latestVersion = true;
        for ( VectorEmbedding e : fx.rows(same) ) {
          List<VectorEmbedding> top = fx.search(same, e.getVector(), "m", null, 0, 1);
          latestVersion = latestVersion && top.size() == 1 && e.getId().equals(top.get(0).getId())
            && java.util.Arrays.equals(e.getVector(), top.get(0).getVector());
        }
        test(latestVersion, "for every id, the index holds the same version of the vector as the DAO");

      `
    }
  ]
});
