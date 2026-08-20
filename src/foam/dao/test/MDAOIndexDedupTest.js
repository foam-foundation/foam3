/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'MDAOIndexDedupTest',
  extends: 'foam.core.test.Test',

  documentation: `An index already covered by an existing one must not be added.

    Adding an index bulk-loads the whole DAO into it, every later put maintains
    it, and there is no removeIndex to undo either cost - so a caller that
    cannot know what already exists depends on the add being a no-op.

    Covered means prefix, not equal: planSelect asks every index to plan and
    keeps the cheapest, so a compound index on (a, b) already answers lookups
    on a through its leading level.`,

  javaImports: [
    'foam.core.auth.Country',
    'foam.dao.MDAO',
    'foam.lang.PropertyInfo'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        PropertyInfo iso3 = (PropertyInfo) Country.getOwnClassInfo().getAxiomByName("iso31661Code");
        PropertyInfo name = (PropertyInfo) Country.getOwnClassInfo().getAxiomByName("name");

        // A new MDAO already holds the primary index on id.
        MDAO dao = new MDAO(Country.getOwnClassInfo());
        int base = dao.getIndexCount();
        test(base == 1, "A new MDAO holds one index, the primary (was " + base + ")");

        dao.addIndex(iso3);
        test(dao.getIndexCount() == base + 1, "First addIndex adds one (was " + dao.getIndexCount() + ")");

        dao.addIndex(iso3);
        test(dao.getIndexCount() == base + 1, "Repeating the same addIndex adds nothing (was " + dao.getIndexCount() + ")");

        // A different property is a different index, not a duplicate.
        dao.addIndex(name);
        test(dao.getIndexCount() == base + 2, "A different property still adds (was " + dao.getIndexCount() + ")");

        // The primary index must not swallow a property index.
        MDAO pk = new MDAO(Country.getOwnClassInfo());
        pk.addIndex(name);
        test(pk.getIndexCount() == 2, "The primary index does not cover a property index (was " + pk.getIndexCount() + ")");

        // (a) after (a, b) is redundant - the compound answers lookups on a
        // through its leading level.
        MDAO prefix = new MDAO(Country.getOwnClassInfo());
        prefix.addIndex(iso3, name);
        int afterCompound = prefix.getIndexCount();
        prefix.addIndex(iso3);
        test(prefix.getIndexCount() == afterCompound,
          "A leading-column index is covered by an existing compound (was " + prefix.getIndexCount() + ")");

        // The reverse is not redundant - the compound orders within each group.
        MDAO widen = new MDAO(Country.getOwnClassInfo());
        widen.addIndex(iso3);
        int afterSingle = widen.getIndexCount();
        widen.addIndex(iso3, name);
        test(widen.getIndexCount() == afterSingle + 1,
          "Widening an existing index to a compound still adds (was " + widen.getIndexCount() + ")");

        // Order matters in a compound index, so the two orderings are distinct.
        MDAO comp = new MDAO(Country.getOwnClassInfo());
        comp.addIndex(iso3, name);
        comp.addIndex(name, iso3);
        test(comp.getIndexCount() == base + 2, "Compound indexes differing only in order are distinct (was " + comp.getIndexCount() + ")");

        comp.addIndex(iso3, name);
        test(comp.getIndexCount() == base + 2, "Repeating a compound addIndex adds nothing (was " + comp.getIndexCount() + ")");

        // A non-leading property is not covered by a compound led by another.
        MDAO distinct = new MDAO(Country.getOwnClassInfo());
        distinct.addIndex(name, iso3);
        distinct.addIndex(iso3);
        test(distinct.getIndexCount() == base + 2, "A non-leading property is not covered (was " + distinct.getIndexCount() + ")");

        // Repeating a unique index is still a no-op.
        MDAO uniq = new MDAO(Country.getOwnClassInfo());
        uniq.addUniqueIndex(iso3);
        int afterUnique = uniq.getIndexCount();
        uniq.addUniqueIndex(iso3);
        test(uniq.getIndexCount() == afterUnique, "Repeating addUniqueIndex adds nothing (was " + uniq.getIndexCount() + ")");
      `
    }
  ]
});
