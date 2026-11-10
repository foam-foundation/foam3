/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'VectorStoreDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorIndex',
    'foam.core.logger.Loggers',
    'foam.dao.AbstractDAO',
    'foam.dao.AbstractSink',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'java.util.ArrayList',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map'
  ],

  documentation: `
    Adds similarity search to a DAO of VectorEmbeddings. A select ordered by a
    CosineComparator is answered from an in-memory VectorIndex: an exact scan of
    the rows that match the query's model, dimension count and predicate,
    returning the best rows first with their score set. Every other operation
    passes through to the delegate.

    The index loads from the delegate on the first search and is then kept in
    step by put_ and remove_ (removeAll_ reloads it on next use), so a write never
    forces a rebuild. Each hit is read back through the delegate in the caller's
    context, so whatever authorization sits in the delegate chain below this DAO
    decides which rows a caller may see.

    Rows keep their vector as the floats the embedding service returned; the index
    holds its own normalised copy.
  `,

  properties: [
    {
      class: 'Object',
      name: 'index',
      javaType: 'VectorIndex',
      documentation: 'Built once, on first use.',
      javaFactory: 'return new VectorIndex();',
      // Two first callers must get the same index, or they lock different objects.
      synchronized: true,
      transient: true,
      hidden: true
    }
  ],

  methods: [
    {
      name: 'ensureLoaded_',
      documentation: `Load every row of the delegate into the index once. It runs in
        the DAO's own context, not the caller's, because the index is shared by all
        callers and must hold every row.`,
      javaCode: `
        VectorIndex index = getIndex();
        if ( index.isLoaded() ) return;
        synchronized ( index ) {
          if ( index.isLoaded() ) return;
          index.clear();
          getDelegate().select_(getX(), new AbstractSink() {
            @Override
            public void put(Object obj, Detachable sub) {
              VectorEmbedding row = (VectorEmbedding) obj;
              // One bad row must never stop the rest of a load: leave it out and say why.
              try {
                index.put(row);
              } catch (RuntimeException e) {
                index.remove(row.getId());
                Loggers.logger(getX(), VectorStoreDAO.this)
                  .warning("Skipped row with an unreadable vector", row.getId(), e);
              }
            }
          }, 0, AbstractDAO.MAX_SAFE_INTEGER, null, null);
          index.setLoaded(true);
        }
      `
    },
    {
      name: 'put_',
      type: 'FObject',
      args: 'X x, FObject obj',
      javaCode: `
        VectorEmbedding e       = (VectorEmbedding) obj;
        String          problem = VectorIndex.check(e.getVector());
        if ( problem != null )
          throw new IllegalArgumentException("Vector for " + e.getId() + " " + problem);

        // Each write and its index update happen as one step, so the index never
        // ends up with an older version of a row than the DAO (two puts of one id)
        // or with a row a concurrent remove already deleted. Searches do not take
        // this lock; writes are serialised, as they already share one journal.
        // Before the first search the index is not loaded, and that load reads
        // this row from the delegate.
        VectorIndex index = getIndex();
        synchronized ( index ) {
          VectorEmbedding stored = (VectorEmbedding) getDelegate().put_(x, e);
          if ( stored != null && index.isLoaded() ) {
            try {
              index.put(stored);
            } catch (RuntimeException t) {
              index.remove(stored.getId());
              Loggers.logger(x, this).warning("Stored row is not searchable", stored.getId(), t);
            }
          }
          return stored;
        }
      `
    },
    {
      name: 'remove_',
      type: 'FObject',
      args: 'X x, FObject obj',
      javaCode: `
        synchronized ( getIndex() ) {
          FObject removed = getDelegate().remove_(x, obj);
          if ( getIndex().isLoaded() ) getIndex().remove(((VectorEmbedding) obj).getId());
          return removed;
        }
      `
    },
    {
      name: 'removeAll_',
      args: 'X x, long skip, long limit, foam.mlang.order.Comparator order, foam.mlang.predicate.Predicate predicate',
      javaCode: `
        VectorIndex index = getIndex();
        synchronized ( index ) {
          // The delegate does not say which rows it removed, so list them first, with the same
          // arguments. The index stays loaded and loses only those rows; a search running now
          // never sees an empty index. Before the first search there is nothing to update.
          List<String> ids = new ArrayList<>();
          if ( index.isLoaded() ) {
            getDelegate().select_(x, new AbstractSink() {
              @Override
              public void put(Object obj, Detachable sub) {
                ids.add(((VectorEmbedding) obj).getId());
              }
            }, skip, limit, order, predicate);
          }
          getDelegate().removeAll_(x, skip, limit, order, predicate);
          for ( String id : ids ) index.remove(id);
        }
      `
    },
    {
      name: 'select_',
      type: 'foam.dao.Sink',
      args: 'X x, foam.dao.Sink sink, long skip, long limit, foam.mlang.order.Comparator order, foam.mlang.predicate.Predicate predicate',
      javaCode: `
        if ( ! ( order instanceof CosineComparator ) ) {
          return super.select_(x, sink, skip, limit, order, predicate);
        }
        ensureLoaded_();

        CosineComparator cc    = (CosineComparator) order;
        VectorIndex      index = getIndex();
        // Never ask for more than the index holds: a client limit of 2^31 must not size an array.
        long rows = index.size();
        long want = limit > 0 && limit < AbstractDAO.MAX_SAFE_INTEGER
          ? Math.min(skip + limit, rows)
          : rows;

        // The index is shared by every caller, so each hit is read back through
        // the delegate in x: a row x may not read (another tenant's, say) is
        // dropped, and the scan is repeated with twice the depth until the page
        // is full or the index is exhausted. Each deeper scan starts again from the
        // best row, so the verdicts are kept and no id is checked twice.
        Map<String, FObject>  checked = new HashMap<>();
        List<VectorEmbedding> visible = new ArrayList<>();
        for ( long depth = want ; ; depth = Math.min(depth * 2, rows) ) {
          List<VectorIndex.Hit> hits = index.search(
            cc.getQueryVector(), cc.getEmbeddingModel(), predicate, (int) depth);
          visible.clear();
          for ( VectorIndex.Hit hit : hits ) {
            String id = hit.row.getId();
            if ( ! checked.containsKey(id) ) checked.put(id, getDelegate().find_(x, id));
            FObject row = checked.get(id);
            if ( row == null ) continue;
            VectorEmbedding scored = (VectorEmbedding) row.fclone();
            scored.setScore(hit.score);
            visible.add(scored);
            if ( visible.size() == want ) break;
          }
          if ( visible.size() >= want || hits.size() < depth || depth >= rows ) break;
        }

        for ( long i = skip ; i < visible.size() ; i++ ) sink.put(visible.get((int) i), null);
        sink.eof();
        return sink;
      `
    }
  ]
});
