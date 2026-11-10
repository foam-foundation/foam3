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
    'foam.ai.vector.Float32Quantizer',
    'foam.ai.vector.VectorEmbedding',
    'foam.ai.vector.VectorIndex',
    'foam.core.logger.Loggers',
    'foam.core.partition.PartitionedDAO',
    'foam.dao.AbstractDAO',
    'foam.dao.AbstractSink',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.mlang.predicate.Predicate',
    'java.util.ArrayList',
    'java.util.Base64',
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

    How vectors are stored is configured with quantizer (Float32Quantizer unless
    set). Each row is journaled in its quantizer's format and names
    that format in vectorFormat, so the configuration can change later without
    misreading rows already written.

    The index loads from the delegate on the first search and is then kept in
    step by put_ and remove_ (removeAll_ reloads it on next use). Each hit is
    read back through the delegate in the caller's context, so whatever
    authorization sits in the delegate chain below this DAO decides which rows a
    caller may see.

    A store can be partitioned: set partitionProperty to a property of the row,
    for example a tenant id, and the index keeps each value's vectors
    apart. A similarity search must then name its partition in the query, as
    PartitionedDAO requires: EQ or IN on that property inside the where clause,
    or AllPartitions to visit every partition; a search that names none is
    rejected. The scan then covers only the named partitions, so a forgotten
    filter becomes an error instead of a search across every partition. That is a
    guard, not an access check: nothing here decides who may read a partition, so
    the code that builds the filter must. Without partitionProperty every search
    covers every row of its model.

    Vectors are held in blocks of about blockBytes (1 MiB unless set), so a
    store grows without one huge array and gives memory back after deletes.
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.ai.vector.Quantizer',
      name: 'quantizer',
      documentation: 'How every row is packed; Float32Quantizer unless set. An app picks a lossy one, such as Int8Quantizer.',
      javaFactory: 'return new Float32Quantizer();'
    },
    {
      class: 'foam.mlang.ExprProperty',
      name: 'partitionProperty',
      documentation: `Property of the row (for example KIND) whose value splits the
        index into partitions. A similarity search must then name its partition. Unset: no
        partitions.`
    },
    {
      class: 'Int',
      name: 'blockBytes',
      value: 1048576,
      documentation: `About how many bytes of vectors one index block holds (a block holds a
        power-of-two number of rows, so up to twice that). A group adds and frees blocks; a
        new block starts small and grows to this size.`
    },
    {
      class: 'Object',
      name: 'index',
      javaType: 'VectorIndex',
      documentation: `Built once, on first use, from quantizer and blockBytes, so set them before
        the first search.`,
      javaFactory: 'return new VectorIndex(getQuantizer(), getPartitionProperty(), getBlockBytes());',
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
        VectorEmbedding    e     = (VectorEmbedding) obj;
        VectorIndex        index = getIndex();
        VectorIndex.Packed packed;
        try {
          packed = index.pack(e);
        } catch (IllegalArgumentException t) {
          throw new IllegalArgumentException(
            "Vector for " + e.getId() + " cannot be stored: " + t.getMessage(), t);
        }

        // Journal only the packed form, in the configured format: a 1024-dim vector is about
        // 5.5 KB as float32, or 1.4 KB as int8, instead of about 12 KB of float text.
        if ( packed != null && packed.changed ) {
          e = (VectorEmbedding) e.fclone();
          e.setVectorData(Base64.getEncoder().encodeToString(packed.bytes));
          e.setVectorFormat(packed.quantizer.formatId());
          e.clearVector();
        }

        // Each write and its index update happen as one step, so the index never
        // ends up with an older version of a row than the DAO (two puts of one id)
        // or with a row a concurrent remove already deleted. Searches do not take
        // this lock; writes are serialised, as they already share one journal.
        // Before the first search the index is not loaded, and that load reads
        // this row from the delegate.
        synchronized ( index ) {
          VectorEmbedding stored = (VectorEmbedding) getDelegate().put_(x, e);
          if ( stored != null && index.isLoaded() ) index.put(stored, packed);
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
      name: 'partitionsOf',
      documentation: `The partitions a similarity search covers, as PartitionedDAO resolves them:
        AllPartitions on the partition property means every partition (null); otherwise the
        value or values an EQ or IN on the property names, inside the where clause. Throws
        when the query names none.`,
      javaType: 'String[]',
      args: 'Predicate predicate',
      javaCode: `
        return PartitionedDAO.resolvePartitions(
          predicate, getPartitionProperty(), "A similarity search");
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
        // Reject a search that names no partition before the index loads: loading reads every
        // partition's rows, and a rejected search should cost nothing.
        String[] partitions = getPartitionProperty() == null ? null : partitionsOf(predicate);
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
            cc.getQueryVector(), cc.getEmbeddingModel(), partitions, predicate, (int) depth);
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
