/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.test',
  name: 'VectorStoreDAOTest',
  extends: 'foam.core.test.Test',

  documentation: `
    VectorStoreDAO search: a row below the comparator's minScore never reaches
    the predicate, limit counts only the rows the predicate keeps so the nearest
    rejected row does not use one up, a query of another vector length is
    answered from the rows of that length, and removeAll takes every row out of
    the search.
  `,

  javaImports: [
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorStoreDAO',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.mlang.predicate.AbstractPredicate',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO store = new VectorStoreDAO.Builder(x).setDelegate(new MDAO(VectorEmbedding.getOwnClassInfo())).build();
        // against the query (1, 0) these 2-number rows score 1, 0.8, 0.5 and 0
        store.put(row("best",  1f,   0f));
        store.put(row("close", 0.8f, 0.6f));
        store.put(row("mid",   0.5f, 0.866f));
        store.put(row("far",   0f,   1f));

        // minScore: a row below it never reaches the predicate
        List<String> asked = new ArrayList<>();
        List<String> found = search(store, asked, 0.6f, 0, 0, "best", "close", "mid", "far");
        test(found.equals(List.of("best", "close")), "minScore 0.6 returns the rows scoring 1 and 0.8, got " + found);
        test(asked.equals(List.of("best", "close")), "minScore 0.6 asks the predicate about those two rows only, got " + asked);
        asked.clear();
        search(store, asked, -1f, 0, 0, "best", "close", "mid", "far");
        test(asked.size() == 4, "The default minScore -1 asks about every row, got " + asked);

        // limit counts rows the predicate keeps: "best" is rejected and does not use up the limit of 1
        asked.clear();
        found = search(store, asked, -1f, 0, 1, "close", "mid");
        test(found.equals(List.of("close")), "The nearest rejected row does not use up the limit, got " + found);
        test(asked.equals(List.of("best", "close")), "The search stops asking once the limit is met, got " + asked);

        // skip counts the rows the predicate keeps, as limit does: "best" is rejected, so skipping 1 of
        // close, mid and far skips "close" and the limit of 1 then takes "mid"
        found = search(store, new ArrayList<>(), -1f, 1, 1, "close", "mid", "far");
        test(found.equals(List.of("mid")), "skip 1 and limit 1 skip and take rows the predicate keeps, got " + found);
        found = search(store, new ArrayList<>(), -1f, 1, 2, "best", "close", "mid", "far");
        test(found.equals(List.of("close", "mid")), "skip 1 and limit 2 return the 2nd and 3rd nearest, got " + found);

        // a score equal to minScore is kept; one below it is not
        found = search(store, new ArrayList<>(), 0f, 0, 0, "best", "close", "mid", "far");
        test(found.equals(List.of("best", "close", "mid", "far")), "minScore 0 keeps the row scoring exactly 0, got " + found);
        found = search(store, new ArrayList<>(), 0.0001f, 0, 0, "best", "close", "mid", "far");
        test(! found.contains("far"), "minScore 0.0001 leaves out the row scoring 0, got " + found);

        // no predicate, and a predicate that keeps everything, rank the same rows
        test(ids(store, new float[] { 1f, 0f }).equals(List.of("best", "close", "mid", "far")), "No predicate returns every row nearest first");
        found = idsOf((ArraySink) store.where(foam.mlang.MLang.TRUE)
          .orderBy(new CosineComparator.Builder(getX()).setQueryVector(new float[] { 1f, 0f }).build()).select(new ArraySink()));
        test(found.equals(List.of("best", "close", "mid", "far")), "MLang.TRUE returns every row nearest first, got " + found);

        // another vector length: a 3-number row is searched by a 3-number query only
        store.put(row("three", 1f, 0f, 0f));
        found = search(store, new ArrayList<>(), -1f, 0, 0, "three", "best", "close", "mid", "far");
        test(found.equals(List.of("best", "close", "mid", "far")), "A 2-number query after a 3-number row ranks the 2-number rows, got " + found);
        found = ids(store, new float[] { 1f, 0f, 0f });
        test(found.equals(List.of("three")), "A 3-number query reads only the 3-number row, got " + found);
        found = ids(store, new float[] { 1f, 0f });
        test(found.size() == 4 && ! found.contains("three"), "A 2-number query never reads the 3-number row, got " + found);

        // removeAll: the removed rows no longer come back
        test(ids(store, new float[] { 1f, 0f }).size() == 4, "The 2-number rows are in the search before removeAll");
        store.removeAll();
        test(ids(store, new float[] { 1f, 0f }).isEmpty(), "No 2-number row comes back after removeAll");
        test(ids(store, new float[] { 1f, 0f, 0f }).isEmpty(), "No 3-number row comes back after removeAll");
        store.put(row("again", 1f, 0f));
        test(ids(store, new float[] { 1f, 0f }).equals(List.of("again")), "A row put after removeAll is found");
      `
    },
    {
      name: 'row',
      documentation: 'A stored row whose id is id and whose vector is v.',
      type: 'foam.ai.vector.VectorEmbedding',
      args: 'String id, float... v',
      javaCode: `
        VectorEmbedding e = new VectorEmbedding();
        e.setId(id);
        e.setEmbeddingModel("fake");
        e.setVector(v);
        return e;
      `
    },
    {
      name: 'search',
      documentation: `The ids a search against (1, 0) returns, nearest first, among the rows named in keep.
        Every row the predicate is asked about is added to asked, in the order it is asked.`,
      type: 'java.util.List<String>',
      args: 'DAO store, List<String> asked, float minScore, long skip, long limit, String... keep',
      javaCode: `
        List<String> kept = List.of(keep);
        var predicate = new AbstractPredicate(getX()) {
          public boolean f(Object o) {
            String id = ((VectorEmbedding) o).getId();
            asked.add(id);
            return kept.contains(id);
          }
        };
        DAO dao = store.where(predicate)
          .orderBy(new CosineComparator.Builder(getX()).setQueryVector(new float[] { 1f, 0f }).setMinScore(minScore).build());
        if ( skip > 0 ) dao = dao.skip(skip);
        if ( limit > 0 ) dao = dao.limit(limit);
        return idsOf((ArraySink) dao.select(new ArraySink()));
      `
    },
    {
      name: 'ids',
      documentation: 'The ids a search for q returns, nearest first, with no predicate and no minScore.',
      type: 'java.util.List<String>',
      args: 'DAO store, float[] q',
      javaCode: `
        return idsOf((ArraySink) store.orderBy(new CosineComparator.Builder(getX()).setQueryVector(q).build()).select(new ArraySink()));
      `
    },
    {
      name: 'idsOf',
      type: 'java.util.List<String>',
      args: 'ArraySink sink',
      javaCode: `
        List<String> out = new ArrayList<>();
        for ( Object o : sink.getArray() ) out.add(((VectorEmbedding) o).getId());
        return out;
      `
    }
  ]
});
