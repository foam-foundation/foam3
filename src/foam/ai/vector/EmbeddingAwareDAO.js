/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'EmbeddingAwareDAO',
  extends: 'foam.dao.ProxyDAO',

  implements: [ 'foam.mlang.Expressions' ],

  documentation: `
    Keeps the embeddingStatus of an EmbeddingAware DAO's records, so that
    saving a record never waits on an AI call. EasyDAO adds it to any DAO
    whose model implements EmbeddingAware, and it adds itself to the
    context's embeddingSync, so no list of DAOs is configured.
    A put marks a new record NEW, a record whose toIndexText changed DIRTY,
    and a record that stopped being embeddable DISCARDED (and drops its
    chunks). A NEW or DIRTY record wakes embeddingSync, which embeds it in
    the background. Any other put, e.g. one that only moves a block of a document,
    leaves the status as it was. A remove deletes the record and its chunks.
    sync() embeds the NEW and DIRTY records, called by EmbeddingSync.
    A failed embedding call leaves the record NEW or DIRTY, so the next sync
    retries it. A context with no embeddingService, vectorStoreDAO or (on a
    server) threadPool removes no chunks and starts no sync, so a save and a
    remove always work without an AI provider.
    The chunks are removed as the system context, so a user who may edit a
    record needs no right on the index.
    Chunks are stored under this DAO's name, e.g. "noteDAO:42:0" for the
    first chunk of note 42.
  `,

  imports: [ 'foam.ai.vector.EmbeddingSync embeddingSync?' ],

  requires: [
    'foam.ai.vector.EmbeddingStatus',
    'foam.core.ai.vector.RAGIndexer',
    'foam.dao.ArraySink'
  ],

  javaImports: [
    'foam.core.ai.vector.RAGIndexer',
    'foam.core.logger.Loggers',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.RemoveSink',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.mlang.MLang',
    'foam.mlang.sink.Count',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List'
  ],

  javaCode: `
    /** The provider is down, e.g. none is configured: two embedding calls failed in a row, so every other record would fail the same way. */
    public static class ProviderDownException extends RuntimeException {
      public ProviderDownException(Throwable cause) { super(cause); }
    }

    /**
     * The records of one sync waiting for embedding, the chunks of each, and how the sync went:
     * the AI calls made, and a record whose own call failed until a later call shows whether
     * only that record was refused or the provider is down.
     */
    protected static class Pending {
      List<FObject>  records = new ArrayList<>();
      List<String[]> chunks  = new ArrayList<>();
      int            perCall;
      int            texts;
      int            calls;
      FObject        failed;
      Throwable      error;

      Pending(int perCall) { this.perCall = Math.max(1, perCall); }
      void clear() { records.clear(); chunks.clear(); texts = 0; }
    }

    /** One lock per group of ids, so a user's save and the sync's status write on one record never interleave. */
    protected final Object[] locks_ = newLocks_();

    private static Object[] newLocks_() {
      Object[] locks = new Object[64];
      for ( int i = 0 ; i < locks.length ; i++ ) locks[i] = new Object();
      return locks;
    }

    protected Object lock_(Object id) {
      return locks_[( String.valueOf(id).hashCode() & 0x7fffffff ) % locks_.length];
    }

    /**
     * The vectors of texts, at most perCall texts to a call, so a record of 500 chunks is not
     * one huge request. Counts every call, failed or not.
     */
    protected VectorEmbedding[] embedAll_(X x, Pending p, String[] texts) {
      RAGIndexer       indexer  = new RAGIndexer();
      VectorEmbedding[] out     = new VectorEmbedding[texts.length];
      for ( int at = 0 ; at < texts.length ; at += p.perCall ) {
        int end = Math.min(texts.length, at + p.perCall);
        p.calls++;
        VectorEmbedding[] part = indexer.embedAll(x, Arrays.copyOfRange(texts, at, end));
        System.arraycopy(part, 0, out, at, part.length);
      }
      return out;
    }

    /**
     * Embeds the chunks of every waiting record, up to textsPerCall chunks to a call, e.g. 64
     * chunks of 30 records, so a million records cost tens of thousands of round trips to the
     * provider, not a million. When a call fails, each record is tried on its own: either one
     * record is refused, and the others are embedded, or the provider is down.
     */
    protected void flush_(X x, Pending p) {
      if ( p.records.isEmpty() ) return;
      VectorEmbedding[] embedded = new VectorEmbedding[0];
      if ( p.texts > 0 ) {
        String[] texts = new String[p.texts];
        int      k     = 0;
        for ( String[] chunks : p.chunks ) for ( String t : chunks ) texts[k++] = t;
        try {
          embedded = embedAll_(x, p, texts);
        } catch ( RuntimeException e ) {
          for ( int i = 0 ; i < p.records.size() ; i++ ) embedOne_(x, p, p.records.get(i), p.chunks.get(i));
          p.clear();
          return;
        }
      }
      int at = 0;
      for ( int i = 0 ; i < p.records.size() ; i++ ) {
        int n = p.chunks.get(i).length;
        store_(x, p.records.get(i), Arrays.copyOfRange(embedded, at, at + n));
        at += n;
      }
      if ( p.texts > 0 ) refusedAlone_(x, p);
      p.clear();
    }

    /** One record in calls of its own, after its batch failed. Two records failing in a row mean the provider is down. */
    protected void embedOne_(X x, Pending p, FObject obj, String[] chunks) {
      VectorEmbedding[] embedded = new VectorEmbedding[0];
      if ( chunks.length > 0 ) {
        try {
          embedded = embedAll_(x, p, chunks);
        } catch ( RuntimeException e ) {
          if ( p.failed != null ) throw new ProviderDownException(e);
          p.failed = obj;
          p.error  = e;
          return;
        }
      }
      store_(x, obj, embedded);
      if ( chunks.length > 0 ) refusedAlone_(x, p);
    }

    /** Writes the chunks of a record and marks it EMBEDDED. A store that fails for one record leaves that record for the next sync. */
    protected void store_(X x, FObject obj, VectorEmbedding[] embedded) {
      try {
        new RAGIndexer().replace(x, getName(), String.valueOf(obj.getProperty("id")), embedded);
        finish_(x, obj, true);
      } catch ( RuntimeException e ) {
        Loggers.logger(x, this).warning("Embedding could not store one record, retried on the next sync", getName(), obj.getProperty("id"), e);
      }
    }

    /** A call worked after a record's own call failed: only that record was refused. */
    protected void refusedAlone_(X x, Pending p) {
      if ( p.failed == null ) return;
      Loggers.logger(x, this).warning("Embedding refused one record, retried on the next sync", getName(), p.failed.getProperty("id"), p.error);
      p.failed = null;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'name',
      documentation: `The DAO's service name, e.g. "noteDAO": the daoKey of its chunks.`
    },
    {
      name: 'locks_',
      documentation: 'The save or status write waiting on each record id, see withLock_.',
      flags: ['js'],
      factory: function() { return {}; },
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'swept_',
      documentation: 'Whether this server has removed the chunks whose record is gone; done once, on the first sync.',
      flags: ['java'],
      hidden: true,
      transient: true
    }
  ],

  methods: [
    {
      name: 'init',
      code: function() {
        this.SUPER();
        if ( this.embeddingSync ) this.embeddingSync.add(this);
      }
    },
    {
      name: 'init_',
      javaCode: 'if ( getEmbeddingSync() != null ) getEmbeddingSync().add(this);'
    },
    {
      // A browser model that leaves isEmbeddable out has no method for it, and counts as
      // embeddable: see EmbeddingAware. Java models always have it.
      name: 'embeddable_',
      flags: [ 'js' ],
      code: function(x, obj) {
        return ! obj.isEmbeddable || obj.isEmbeddable(x);
      }
    },
    {
      name: 'withLock_',
      documentation: `
        Runs fn after every earlier call for the same id has finished, so a user's save and the
        sync's status write on one record never interleave across their awaits.
      `,
      flags: ['js'],
      code: async function(id, fn) {
        var key  = String(id);
        var prev = this.locks_[key] || Promise.resolve();
        var run  = prev.then(fn);
        var tail = run.catch(() => {});
        this.locks_[key] = tail;
        try {
          return await run;
        } finally {
          if ( this.locks_[key] === tail ) delete this.locks_[key];
        }
      }
    },
    {
      name: 'configured_',
      documentation: 'Whether the context has what indexing needs: the embedder, the chunk store and, on a server, the thread pool.',
      type: 'Boolean',
      code: function() {
        return !! ( this.__context__.embeddingService && this.__context__.vectorStoreDAO );
      },
      javaCode: `
        return getX().get("threadPool") != null && getX().get("embeddingService") != null && getX().get("vectorStoreDAO") != null;
      `
    },
    {
      name: 'put_',
      code: async function(x, obj) {
        var old, status, saved;
        await this.withLock_(obj.id, async () => {
          old    = await this.delegate.find_(x, obj.id);
          status = this.statusAfterPut(x, old, obj);
          if ( obj.embeddingStatus !== status ) {
            obj = obj.clone();
            obj.embeddingStatus = status;
          }
          saved = await this.delegate.put_(x, obj);
        });
        if ( this.configured_() && status === this.EmbeddingStatus.DISCARDED && old && old.embeddingStatus !== this.EmbeddingStatus.DISCARDED ) {
          await this.RAGIndexer.create().remove(this.__context__, this.name, String(obj.id));
        }
        if ( this.configured_() && this.embeddingSync && ( status === this.EmbeddingStatus.NEW || status === this.EmbeddingStatus.DIRTY ) ) this.embeddingSync.wake();
        return saved;
      },
      javaCode: `
        EmbeddingAware  old;
        EmbeddingStatus status;
        FObject         saved;
        // The status write of a sync reads the record, then writes it back; this lock keeps a
        // save from landing between the two and being overwritten.
        synchronized ( lock_(obj.getProperty("id")) ) {
          old    = (EmbeddingAware) getDelegate().find_(x, obj);
          status = statusAfterPut(x, old, (EmbeddingAware) obj);
          if ( ((EmbeddingAware) obj).getEmbeddingStatus() != status ) {
            obj = obj.fclone();
            ((EmbeddingAware) obj).setEmbeddingStatus(status);
          }
          saved = getDelegate().put_(x, obj);
        }
        // The chunks are the index's own rows, not the user's: removed as the
        // system, so a user who may edit a record needs no right on the index.
        if ( configured_() && status == EmbeddingStatus.DISCARDED && old != null && old.getEmbeddingStatus() != EmbeddingStatus.DISCARDED ) {
          new RAGIndexer().remove(getX(), getName(), String.valueOf(obj.getProperty("id")));
        }
        // the sync embeds it in the background; the save does not wait
        if ( configured_() && getEmbeddingSync() != null && ( status == EmbeddingStatus.NEW || status == EmbeddingStatus.DIRTY ) ) getEmbeddingSync().wake();
        return saved;
      `
    },
    {
      name: 'remove_',
      code: async function(x, obj) {
        var removed = await this.delegate.remove_(x, obj);
        if ( this.configured_() ) await this.RAGIndexer.create().remove(this.__context__, this.name, String(obj.id));
        return removed;
      },
      javaCode: `
        FObject removed = getDelegate().remove_(x, obj);
        // removed as the system: see put_
        if ( configured_() ) new RAGIndexer().remove(getX(), getName(), String.valueOf(obj.getProperty("id")));
        return removed;
      `
    },
    {
      name: 'removeAll_',
      code: async function(x, skip, limit, order, predicate) {
        var sink = await this.delegate.select_(x, this.ArraySink.create(), skip, limit, order, predicate);
        for ( var obj of sink.array ) await this.remove_(x, obj);
      },
      javaCode: `
        // one remove_ per record, so each record's chunks go with it
        getDelegate().select_(x, new RemoveSink(x, this), skip, limit, order, predicate);
      `
    },
    {
      name: 'statusAfterPut',
      documentation: 'The status a put of obj gives it, where old is the stored record or null.',
      type: 'foam.ai.vector.EmbeddingStatus',
      args: 'Context x, foam.ai.vector.EmbeddingAware old, foam.ai.vector.EmbeddingAware obj',
      code: function(x, old, obj) {
        if ( ! this.embeddable_(x, obj) ) return this.EmbeddingStatus.DISCARDED;
        if ( ! old ) return this.EmbeddingStatus.NEW;
        if ( old.embeddingStatus === this.EmbeddingStatus.DISCARDED || old.toIndexText(x) !== obj.toIndexText(x) ) return this.EmbeddingStatus.DIRTY;
        return old.embeddingStatus;
      },
      javaCode: `
        if ( ! obj.isEmbeddable(x) ) return EmbeddingStatus.DISCARDED;
        if ( old == null ) return EmbeddingStatus.NEW;
        if ( old.getEmbeddingStatus() == EmbeddingStatus.DISCARDED || ! SafetyUtil.equals(old.toIndexText(x), obj.toIndexText(x)) ) return EmbeddingStatus.DIRTY;
        return old.getEmbeddingStatus();
      `
    },
    {
      name: 'sync',
      documentation: `
        Embeds this DAO's NEW and DIRTY records and returns how many AI calls it
        made. A record whose stored chunks already hold its text, e.g. one
        loaded from a journal at boot, turns EMBEDDED with no call. On a server
        the chunks of up to textsPerCall waiting chunks go in one call; a
        browser embeds one record a call, since its embedder runs in the page.
        When a call fails, the sync tries more records one at a time: if two
        fail in a row, the provider is down, e.g. none is configured, and a
        ProviderDownException goes to the caller, which stops the sync. If one
        works, only the first record is refused, e.g. a text the provider
        rejects: one warning names it and the sync goes on. A record whose
        toIndexText or isEmbeddable throws is skipped with a warning and never
        counts as the provider being down. Either way these records keep their
        status, so the next sync retries them. A context with no embedder, chunk
        store or thread pool does nothing and returns 0.
        Each call carries at most textsPerCall chunks: a record of more chunks
        goes in several calls.
      `,
      type: 'Integer',
      async: true,
      args: 'Context x, int textsPerCall',
      code: async function(x) {
        if ( ! this.configured_() ) return 0;
        var status = this.of.getAxiomByName('embeddingStatus');
        // The browser's select does not wait for an async put, so the records are listed first
        var todo   = await this.delegate.select_(x, this.ArraySink.create(), 0, Number.MAX_SAFE_INTEGER, null,
          this.OR(this.EQ(status, this.EmbeddingStatus.NEW), this.EQ(status, this.EmbeddingStatus.DIRTY)));
        var calls  = 0;
        var failed = null; // the record whose call failed, until another call shows why
        var error  = null;
        for ( var obj of todo.array ) {
          try {
            if ( ! await this.embed_(x, obj) ) continue;
            calls++;
          } catch ( e ) {
            calls++;
            if ( failed ) throw e;
            failed = obj;
            error  = e;
            continue;
          }
          if ( failed ) {
            x.warn('Embedding refused one record, retried on the next sync', this.name, failed.id, error);
            failed = null;
          }
        }
        // no later call to tell the cause: one warning, and the next sync retries it
        if ( failed ) x.warn('Embedding refused one record, retried on the next sync', this.name, failed.id, error);
        return calls;
      },
      javaCode: `
        if ( ! configured_() ) return 0;
        if ( ! getSwept_() ) setSwept_(sweep_(x));
        PropertyInfo status   = (PropertyInfo) getOf().getAxiomByName("embeddingStatus");
        DAO          store    = ((DAO) x.get("vectorStoreDAO")).inX(x);
        RAGIndexer   indexer  = new RAGIndexer();
        Pending      pending  = new Pending(textsPerCall);
        // Streamed rather than listed first: after a restart every record waits, e.g. a
        // million of them. MDAO selects from a snapshot, so marking a record while the
        // select runs is safe.
        getDelegate().select_(x, new AbstractSink() {
          public void put(Object o, Detachable sub) {
            FObject  obj    = (FObject) o;
            String[] chunks;
            try {
              String id = String.valueOf(obj.getProperty("id"));
              if ( ! ((EmbeddingAware) obj).isEmbeddable(x) ) {
                indexer.remove(x, getName(), id);
                finish_(x, obj, false);
                return;
              }
              chunks = indexer.chunks(x, ((EmbeddingAware) obj).toIndexText(x));
              if ( indexer.isIndexed(store, getName(), id, chunks) ) {
                finish_(x, obj, true);
                return;
              }
            } catch ( RuntimeException e ) {
              // one record that cannot be read must not stop the others, nor look like a provider that is down
              Loggers.logger(x, this).warning("Embedding skipped one record that could not be read, retried on the next sync", getName(), obj.getProperty("id"), e);
              return;
            }
            pending.records.add(obj);
            pending.chunks.add(chunks);
            pending.texts += chunks.length;
            if ( pending.texts >= textsPerCall ) flush_(x, pending);
          }
        }, 0, Long.MAX_VALUE, null, MLang.OR(MLang.EQ(status, EmbeddingStatus.NEW), MLang.EQ(status, EmbeddingStatus.DIRTY)));
        flush_(x, pending);
        // no later call to tell the cause: one warning, and the next sync retries it
        if ( pending.failed != null ) Loggers.logger(x, this).warning("Embedding refused one record, retried on the next sync", getName(), pending.failed.getProperty("id"), pending.error);
        return pending.calls;
      `
    },
    {
      name: 'sweep_',
      documentation: `
        Removes the chunks whose record is gone, e.g. a record dropped from a
        journal while the server was down, which no remove_ saw, and returns
        true once a whole pass has run, so a failed pass is tried again by the
        next sync. It assumes that this DAO's name is the daoKey of its chunks
        alone, that each record with chunks has one chunk 0, e.g. "noteDAO:42:0",
        and that a record's id can be read back from the chunk's sourceId; a
        sourceId that cannot keeps its chunks. A DAO that holds no record at
        all while its chunks exist is left alone: it may not have loaded yet,
        and sweeping it would remove every chunk.
      `,
      type: 'Boolean',
      args: 'Context x',
      flags: ['java'],
      javaCode: `
        PropertyInfo id        = getPrimaryKey();
        List<String> gone      = new ArrayList<>();
        int[]        withChunk = { 0 };
        ((DAO) x.get("vectorStoreDAO")).inX(x).where(MLang.EQ(VectorEmbedding.DAO_KEY, getName())).select(new AbstractSink() {
          public void put(Object o, Detachable sub) {
            VectorEmbedding e = (VectorEmbedding) o;
            if ( ! e.getId().endsWith(":0") ) return;
            withChunk[0]++;
            Object key;
            try {
              key = id.fromString(e.getSourceId());
            } catch ( RuntimeException ex ) {
              return;
            }
            if ( getDelegate().find_(x, key) == null ) gone.add(e.getSourceId());
          }
        });
        if ( withChunk[0] > 0 && ((Count) getDelegate().select_(x, MLang.COUNT(), 0, Long.MAX_VALUE, null, null)).getValue() == 0 ) {
          Loggers.logger(x, this).info("Left the chunks alone: the DAO holds no record, it may not have loaded", getName(), withChunk[0]);
          return false;
        }
        RAGIndexer indexer = new RAGIndexer();
        for ( String sourceId : gone ) indexer.remove(x, getName(), sourceId);
        if ( ! gone.isEmpty() ) Loggers.logger(x, this).info("Removed the chunks of records that are gone", getName(), gone.size());
        return true;
      `
    },
    {
      name: 'embed_',
      documentation: 'Brings the chunks of one NEW or DIRTY record in line with it; true if that took an AI call. A browser embeds one record a call.',
      type: 'Boolean',
      async: true,
      flags: ['js'],
      args: 'Context x, foam.lang.FObject obj',
      code: async function(x, obj) {
        var S          = this.EmbeddingStatus;
        var indexer    = this.RAGIndexer.create();
        var id         = String(obj.id);
        var embeddable = this.embeddable_(x, obj);
        var called     = false;
        if ( embeddable ) {
          called = await indexer.index(x, this.name, obj, this.delegate);
        } else {
          await indexer.remove(x, this.name, id);
        }
        // read and written back with no save in between, see put_
        await this.withLock_(obj.id, async () => {
          var current = await this.delegate.find_(x, obj.id);
          if ( ! current || current.embeddingStatus === S.DISCARDED ) {
            await indexer.remove(x, this.name, id);
          } else if ( current.equals(obj) ) {
            current = current.clone();
            current.embeddingStatus = embeddable ? S.EMBEDDED : S.DISCARDED;
            await this.delegate.put_(x, current);
          }
        });
        return called;
      }
    },
    {
      name: 'finish_',
      documentation: 'Marks obj EMBEDDED, or DISCARDED when it is not embeddable, once its chunks match it.',
      args: 'Context x, foam.lang.FObject obj, boolean embeddable',
      flags: ['java'],
      javaCode: `
        // The record may have changed while the AI call ran. Removed or
        // discarded meanwhile: the chunks just written must go too. Edited
        // meanwhile: its status stays, so the next sync embeds the new text.
        // Read and written back under the record's lock, so a save that lands in
        // between waits and is not overwritten by this older copy.
        synchronized ( lock_(obj.getProperty("id")) ) {
          FObject current = getDelegate().find_(x, obj);
          if ( current == null || ((EmbeddingAware) current).getEmbeddingStatus() == EmbeddingStatus.DISCARDED ) {
            new RAGIndexer().remove(x, getName(), String.valueOf(obj.getProperty("id")));
          } else if ( current.equals(obj) ) {
            // Written below the rules and the last-modified stamp, and the
            // status is not stored, so marking a record embedded leaves no
            // journal line, no history and no new lastModified.
            current = current.fclone();
            ((EmbeddingAware) current).setEmbeddingStatus(embeddable ? EmbeddingStatus.EMBEDDED : EmbeddingStatus.DISCARDED);
            getDelegate().put_(x, current);
          }
        }
      `
    }
  ]
});
