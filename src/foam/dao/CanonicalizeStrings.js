/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'CanonicalizeStrings',
  implements: [ 'foam.lang.ContextAgent' ],

  documentation: `
    The pass a replay hands to the thread pool once it completes. StringInterner
    interns a value on its second sight, so every record parsed before that --
    and every record parsed after the value was evicted from the cache -- holds
    its own raw copy of a string that now has a canonical in the JVM table.
    This walks the in-memory store once, and for each record whose String
    properties hold such a copy, clones it, swaps in the canonical, and replaces
    the stored object through MDAO.swap_, which refuses if a put landed in
    between. Nothing is written to the journal: the value is unchanged, only
    the instance. Values with no canonical -- the ones that never repeated --
    are never touched, so the JVM table does not grow.
  `,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.dao.AbstractSink',
    'foam.dao.ProxyDAO',
    'foam.lang.AbstractStringPropertyInfo',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'java.util.ArrayList',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map'
  ],

  properties: [
    {
      documentation: 'The DAO the replay wrote into; unwrapped through ProxyDAO delegates to the MDAO underneath.',
      class: 'foam.dao.DAOProperty',
      name: 'dao'
    },
    {
      documentation: 'The canonicals the replay interner created: the only values a stored copy can be swapped to.',
      class: 'Object',
      name: 'canonicals',
      javaType: 'java.util.List<String>'
    },
    {
      class: 'String',
      name: 'journalName'
    }
  ],

  methods: [
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        long t0 = System.currentTimeMillis();

        DAO d = getDao();
        while ( d instanceof ProxyDAO && ! ( d instanceof MDAO ) ) d = ((ProxyDAO) d).getDelegate();
        if ( ! ( d instanceof MDAO ) ) {
          Loggers.logger(x, this).info("Canonicalize", getJournalName(), "skipped: no MDAO under", getDao().getClass().getName());
          return;
        }
        final MDAO mdao = (MDAO) d;

        final Map<String, String> canon = new HashMap<>(getCanonicals().size() * 2);
        for ( String c : getCanonicals() ) canon.put(c, c);

        final List<PropertyInfo> props = new ArrayList<>();
        for ( Object o : mdao.getOf().getAxiomsByClass(PropertyInfo.class) ) {
          if ( o instanceof AbstractStringPropertyInfo ) props.add((PropertyInfo) o);
        }

        final long[] n = new long[4];   // records, records swapped, strings swapped, swaps refused
        mdao.select_(x, new AbstractSink() {
          public void put(Object o, Detachable sub) {
            FObject rec   = (FObject) o;
            FObject clone = null;
            n[0]++;
            for ( PropertyInfo p : props ) {
              Object v = p.get(rec);
              if ( ! ( v instanceof String ) ) continue;
              String c = canon.get(v);
              if ( c == null || c == v ) continue;
              if ( clone == null ) clone = rec.fclone();
              p.set(clone, c);
              n[2]++;
            }
            if ( clone == null ) return;
            if ( mdao.swap_(x, rec, clone) ) n[1]++; else n[3]++;
          }
        }, 0, AbstractDAO.MAX_SAFE_INTEGER, null, null);

        Loggers.logger(x, this).info("Canonicalize", getJournalName(),
          "records", n[0], "swapped", n[1], "strings", n[2], "refused", n[3],
          "canonicals", canon.size(), "ms", System.currentTimeMillis() - t0);
      `
    }
  ]
});
