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
    'foam.ai.vector.Float32Quantizer',
    'foam.ai.vector.Fp16Quantizer',
    'foam.ai.vector.Int8Quantizer',
    'foam.ai.vector.Quantizer',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorIndex',
    'foam.ai.vector.VectorStoreDAO',
    'foam.core.partition.AllPartitions',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.dao.java.JDAO',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lib.StoragePropertyPredicate',
    'foam.lib.json.JSONParser',
    'foam.lib.json.Outputter',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Count',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.Base64',
    'java.util.Collections',
    'java.util.HashMap',
    'java.util.HashSet',
    'java.util.List',
    'java.util.Map',
    'java.util.Random',
    'java.util.Set',
    'java.util.concurrent.ExecutorService',
    'java.util.concurrent.Executors',
    'java.util.concurrent.Future',
    'java.util.concurrent.atomic.AtomicBoolean',
    'java.util.concurrent.atomic.AtomicInteger',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.IN',
    'static foam.mlang.MLang.NOT',
    'static foam.mlang.MLang.OR'
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
            // 512-byte blocks: a 16-dim int8 row is 20 bytes, so a block holds 32 rows and every
            // test that uses this store crosses block borders.
            return new VectorStoreDAO.Builder(ctx).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo()))
              .setQuantizer(int8()).setBlockBytes(512).build();
          }

          // The framework default is float32; most tests here are about the index, and run on int8.
          Quantizer int8() { return new Int8Quantizer(); }

          // The same, partitioned on kind.
          VectorStoreDAO partitioned() {
            return new VectorStoreDAO.Builder(ctx).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo()))
              .setQuantizer(int8()).setBlockBytes(512).setPartitionProperty(VectorEmbedding.KIND).build();
          }

          // A search loads the index; until then puts only reach the DAO. A partitioned store
          // refuses a search that names no partition, so that one visits them all.
          void load(VectorStoreDAO dao) {
            Predicate all = null;
            if ( dao.getPartitionProperty() != null ) {
              AllPartitions every = new AllPartitions();
              every.setArg1(dao.getPartitionProperty());
              all = every;
            }
            search(dao, rand(16), "m", all, 0, 1);
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

          // Cosine between a query and a row's STORED vector, computed independently of the index.
          float cos(float[] q, VectorEmbedding e) {
            float[] v = e.floats();
            double n = 0, s = 0;
            for ( float f : q ) n += f * f;
            n = Math.sqrt(n);
            for ( int i = 0 ; i < q.length ; i++ ) s += q[i] / n * v[i];
            return (float) s;
          }

          double cosine(float[] a, float[] b) {
            double ab = 0, aa = 0, bb = 0;
            for ( int i = 0 ; i < a.length ; i++ ) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
            return aa == 0 || bb == 0 ? 0 : ab / Math.sqrt(aa * bb);
          }

          int dims(VectorEmbedding e) {
            return e.floats().length;
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

        // ── quantizers ────────────────────────────────────────────────────────
        float[] v64 = fx.rand(64);
        float[] u64 = VectorIndex.normalized(v64);
        for ( Quantizer qz : new Quantizer[] { new Int8Quantizer(), new Fp16Quantizer(), new Float32Quantizer() } ) {
          String  f   = qz.formatId();
          byte[]  enc = qz.encode(u64);
          expect(enc.length, qz.encodedSize(64), f + ": encode() is exactly encodedSize() bytes");
          test(fx.cosine(v64, qz.decode(enc)) > ( qz instanceof Int8Quantizer ? 0.999 : 0.99999 ),
            f + ": decode(encode(v)) is within rounding of v");
          float[] dec = qz.decode(enc);
          double  ref = 0;
          for ( int i = 0 ; i < 64 ; i++ ) ref += u64[i] * dec[i];
          test(Math.abs(qz.dot(u64, enc, 0) - ref) < 1e-4, f + ": dot() on the bytes equals the dot product of the decoded vector");
          VectorEmbedding j = new VectorEmbedding.Builder(x).setId("j-" + f)
            .setVectorData(Base64.getEncoder().encodeToString(enc)).setVectorFormat(f).build();
          test(fx.cosine(v64, j.floats()) > ( qz instanceof Int8Quantizer ? 0.999 : 0.99999 ),
            f + ": a row holding these bytes decodes by its vectorFormat (VectorEmbedding.floats)");
        }
        test(new Int8Quantizer().decode(new Int8Quantizer().encode(new float[8]))[0] == 0f, "a zero vector encodes and decodes to zeros, never NaN");

        // ── exact ranking, paging, self match ─────────────────────────────────
        VectorStoreDAO dao = fx.store();
        for ( int i = 0 ; i < 500 ; i++ ) dao.put(fx.emb("r" + i, "m", i % 10 == 0 ? "x" : "y", fx.rand(32)));
        float[] q = fx.rand(32);
        List<VectorEmbedding> got = fx.search(dao, q, "m", null, 0, 10);
        test(fx.matchesBrute(got, fx.rows(dao), q, "m", null, 0, 10), "top 10 equals an exact scan of the stored vectors");
        test(fx.matchesBrute(fx.search(dao, q, "m", null, 3, 4), fx.rows(dao), q, "m", null, 3, 4), "skip 3 limit 4 returns ranks 4 to 7");

        VectorEmbedding r7 = (VectorEmbedding) dao.find("r7");
        // FloatArray's factory makes an unset vector read as an empty array, never null.
        test(r7.getVector().length == 0, "the stored row keeps only the int8 form, not the floats");
        got = fx.search(dao, r7.floats(), "m", null, 0, 1);
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
        test(got.size() == 1 && "huge".equals(got.get(0).getId()) && got.get(0).getScore() > 0.99f,
          "a vector of very large components is indexed by its direction");
        got = fx.search(scales, small, "m", null, 0, 1);
        test(got.size() == 1 && "small".equals(got.get(0).getId()) && got.get(0).getScore() > 0.99f,
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
          List<VectorEmbedding> top = fx.search(dao, e.floats(), "m", null, 0, 1);
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

        // ── journal form ──────────────────────────────────────────────────────
        JSONParser parser = (JSONParser) x.create(JSONParser.class);
        VectorEmbedding legacy = (VectorEmbedding) parser.parseString(
          "{class:\\"foam.ai.vector.VectorEmbedding\\",id:\\"old\\",embeddingModel:\\"m\\",vector:[0.6,0.8]}");
        MDAO legacyRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        legacyRows.put(legacy);
        got = fx.search(new VectorStoreDAO.Builder(x).setDelegate(legacyRows).build(), new float[] { 0.6f, 0.8f }, "m", null, 0, 1);
        test(got.size() == 1 && "old".equals(got.get(0).getId()) && got.get(0).getScore() > 0.999f,
          "an old journal row holding floats loads and is searchable");

        String json = new Outputter(x).setPropertyPredicate(new StoragePropertyPredicate()).stringify(r7);
        test(json.indexOf("vectorData") >= 0 && json.indexOf("\\"vector\\"") < 0, "a journaled row carries vectorData and no float array");
        VectorEmbedding back = (VectorEmbedding) parser.parseString(json);
        test(back != null && r7.getVectorData().equals(back.getVectorData()) && r7.getVectorFormat().equals(back.getVectorFormat()),
          "the packed vector and its format survive a journal round trip unchanged");
        // Rows journaled before vectorData and vectorFormat had short names are keyed by the long names.
        VectorEmbedding longKeys = (VectorEmbedding) parser.parseString(
          "{class:\\"foam.ai.vector.VectorEmbedding\\",id:\\"lk\\",embeddingModel:\\"m\\",vectorData:\\"" + r7.getVectorData()
          + "\\",vectorFormat:\\"" + r7.getVectorFormat() + "\\"}");
        test(longKeys != null && r7.getVectorData().equals(longKeys.getVectorData()) && r7.getVectorFormat().equals(longKeys.getVectorFormat()),
          "a journal row keyed by the long names vectorData and vectorFormat still reads");
        VectorEmbedding shortKeys = (VectorEmbedding) parser.parseString(
          "{class:\\"foam.ai.vector.VectorEmbedding\\",id:\\"sk\\",embeddingModel:\\"m\\",vd:\\"" + r7.getVectorData()
          + "\\",vf:\\"" + r7.getVectorFormat() + "\\"}");
        test(shortKeys != null && r7.getVectorData().equals(shortKeys.getVectorData()) && r7.getVectorFormat().equals(shortKeys.getVectorFormat()),
          "a journal row keyed by the short names vd and vf reads the same");

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

        VectorEmbedding badQ8 = new VectorEmbedding.Builder(x).setId("bad").setEmbeddingModel("m").setVectorData("not base64 !!").setVectorFormat("int8").build();
        boolean badRejected = false;
        try { dao.put(badQ8); } catch (IllegalArgumentException e) { badRejected = true; }
        test(badRejected && dao.find("bad") == null, "vectorData that is not base64 is rejected and not stored");

        MDAO withBad = new MDAO(VectorEmbedding.getOwnClassInfo());
        withBad.put(badQ8);   // a hand-edited journal row, bypassing VectorStoreDAO
        withBad.put(fx.emb("good", "m", "y", q));
        VectorStoreDAO tolerant = new VectorStoreDAO.Builder(x).setDelegate(withBad).build();
        got = fx.search(tolerant, q, "m", null, 0, 10);
        test(got.size() == 1 && "good".equals(got.get(0).getId()), "a malformed stored row is skipped instead of breaking every search");

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

        // ── a packed vector of the wrong length ───────────────────────────────
        VectorEmbedding shortFp16 = new VectorEmbedding.Builder(x).setId("short").setEmbeddingModel("m")
          .setVectorData(Base64.getEncoder().encodeToString(new byte[] { 0x3c, 0x00, 0x3c })).setVectorFormat("fp16").build();
        boolean shortRejected = false;
        try { dao.put(shortFp16); } catch (IllegalArgumentException e) { shortRejected = true; }
        test(shortRejected && dao.find("short") == null, "fp16 bytes that are not a whole number of dimensions are rejected and not stored");

        boolean zeroRejected = false;
        try { dao.put(fx.emb("zero", "m", "y", new float[16])); } catch (IllegalArgumentException e) { zeroRejected = true; }
        test(zeroRejected && dao.find("zero") == null, "an all-zero vector is rejected: it has no direction to compare");

        // ── updating a found row with a new vector ────────────────────────────
        VectorStoreDAO upd = fx.store();
        for ( int i = 0 ; i < 10 ; i++ ) upd.put(fx.emb("u" + i, "m", "y", fx.rand(16)));
        fx.search(upd, fx.rand(16), "m", null, 0, 1);
        float[] fresh = fx.rand(16);
        VectorEmbedding u3 = (VectorEmbedding) upd.find("u3").fclone();   // holds vectorData, no floats
        String oldData = u3.getVectorData();
        u3.setVector(fresh);
        upd.put(u3);
        VectorEmbedding storedU3 = (VectorEmbedding) upd.find("u3");
        got = fx.search(upd, fresh, "m", null, 0, 1);
        test(! oldData.equals(storedU3.getVectorData()) && storedU3.getVector().length == 0,
          "a found row given a new float vector is re-packed; the old bytes are not kept");
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

        // ── a row journaled as floats by an earlier version, re-put, then replayed ──
        // The journal writes only what changed and replay merges lines onto the row,
        // so the old floats must not survive next to the new packed bytes: they would
        // outrank them and the row would rank by its old embedding after every restart.
        String legacyFile = "vectorLegacyJournal" + System.currentTimeMillis();
        JDAO legacyJ = new JDAO();
        legacyJ.setX(x);
        legacyJ.setFilename(legacyFile);
        legacyJ.setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo()));
        float[] oldV = fx.rand(32);
        float[] newV = fx.rand(32);
        legacyJ.put(fx.emb("L1", "m", "y", oldV));                       // floats, as the earlier version wrote them
        new VectorStoreDAO.Builder(x).setDelegate(legacyJ).build().put(fx.emb("L1", "m", "y", newV));

        JDAO replayedJ = new JDAO();
        replayedJ.setX(x);
        replayedJ.setFilename(legacyFile);
        replayedJ.setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo()));
        VectorEmbedding replayedRow = (VectorEmbedding) replayedJ.find("L1");
        test(replayedRow != null && replayedRow.getVector().length == 0 && ! SafetyUtil.isEmpty(replayedRow.getVectorData()),
          "after a restart the re-put row holds only its packed vector; the old floats are gone");
        got = fx.search(new VectorStoreDAO.Builder(x).setDelegate(replayedJ).build(), newV, "m", null, 0, 1);
        test(got.size() == 1 && got.get(0).getScore() > 0.99f,
          "after a restart the row ranks by its new vector");

        // ── a large store (25,000 rows) ───────────────────────────────────────
        VectorStoreDAO big = fx.store();
        for ( int i = 0 ; i < 25000 ; i++ ) big.put(fx.emb("b" + i, "m", i % 100 == 0 ? "x" : "y", fx.rand(16)));
        float[] qb = fx.rand(16);
        test(fx.matchesBrute(fx.search(big, qb, "m", null, 0, 10), fx.rows(big), qb, "m", null, 0, 10), "a search over 25,000 rows equals an exact scan");
        test(fx.matchesBrute(fx.search(big, qb, "m", kindX, 0, 50), fx.rows(big), qb, "m", kindX, 0, 50), "a filtered search over 25,000 rows equals an exact scan");

        // ── configurable formats store non-normalised input as true cosine ──
        float[] qf = fx.rand(32);
        for ( Quantizer qz : new Quantizer[] { new Int8Quantizer(), new Fp16Quantizer(), new Float32Quantizer() } ) {
          VectorStoreDAO fmt = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo()))
            .setQuantizer(qz).build();
          Map<String, float[]> original = new HashMap<>();
          for ( int i = 0 ; i < 200 ; i++ ) {
            float[] v = fx.rand(32);
            float   m = (float) (0.1 + rnd.nextDouble() * 10);   // lengths 0.1 to 10: catches a format that skips normalisation
            for ( int j = 0 ; j < v.length ; j++ ) v[j] *= m;
            original.put("f" + i, v);
            fmt.put(fx.emb("f" + i, "m", "y", v));
          }
          String f = qz.formatId();
          test(f.equals(((VectorEmbedding) fmt.find("f7")).getVectorFormat()), f + ": rows are journaled in the configured format");
          got = fx.search(fmt, qf, "m", null, 0, 10);
          test(fx.matchesBrute(got, fx.rows(fmt), qf, "m", null, 0, 10), f + ": top 10 equals an exact scan of the stored vectors");
          double tol = qz instanceof Int8Quantizer ? 0.02 : ( qz instanceof Fp16Quantizer ? 0.002 : 1e-5 );
          boolean trueCosine = got.size() == 10;
          for ( VectorEmbedding h : got ) trueCosine = trueCosine && Math.abs(h.getScore() - fx.cosine(qf, original.get(h.getId()))) < tol;
          test(trueCosine, f + ": every score is the cosine of the original, unnormalised vector");
        }

        // ── changing the configured format keeps old rows readable ────────────
        MDAO shared = new MDAO(VectorEmbedding.getOwnClassInfo());
        VectorStoreDAO asFp16 = new VectorStoreDAO.Builder(x).setDelegate(shared)
          .setQuantizer(new Fp16Quantizer()).build();
        Map<String, float[]> sharedVectors = new HashMap<>();
        for ( int i = 0 ; i < 50 ; i++ ) {
          float[] v = fx.rand(32);
          sharedVectors.put("s" + i, v);
          asFp16.put(fx.emb("s" + i, "m", "y", v));
        }
        VectorStoreDAO asInt8 = new VectorStoreDAO.Builder(x).setDelegate(shared).setQuantizer(fx.int8()).build();
        boolean stillFound = true;
        for ( int i = 0 ; i < 50 ; i += 7 ) {
          List<VectorEmbedding> top = fx.search(asInt8, sharedVectors.get("s" + i), "m", null, 0, 1);
          stillFound = stillFound && top.size() == 1 && ("s" + i).equals(top.get(0).getId()) && top.get(0).getScore() > 0.99f;
        }
        test(stillFound, "after switching the configured format from fp16 to int8, fp16 rows are still found at the right rank");

        // ── the comparator decodes every format ───────────────────────────────
        List<VectorEmbedding> fp16Rows = fx.rows(asFp16);
        CosineComparator byQf = new CosineComparator.Builder(x).setQueryVector(qf).build();
        fp16Rows.sort((r1, r2) -> byQf.compare(r1, r2));
        List<VectorEmbedding> fp16Top = fx.search(asFp16, qf, "m", null, 0, 5);
        boolean sameOrder = fp16Top.size() == 5;
        for ( int i = 0 ; i < 5 && sameOrder ; i++ ) sameOrder = fp16Top.get(i).getId().equals(fp16Rows.get(i).getId());
        test(sameOrder, "sorting fp16 rows with CosineComparator gives the same order as the index search");

        // ── a custom quantizer, and a format nobody configured ────────────────
        Quantizer custom = new Float32Quantizer() {
          @Override public String formatId() { return "test-f32"; }
        };
        MDAO customRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        VectorStoreDAO withCustom = new VectorStoreDAO.Builder(x).setDelegate(customRows)
          .setQuantizer(custom).build();
        float[] cv = fx.rand(16);
        withCustom.put(fx.emb("c1", "m", "y", cv));
        got = fx.search(withCustom, cv, "m", null, 0, 1);
        test("test-f32".equals(((VectorEmbedding) customRows.find("c1")).getVectorFormat())
          && got.size() == 1 && "c1".equals(got.get(0).getId()) && got.get(0).getScore() > 0.9999f,
          "a custom quantizer set on the store stores and searches its own format");
        boolean unknownThrows = false;
        try { ((VectorEmbedding) customRows.find("c1")).floats(); } catch (IllegalArgumentException e) { unknownThrows = true; }
        test(unknownThrows, "outside its store, a row in a custom format reports an unknown format instead of a wrong vector");
        VectorStoreDAO noCustom = new VectorStoreDAO.Builder(x).setDelegate(customRows).build();
        expect(fx.search(noCustom, cv, "m", null, 0, 10).size(), 0, "a store that does not configure a format skips its rows on load");

        // ── a custom quantizer that throws on bad bytes cannot break a load ────
        Quantizer throwing = new Float32Quantizer() {
          @Override public String formatId() { return "test-throws"; }
          @Override public float[] decode(byte[] data) { throw new IllegalStateException("cannot read these bytes"); }
        };
        MDAO throwRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        throwRows.put(new VectorEmbedding.Builder(x).setId("bad").setEmbeddingModel("m")
          .setVectorData(Base64.getEncoder().encodeToString(new byte[] { 1, 2, 3, 4 })).setVectorFormat("test-throws").build());
        throwRows.put(fx.emb("good", "m", "y", cv));
        VectorStoreDAO withThrowing = new VectorStoreDAO.Builder(x).setDelegate(throwRows)
          .setQuantizer(throwing).build();
        got = fx.search(withThrowing, cv, "m", null, 0, 10);
        test(got.size() == 1 && "good".equals(got.get(0).getId()),
          "a row a custom quantizer cannot decode is skipped on load and the other rows stay searchable");
        boolean throwingRejected = false;
        try {
          withThrowing.put(new VectorEmbedding.Builder(x).setId("bad2").setEmbeddingModel("m")
            .setVectorData(Base64.getEncoder().encodeToString(new byte[] { 1, 2, 3, 4 })).setVectorFormat("test-throws").build());
        } catch (IllegalArgumentException e) { throwingRejected = true; }
        test(throwingRejected, "and a put of such a row is rejected with a plain validation error");

        // ── the framework default is float32; an app picks a lossy format ─────
        test("f32".equals(new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build().getQuantizer().formatId()), "a store with no quantizer set uses float32");
        VectorStoreDAO byDefault = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        float[] dv = fx.rand(64);
        for ( int i = 0 ; i < dv.length ; i++ ) dv[i] *= 3.7f;   // not unit length
        byDefault.put(fx.emb("d1", "m", "y", dv));
        VectorEmbedding d1Row = (VectorEmbedding) byDefault.find("d1");
        test("f32".equals(d1Row.getVectorFormat()) && d1Row.getVector().length == 0,
          "a store with no quantizer journals float32 and drops the floats");
        test(fx.cosine(dv, d1Row.floats()) > 0.999999, "float32 keeps the direction to float precision: " + fx.cosine(dv, d1Row.floats()));
        got = fx.search(byDefault, dv, "m", null, 0, 1);
        test(got.size() == 1 && Math.abs(got.get(0).getScore() - 1f) < 1e-5f, "and a search scores it as the true cosine, 1 against itself");

        // Rows an app journaled as int8 stay readable when the app is later opened with the default.
        MDAO sharedFormats = new MDAO(VectorEmbedding.getOwnClassInfo());
        VectorStoreDAO wroteInt8 = new VectorStoreDAO.Builder(x).setDelegate(sharedFormats).setQuantizer(fx.int8()).build();
        float[] i8v = fx.rand(32);
        wroteInt8.put(fx.emb("i8", "m", "y", i8v));
        VectorStoreDAO opensAsDefault = new VectorStoreDAO.Builder(x).setDelegate(sharedFormats).build();
        got = fx.search(opensAsDefault, i8v, "m", null, 0, 1);
        test(got.size() == 1 && "i8".equals(got.get(0).getId()) && got.get(0).getScore() > 0.99f,
          "int8 rows are found by a store whose default is float32");
        opensAsDefault.put(((VectorEmbedding) sharedFormats.find("i8")).fclone());
        test("f32".equals(((VectorEmbedding) sharedFormats.find("i8")).getVectorFormat()),
          "and are rewritten as float32 on their next put");

        // ── a packed row in another format is re-encoded on put ───────────────
        VectorStoreDAO int8Store = fx.store();
        VectorEmbedding fp16Row = new VectorEmbedding.Builder(x).setId("re").setEmbeddingModel("m")
          .setVectorData(Base64.getEncoder().encodeToString(new Fp16Quantizer().encode(VectorIndex.normalized(cv))))
          .setVectorFormat("fp16").build();
        int8Store.put(fp16Row);
        VectorEmbedding reStored = (VectorEmbedding) int8Store.find("re");
        test("int8".equals(reStored.getVectorFormat()) && fx.cosine(cv, reStored.floats()) > 0.999,
          "a row packed as fp16 and put into an int8 store is rewritten as int8");

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
          List<VectorEmbedding> top = fx.search(same, e.floats(), "m", null, 0, 1);
          latestVersion = latestVersion && top.size() == 1 && e.getId().equals(top.get(0).getId())
            && e.getVectorData().equals(top.get(0).getVectorData());
        }
        test(latestVersion, "for every id, the index holds the same version of the vector as the DAO");

        // ── blocks: a group grows and shrinks in bounded pieces ───────────────
        // 32 rows per block (see Fx.store), so block counts are exact.
        VectorStoreDAO blk = fx.store();
        fx.load(blk);
        VectorIndex bi = blk.getIndex();
        int[] bkSizes  = { 1, 31, 32, 33, 64, 65 };
        int[] bkBlocks = { 1,  1,  1,  2,  2,  3 };
        int   bkHave   = 0;
        for ( int t = 0 ; t < bkSizes.length ; t++ ) {
          while ( bkHave < bkSizes[t] ) {
            blk.put(fx.emb("bk" + bkHave, "m", "y", fx.rand(16)));
            bkHave++;
          }
          expect((long) bi.blockCount(), (long) bkBlocks[t], bkSizes[t] + " rows fill " + bkBlocks[t] + " block(s)");
        }
        float[] bq = fx.rand(16);
        test(fx.matchesBrute(fx.search(blk, bq, "m", null, 0, 70), fx.rows(blk), bq, "m", null, 0, 70),
          "a group of 65 rows over 3 blocks ranks exactly like a brute-force scan");

        // Removing a row of the first block moves the very last row (bk64, third block) into its slot.
        blk.remove(blk.find("bk3"));
        expect((long) bi.blockCount(), 2L, "the emptied third block is released");
        expect((long) bi.size(), 64L, "one row is gone");
        float[] movedV = ((VectorEmbedding) blk.find("bk64")).floats();
        got = fx.search(blk, movedV, "m", null, 0, 1);
        test(got.size() == 1 && "bk64".equals(got.get(0).getId()) && got.get(0).getScore() > 0.99f,
          "a row moved between blocks by a remove is still found at its new place");
        float[] freshV = fx.rand(16);
        blk.put(fx.emb("bk64", "m", "y", freshV));
        got = fx.search(blk, freshV, "m", null, 0, 1);
        test(got.size() == 1 && "bk64".equals(got.get(0).getId()) && got.get(0).getScore() > 0.99f,
          "the moved row can be updated in place");
        blk.remove(blk.find("bk64"));
        test(blk.find("bk64") == null && fx.search(blk, freshV, "m", null, 0, 100).size() == 63,
          "and removed");
        test(fx.matchesBrute(fx.search(blk, bq, "m", null, 0, 70), fx.rows(blk), bq, "m", null, 0, 70),
          "ranking is still exact after the removes");

        // A group gives memory back after most of its rows go.
        VectorStoreDAO shrink = fx.store();
        fx.load(shrink);
        for ( int i = 0 ; i < 5000 ; i++ ) shrink.put(fx.emb("s" + i, "m", "y", fx.rand(16)));
        long fullBytes  = shrink.getIndex().reservedBytes();
        int  fullBlocks = shrink.getIndex().blockCount();
        List<Integer> order = new ArrayList<>();
        for ( int i = 0 ; i < 5000 ; i++ ) order.add(i);
        Collections.shuffle(order, new Random(5));
        for ( int i = 0 ; i < 4990 ; i++ ) shrink.remove(shrink.find("s" + order.get(i)));
        expect((long) fullBlocks, 157L, "5,000 rows take 157 blocks of 32");
        expect((long) shrink.getIndex().blockCount(), 1L, "10 rows left after 4,990 removes take one block");
        test(shrink.getIndex().reservedBytes() < fullBytes / 50,
          "the index reserves a fiftieth of its peak after the removes: " + shrink.getIndex().reservedBytes() + " of " + fullBytes);
        float[] sq = fx.rand(16);
        test(fx.matchesBrute(fx.search(shrink, sq, "m", null, 0, 20), fx.rows(shrink), sq, "m", null, 0, 20),
          "the 10 rows left rank exactly");

        // A small group is small: the default 1 MiB block does not get reserved up front.
        VectorStoreDAO tiny = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        fx.load(tiny);
        for ( int i = 0 ; i < 10 ; i++ ) tiny.put(fx.emb("t" + i, "m", "y", fx.rand(16)));
        test(tiny.getIndex().reservedBytes() < 4096, "ten rows reserve a few hundred bytes, not a block: " + tiny.getIndex().reservedBytes());

        // Random puts, updates and removes agree with a plain map of what should be there.
        VectorStoreDAO fuzz = fx.store();
        fx.load(fuzz);
        Map<String, float[]> expected = new HashMap<>();
        Random fr = new Random(11);
        for ( int op = 0 ; op < 600 ; op++ ) {
          String id = "z" + fr.nextInt(120);
          if ( fr.nextInt(3) == 0 ) {
            FObject o = fuzz.find(id);
            if ( o != null ) fuzz.remove(o);
            expected.remove(id);
          } else {
            float[] v = fx.rand(16);
            fuzz.put(fx.emb(id, "m", "y", v));
            expected.put(id, v);
          }
        }
        expect((long) fuzz.getIndex().size(), (long) expected.size(), "after 600 random operations the index holds exactly the live ids");
        boolean fuzzOk = true;
        for ( Map.Entry<String, float[]> e : expected.entrySet() ) {
          List<VectorEmbedding> top = fx.search(fuzz, e.getValue(), "m", null, 0, 1);
          fuzzOk = fuzzOk && top.size() == 1 && e.getKey().equals(top.get(0).getId()) && top.get(0).getScore() > 0.99f;
        }
        test(fuzzOk, "every live id still ranks first for its own vector");
        for ( String id : expected.keySet() ) fuzz.remove(fuzz.find(id));
        test(fuzz.getIndex().groupCount() == 0 && fuzz.getIndex().blockCount() == 0 && fuzz.getIndex().size() == 0,
          "removing every row leaves no group and no block");
        fuzz.put(fx.emb("again", "m", "y", fx.rand(16)));
        expect((long) fuzz.getIndex().size(), 1L, "an emptied store takes rows again");

        // ── partitions: a search names its partition ──────────────────────────
        final VectorStoreDAO part = fx.partitioned();
        fx.load(part);
        for ( int i = 0 ; i < 90 ; i++ ) {
          VectorEmbedding pe = fx.emb("p" + i, "m", i % 3 == 0 ? "a" : i % 3 == 1 ? "b" : "c", fx.rand(16));
          if ( i % 2 == 0 ) pe.setSourceId("even");
          part.put(pe);
        }
        float[] pq = fx.rand(16);
        Predicate inA  = EQ(VectorEmbedding.KIND, "a");
        Predicate inAB = IN(VectorEmbedding.KIND, new String[] { "a", "b" });
        AllPartitions allKinds = new AllPartitions();
        allKinds.setArg1(VectorEmbedding.KIND);

        boolean noPartition = false;
        String  noPartMsg   = "";
        try { fx.search(part, pq, "m", null, 0, 5); } catch (UnsupportedOperationException e) { noPartition = true; noPartMsg = e.getMessage(); }
        test(noPartition && noPartMsg.indexOf("kind") >= 0, "a similarity search that names no partition is rejected, naming the property: " + noPartMsg);
        boolean otherFilter = false;
        try { fx.search(part, pq, "m", EQ(VectorEmbedding.SOURCE_ID, "even"), 0, 5); } catch (UnsupportedOperationException e) { otherFilter = true; }
        test(otherFilter, "a filter on some other property does not pick a partition");

        got = fx.search(part, pq, "m", inA, 0, 100);
        test(got.size() == 30 && fx.matchesBrute(got, fx.rows(part), pq, "m", inA, 0, 100),
          "EQ on the partition property scans only that partition and ranks exactly");
        got = fx.search(part, pq, "m", inAB, 0, 100);
        test(got.size() == 60 && fx.matchesBrute(got, fx.rows(part), pq, "m", inAB, 0, 100),
          "IN on the partition property merges its partitions into one exact ranking");
        got = fx.search(part, pq, "m", allKinds, 0, 100);
        test(got.size() == 90 && fx.matchesBrute(got, fx.rows(part), pq, "m", allKinds, 0, 100),
          "AllPartitions scans every partition");
        expect((long) fx.search(part, pq, "m", EQ(VectorEmbedding.KIND, "none"), 0, 10).size(), 0L,
          "a partition with no rows gives an empty page, not an error");
        Predicate aEven = AND(inA, EQ(VectorEmbedding.SOURCE_ID, "even"));
        got = fx.search(part, pq, "m", aEven, 0, 100);
        test(got.size() == 15 && fx.matchesBrute(got, fx.rows(part), pq, "m", aEven, 0, 100),
          "the partition is found inside an AND with other conditions, which still filter");
        test(fx.matchesBrute(fx.search(part, pq, "m", inA, 3, 4), fx.rows(part), pq, "m", inA, 3, 4),
          "skip and limit work within a partition");
        // With no predicate to help, only the named partition's rows come back from the index.
        expect((long) part.getIndex().search(pq, "m", new String[] { "a" }, null, 1000).size(), 30L,
          "the index scans only the partition it is asked for");
        expect((long) ((ArraySink) part.select(new ArraySink())).getArray().size(), 90L,
          "a plain select, with no similarity order, needs no partition");

        // A row whose partition value changes moves to the new partition.
        VectorEmbedding p0 = (VectorEmbedding) part.find("p0").fclone();
        float[] p0v = p0.floats();
        p0.setKind("c");
        part.put(p0);
        test(fx.search(part, p0v, "m", inA, 0, 100).size() == 29, "the row left its old partition");
        expect((long) part.getIndex().search(pq, "m", new String[] { "a" }, null, 1000).size(), 29L,
          "and the old partition's group no longer holds it");
        Set<String> everyId = new HashSet<>();
        for ( VectorIndex.Hit h : part.getIndex().search(pq, "m", null, null, 1000) ) everyId.add(h.row.getId());
        expect((long) everyId.size(), 90L, "and no partition holds a row twice: all 90 rows are found once");
        got = fx.search(part, p0v, "m", EQ(VectorEmbedding.KIND, "c"), 0, 1);
        test(got.size() == 1 && "p0".equals(got.get(0).getId()) && got.get(0).getScore() > 0.99f, "and ranks first in its new one");

        // Two models in one partition stay apart.
        part.put(fx.emb("m2a", "m2", "a", fx.rand(16)));
        got = fx.search(part, pq, "m", inA, 0, 100);
        boolean onlyM = got.size() == 29;
        for ( VectorEmbedding e : got ) onlyM = onlyM && "m".equals(e.getEmbeddingModel());
        test(onlyM, "a search of one model skips the other model's rows in the same partition");
        got = fx.search(part, pq, "m2", inA, 0, 100);
        test(got.size() == 1 && "m2a".equals(got.get(0).getId()), "and the other model finds its own");

        // A partition's group goes when its last row does.
        int groupsBefore = part.getIndex().groupCount();
        part.put(fx.emb("lone", "m", "d", fx.rand(16)));
        expect((long) part.getIndex().groupCount(), (long) groupsBefore + 1, "a new partition value adds a group");
        part.remove(part.find("lone"));
        expect((long) part.getIndex().groupCount(), (long) groupsBefore, "the group goes with its last row");

        // Concurrent writers and searchers on a partitioned store.
        final VectorStoreDAO cp = fx.partitioned();
        fx.load(cp);
        ExecutorService cpPool = Executors.newFixedThreadPool(8);
        List<Future<?>> cpFutures = new ArrayList<>();
        for ( int t = 0 ; t < 4 ; t++ ) {
          final int tt = t;
          cpFutures.add(cpPool.submit(() -> { for ( int i = 0 ; i < 200 ; i++ ) cp.put(fx.emb("cp" + tt + "-" + i, "m", i % 2 == 0 ? "a" : "b", fx.rand(16))); }));
          cpFutures.add(cpPool.submit(() -> { for ( int i = 0 ; i < 60 ; i++ ) fx.search(cp, fx.rand(16), "m", EQ(VectorEmbedding.KIND, "a"), 0, 10); }));
        }
        boolean cpOk = true;
        for ( Future<?> f : cpFutures ) {
          try { f.get(); } catch (Exception e) { cpOk = false; }
        }
        cpPool.shutdown();
        test(cpOk, "4 writers and 4 searchers on a partitioned store run together without errors");
        expect((long) cp.getIndex().size(), 800L, "the partitioned index holds every row written");
        expect((long) fx.search(cp, fx.rand(16), "m", EQ(VectorEmbedding.KIND, "a"), 0, 1000).size(), 400L,
          "and the partition holds its half");

        // The delegate's read check and the deepening still work inside a partition.
        MDAO gRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        DAO  gDao  = new ProxyDAO(x, gRows) {
          @Override
          public FObject find_(X x, Object id) {
            return String.valueOf(id).startsWith("hid") ? null : super.find_(x, id);
          }
        };
        VectorStoreDAO gStore = new VectorStoreDAO.Builder(x).setDelegate(gDao).setBlockBytes(512)
          .setPartitionProperty(VectorEmbedding.KIND).build();
        float[] gq = fx.rand(16);
        for ( int i = 0 ; i < 20 ; i++ ) {
          float[] hv = gq.clone();
          hv[i % 16] += 0.01f;
          gStore.put(fx.emb("hid" + i, "m", "a", hv));
        }
        for ( int i = 0 ; i < 30 ; i++ ) gStore.put(fx.emb("ok" + i, "m", "a", fx.rand(16)));
        for ( int i = 0 ; i < 5 ; i++ ) gStore.put(fx.emb("other" + i, "m", "b", gq));
        got = fx.search(gStore, gq, "m", inA, 0, 5);
        List<VectorEmbedding> okRows = new ArrayList<>();
        for ( VectorEmbedding e : fx.rows(gStore) ) if ( e.getId().startsWith("ok") ) okRows.add(e);
        test(fx.matchesBrute(got, okRows, gq, "m", inA, 0, 5),
          "a partitioned search drops rows the delegate hides and fills the page from the same partition");

        // ── partition edge cases: where the partition is read, when the error comes, bad rows ──
        // A rule or decorator below the store may change the partition property on a put. The row
        // must be filed under the value that was stored, or a search of that value cannot find it.
        DAO rewriting = new ProxyDAO(x, new MDAO(VectorEmbedding.getOwnClassInfo())) {
          @Override
          public FObject put_(X x, FObject obj) {
            VectorEmbedding changed = (VectorEmbedding) obj.fclone();
            changed.setKind("moved");
            return super.put_(x, changed);
          }
        };
        VectorStoreDAO rw = new VectorStoreDAO.Builder(x).setDelegate(rewriting).setBlockBytes(512)
          .setPartitionProperty(VectorEmbedding.KIND).build();
        fx.load(rw);
        float[] rwv = fx.rand(16);
        rw.put(fx.emb("rw1", "m", "sent", rwv));
        got = fx.search(rw, rwv, "m", EQ(VectorEmbedding.KIND, "moved"), 0, 5);
        test(got.size() == 1 && "rw1".equals(got.get(0).getId()),
          "a row is filed under the partition value the delegate stored, so a search of it finds the row");
        expect((long) fx.search(rw, rwv, "m", EQ(VectorEmbedding.KIND, "sent"), 0, 5).size(), 0L,
          "and not under the value it was sent with");

        // A search that names no partition is rejected before the index loads.
        MDAO coldKindRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        coldKindRows.put(fx.emb("ck0", "m", "a", fx.rand(16)));
        VectorStoreDAO coldKind = new VectorStoreDAO.Builder(x).setDelegate(coldKindRows).setBlockBytes(512)
          .setPartitionProperty(VectorEmbedding.KIND).build();
        boolean coldRejected = false;
        try { fx.search(coldKind, fx.rand(16), "m", null, 0, 5); } catch (UnsupportedOperationException e) { coldRejected = true; }
        test(coldRejected && ! coldKind.getIndex().isLoaded(), "a search that names no partition is rejected before the index loads");
        got = fx.search(coldKind, fx.rand(16), "m", EQ(VectorEmbedding.KIND, "a"), 0, 5);
        test(got.size() == 1 && coldKind.getIndex().isLoaded(), "and a search that names one loads it and finds the row");

        // Filters that do not name a partition, and the ones that name every partition.
        boolean orRejected = false;
        try { fx.search(part, pq, "m", OR(inA, EQ(VectorEmbedding.KIND, "b")), 0, 5); } catch (UnsupportedOperationException e) { orRejected = true; }
        test(orRejected, "an OR of partition values is rejected: it is not an EQ or IN the search can route by");
        boolean notRejected = false;
        try { fx.search(part, pq, "m", NOT(inA), 0, 5); } catch (UnsupportedOperationException e) { notRejected = true; }
        test(notRejected, "a NOT of a partition value is rejected");
        Predicate allAndA = AND(allKinds, inA);
        got = fx.search(part, pq, "m", allAndA, 0, 100);
        test(got.size() > 0 && fx.matchesBrute(got, fx.rows(part), pq, "m", allAndA, 0, 100),
          "AllPartitions visits every partition and the EQ beside it still filters each row");
        expect((long) fx.search(part, pq, "m", IN(VectorEmbedding.KIND, new String[0]), 0, 10).size(), 0L,
          "an IN with no values finds nothing instead of failing as if no partition were named");
        got = fx.search(part, pq, "m", IN(VectorEmbedding.KIND, new ArrayList<Object>(Arrays.asList("a", "b"))), 0, 100);
        test(got.size() == 59, "IN given a List names its partitions like one given an array");

        // A partition value of "" (an unset String) is a partition like any other.
        VectorStoreDAO bySource = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo()))
          .setBlockBytes(512).setPartitionProperty(VectorEmbedding.SOURCE_ID).build();
        fx.load(bySource);
        for ( int i = 0 ; i < 6 ; i++ ) bySource.put(fx.emb("e" + i, "m", "y", fx.rand(16)));
        for ( int i = 0 ; i < 4 ; i++ ) {
          VectorEmbedding withSource = fx.emb("d" + i, "m", "y", fx.rand(16));
          withSource.setSourceId("doc1");
          bySource.put(withSource);
        }
        expect((long) fx.search(bySource, pq, "m", EQ(VectorEmbedding.SOURCE_ID, ""), 0, 100).size(), 6L,
          "rows with no value for the partition property sit in the partition named by the empty string");
        expect((long) fx.search(bySource, pq, "m", EQ(VectorEmbedding.SOURCE_ID, "doc1"), 0, 100).size(), 4L,
          "and are not mixed with the others");

        // A store opened over rows that are already in its delegate (a restart) loads them by partition.
        VectorStoreDAO restarted = new VectorStoreDAO.Builder(x).setDelegate(part.getDelegate()).setBlockBytes(512)
          .setQuantizer(fx.int8()).setPartitionProperty(VectorEmbedding.KIND).build();
        got = fx.search(restarted, pq, "m", inAB, 0, 100);
        test(got.size() > 0 && fx.matchesBrute(got, fx.rows(restarted), pq, "m", inAB, 0, 100),
          "a store loaded from rows already in its delegate ranks each partition exactly");

        // One row whose vector cannot be indexed must not stop the rest of a load.
        Quantizer encodeThrows = new Float32Quantizer() {
          @Override public String formatId() { return "test-encode-throws"; }
          @Override public byte[] encode(float[] v) {
            // encode gets the unit vector: the poison row (first component 99) is about 0.999 here.
            if ( v[0] > 0.9f ) throw new IllegalStateException("cannot encode this vector");
            return super.encode(v);
          }
        };
        MDAO encRows = new MDAO(VectorEmbedding.getOwnClassInfo());
        float[] poison = fx.rand(16);
        poison[0] = 99f;
        encRows.put(fx.emb("poison", "m", "y", poison));      // stored as floats, so the load encodes it
        encRows.put(fx.emb("fine", "m", "y", cv));
        VectorStoreDAO withEncodeThrows = new VectorStoreDAO.Builder(x).setDelegate(encRows)
          .setQuantizer(encodeThrows).build();
        got = fx.search(withEncodeThrows, cv, "m", null, 0, 10);
        test(got.size() == 1 && "fine".equals(got.get(0).getId()),
          "a row whose encoding throws is skipped on load and the other rows stay searchable");
      `
    }
  ]
});
