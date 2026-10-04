/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'BulkLoadCommandTest',
  extends: 'foam.core.test.Test',

  documentation: `A bulk load sent down cmd_ has to leave the DAO holding what the
    same rows put one at a time would have left it holding. The two are built side
    by side here rather than against fixed values, so nothing is hard-coded.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.dao.ArraySink',
    'foam.dao.BulkLoadCommand',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.SequenceNumberDAO',
    'foam.lang.FObject',
    'java.util.ArrayList',
    'java.util.List',
    'static foam.mlang.MLang.EQ'
  ],

  methods: [
    {
      name: 'chain',
      args: 'X x',
      javaType: 'foam.dao.DAO',
      documentation: 'What EasyDAO builds for seqNo: a SequenceNumberDAO over an MDAO.',
      javaCode: `
        return new SequenceNumberDAO.Builder(x)
          .setDelegate(new MDAO(User.getOwnClassInfo()))
          .build();
      `
    },

    {
      name: 'rows',
      args: 'X x, int n',
      javaType: 'foam.lang.FObject[]',
      documentation: 'Rows with no id, the way a transform hands them over.',
      javaCode: `
        FObject[] a = new FObject[n];
        for ( int i = 0 ; i < n ; i++ ) {
          a[i] = new User.Builder(x).setFirstName("row" + i).build();
        }
        return a;
      `
    },

    {
      name: 'summary',
      args: 'X x, DAO dao',
      javaType: 'String',
      documentation: 'Every row as id:firstName, in id order, so two DAOs compare as one string.',
      javaCode: `
        List<String> parts = new ArrayList<>();
        for ( Object o : ((ArraySink) dao.select(new ArraySink())).getArray() ) {
          User u = (User) o;
          parts.add(u.getId() + ":" + u.getFirstName());
        }
        java.util.Collections.sort(parts);
        return String.join(",", parts);
      `
    },

    {
      name: 'runTest',
      javaCode: `
        // ---- the load lands, numbered, and reads as the per-row version -----
        DAO perRow = chain(x);
        for ( FObject row : rows(x, 5) ) perRow.put(row);

        DAO     bulk = chain(x);
        Object  ran  = bulk.cmd(new BulkLoadCommand.Builder(x).setRows(rows(x, 5)).build());

        test(Boolean.TRUE.equals(ran), "an empty DAO takes the load, got " + ran);
        test(summary(x, bulk).equals(summary(x, perRow)),
          "bulk load reads as the per-row puts; per-row " + summary(x, perRow)
            + " and bulk " + summary(x, bulk));

        // ---- the sequence carries on where the load left off ---------------
        User next = (User) bulk.put(new User.Builder(x).setFirstName("after").build());
        test(next.getId() == 6, "a put after the load continues the sequence, got " + next.getId());

        // ---- a DAO that already holds rows says so --------------------------
        Object again = bulk.cmd(new BulkLoadCommand.Builder(x).setRows(rows(x, 2)).build());
        test(Boolean.FALSE.equals(again), "a DAO holding rows declines the load, got " + again);
        test(((ArraySink) bulk.select(new ArraySink())).getArray().size() == 6,
          "the declined load left the rows alone");

        // ---- an id the caller set is kept, and the sequence moves past it ---
        DAO keyed = chain(x);
        keyed.cmd(new BulkLoadCommand.Builder(x)
          .setRows(new FObject[] { new User.Builder(x).setId(40).setFirstName("forty").build() })
          .build());
        test(keyed.find(40L) != null, "a row that arrived with an id keeps it");
        test(((User) keyed.put(new User.Builder(x).setFirstName("forty one").build())).getId() == 41,
          "the sequence resumes above the id that arrived");

        // ---- an empty load leaves a DAO that still takes puts ---------------
        DAO empty = chain(x);
        test(Boolean.TRUE.equals(empty.cmd(new BulkLoadCommand.Builder(x).setRows(new FObject[0]).build())),
          "an empty load is accepted");
        test(((User) empty.put(new User.Builder(x).setFirstName("first").build())).getId() == 1,
          "and numbering starts from the beginning");

        // ---- the index answers a query over a loaded row --------------------
        test(((ArraySink) bulk.where(EQ(User.FIRST_NAME, "row3")).select(new ArraySink())).getArray().size() == 1,
          "a query finds a row the load put there");
      `
    }
  ]
});
