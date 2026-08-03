/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'MDAOIndexDedupTest',
  extends: 'foam.core.test.Test',

  documentation: `Adding the same property index twice must not build a second index.

    A duplicate is permanent and expensive: adding an index bulk-loads the whole
    DAO into it, there is no removeIndex to undo it, and every subsequent put then
    maintains both copies. Callers that cannot know whether an index already
    exists depend on the second add being a no-op.`,

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

        MDAO dao = new MDAO(Country.getOwnClassInfo());
        test(dao.getIndexCount() == 0, "A new MDAO reports no added indexes (was " + dao.getIndexCount() + ")");

        dao.addIndex(iso3);
        test(dao.getIndexCount() == 1, "First addIndex adds one (was " + dao.getIndexCount() + ")");

        dao.addIndex(iso3);
        test(dao.getIndexCount() == 1, "Repeating the same addIndex adds nothing (was " + dao.getIndexCount() + ")");

        // A different property is a different index, not a duplicate.
        dao.addIndex(name);
        test(dao.getIndexCount() == 2, "A different property still adds (was " + dao.getIndexCount() + ")");

        // Unique and non-unique indexes over the same property are different
        // structures, so they must not collapse into one another.
        MDAO uniq = new MDAO(Country.getOwnClassInfo());
        uniq.addIndex(iso3);
        uniq.addUniqueIndex(iso3);
        test(uniq.getIndexCount() == 2, "Unique and non-unique on one property are distinct (was " + uniq.getIndexCount() + ")");

        uniq.addUniqueIndex(iso3);
        test(uniq.getIndexCount() == 2, "Repeating addUniqueIndex adds nothing (was " + uniq.getIndexCount() + ")");

        // Order matters in a compound index, so the two orderings are distinct.
        MDAO comp = new MDAO(Country.getOwnClassInfo());
        comp.addIndex(iso3, name);
        comp.addIndex(name, iso3);
        test(comp.getIndexCount() == 2, "Compound indexes differing only in order are distinct (was " + comp.getIndexCount() + ")");

        comp.addIndex(iso3, name);
        test(comp.getIndexCount() == 2, "Repeating a compound addIndex adds nothing (was " + comp.getIndexCount() + ")");

        // (a) after (a, b) is redundant: planSelect takes the cheapest plan from
        // any index, and the compound already answers lookups on its leading
        // property.
        MDAO prefix = new MDAO(Country.getOwnClassInfo());
        prefix.addIndex(iso3, name);
        prefix.addIndex(iso3);
        test(prefix.getIndexCount() == 1, "A leading-column index is covered by an existing compound (was " + prefix.getIndexCount() + ")");

        // The reverse is not redundant - the compound orders within each group.
        MDAO widen = new MDAO(Country.getOwnClassInfo());
        widen.addIndex(iso3);
        widen.addIndex(iso3, name);
        test(widen.getIndexCount() == 2, "Widening an existing index to a compound still adds (was " + widen.getIndexCount() + ")");

        // Prefix matching is per name, not per character - "name" must not be
        // treated as covered by an index led by a longer name starting the same.
        MDAO distinct = new MDAO(Country.getOwnClassInfo());
        distinct.addIndex(name, iso3);
        distinct.addIndex(iso3);
        test(distinct.getIndexCount() == 2, "A non-leading property is not covered (was " + distinct.getIndexCount() + ")");

        // Unique and non-unique are separate key spaces, so no prefix crosstalk.
        MDAO mixed = new MDAO(Country.getOwnClassInfo());
        mixed.addUniqueIndex(iso3, name);
        mixed.addIndex(iso3);
        test(mixed.getIndexCount() == 2, "A non-unique index is not covered by a unique compound (was " + mixed.getIndexCount() + ")");
      `
    }
  ]
});
