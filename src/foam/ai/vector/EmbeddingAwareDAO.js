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
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List'
  ],

  javaCode: `
    /**
     * The records of one sync waiting for one embedAll call, the chunks of each, and how
     * the sync went: the AI calls made, and a record whose own call failed until a later
     * call shows whether only that record was refused or the provider is down.
     */
    protected static class Pending {
      List<FObject>  records = new ArrayList<>();
      List<String[]> chunks  = new ArrayList<>();
      int            texts;
      int            calls;
      FObject        failed;
      Throwable      error;

      void clear() { records.clear(); chunks.clear(); texts = 0; }
    }

    /**
     * Embeds the chunks of every waiting record in one call, e.g. 64 chunks of 30 records,
     * so a million records cost tens of thousands of round trips to the provider, not a
     * million. When the call fails, each record is tried in a call of its own: either one
     * record is refused, and the others are embedded, or the provider is down.
     */
    protected void flush_(X x, Pending p) {
      if ( p.records.isEmpty() ) return;
      RAGIndexer indexer = new RAGIndexer();
      VectorEmbedding[] embedded = new VectorEmbedding[0];
      if ( p.texts > 0 ) {
        String[] texts = new String[p.texts];
        int      k     = 0;
        for ( String[] chunks : p.chunks ) for ( String t : chunks ) texts[k++] = t;
        try {
          embedded = indexer.embedAll(x, texts);
          p.calls++;
        } catch ( RuntimeException e ) {
          p.calls++;
          for ( FObject obj : p.records ) embedOne_(x, p, obj);
          p.clear();
          return;
        }
      }
      int at = 0;
      for ( int i = 0 ; i < p.records.size() ; i++ ) {
        FObject obj = p.records.get(i);
        int     n   = p.chunks.get(i).length;
        indexer.replace(x, getName(), String.valueOf(obj.getProperty("id")), Arrays.copyOfRange(embedded, at, at + n));
        at += n;
        finish_(x, obj, true);
      }
      if ( p.texts > 0 ) refusedAlone_(x, p);
      p.clear();
    }

    /** One record in a call of its own, after its batch failed. Two such calls failing in a row mean the provider is down. */
    protected void embedOne_(X x, Pending p, FObject obj) {
      try {
        if ( ! embed_(x, obj) ) return;
        p.calls++;
      } catch ( RuntimeException e ) {
        p.calls++;
        if ( p.failed != null ) throw e;
        p.failed = obj;
        p.error  = e;
        return;
      }
      refusedAlone_(x, p);
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
      name: 'put_',
      code: async function(x, obj) {
        var old    = await this.delegate.find_(x, obj.id);
        var status = this.statusAfterPut(x, old, obj);
        if ( obj.embeddingStatus !== status ) {
          obj = obj.clone();
          obj.embeddingStatus = status;
        }
        var saved = await this.delegate.put_(x, obj);
        if ( status === this.EmbeddingStatus.DISCARDED && old && old.embeddingStatus !== this.EmbeddingStatus.DISCARDED ) {
          await this.RAGIndexer.create().remove(this.__context__, this.name, String(obj.id));
        }
        if ( this.embeddingSync && ( status === this.EmbeddingStatus.NEW || status === this.EmbeddingStatus.DIRTY ) ) this.embeddingSync.wake();
        return saved;
      },
      javaCode: `
        EmbeddingAware  old    = (EmbeddingAware) getDelegate().find_(x, obj);
        EmbeddingStatus status = statusAfterPut(x, old, (EmbeddingAware) obj);
        if ( ((EmbeddingAware) obj).getEmbeddingStatus() != status ) {
          obj = obj.fclone();
          ((EmbeddingAware) obj).setEmbeddingStatus(status);
        }
        FObject saved = getDelegate().put_(x, obj);
        // The chunks are the index's own rows, not the user's: removed as the
        // system, so a user who may edit a record needs no right on the index.
        if ( status == EmbeddingStatus.DISCARDED && old != null && old.getEmbeddingStatus() != EmbeddingStatus.DISCARDED ) {
          new RAGIndexer().remove(getX(), getName(), String.valueOf(obj.getProperty("id")));
        }
        // the sync embeds it in the background; the save does not wait
        if ( getEmbeddingSync() != null && ( status == EmbeddingStatus.NEW || status == EmbeddingStatus.DIRTY ) ) getEmbeddingSync().wake();
        return saved;
      `
    },
    {
      name: 'remove_',
      code: async function(x, obj) {
        var removed = await this.delegate.remove_(x, obj);
        await this.RAGIndexer.create().remove(this.__context__, this.name, String(obj.id));
        return removed;
      },
      javaCode: `
        FObject removed = getDelegate().remove_(x, obj);
        // removed as the system: see put_
        new RAGIndexer().remove(getX(), getName(), String.valueOf(obj.getProperty("id")));
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
        fail in a row, the provider is down, e.g. none is configured, and the
        error is thrown to the caller, which stops the sync. If one works, only
        the first record is refused, e.g. a text the provider rejects: one
        warning names it and the sync goes on. Either way the failed records
        keep their status, so the next sync retries them.
      `,
      type: 'Integer',
      async: true,
      args: 'Context x, int textsPerCall',
      code: async function(x) {
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
        if ( ! getSwept_() ) {
          sweep_(x);
          setSwept_(true);
        }
        PropertyInfo status   = (PropertyInfo) getOf().getAxiomByName("embeddingStatus");
        DAO          store    = ((DAO) x.get("vectorStoreDAO")).inX(x);
        String       model    = ((EmbeddingService) x.get("embeddingService")).getModel();
        RAGIndexer   indexer  = new RAGIndexer();
        Pending      pending  = new Pending();
        // Streamed rather than listed first: after a restart every record waits, e.g. a
        // million of them. MDAO selects from a snapshot, so marking a record while the
        // select runs is safe.
        getDelegate().select_(x, new AbstractSink() {
          public void put(Object o, Detachable sub) {
            FObject obj = (FObject) o;
            String  id  = String.valueOf(obj.getProperty("id"));
            if ( ! ((EmbeddingAware) obj).isEmbeddable(x) ) {
              indexer.remove(x, getName(), id);
              finish_(x, obj, false);
              return;
            }
            String[] chunks = indexer.chunks(x, ((EmbeddingAware) obj).toIndexText(x));
            if ( indexer.isIndexed(store, getName(), id, chunks, model) ) {
              finish_(x, obj, true);
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
        journal while the server was down, which no remove_ saw. Each record
        with chunks has one chunk 0, e.g. "noteDAO:42:0", so the sweep looks up
        one record per chunk 0. A sourceId that cannot be read back as an id
        keeps its chunks.
      `,
      args: 'Context x',
      flags: ['java'],
      javaCode: `
        PropertyInfo id    = getPrimaryKey();
        List<String> gone  = new ArrayList<>();
        ((DAO) x.get("vectorStoreDAO")).inX(x).where(MLang.EQ(VectorEmbedding.DAO_KEY, getName())).select(new AbstractSink() {
          public void put(Object o, Detachable sub) {
            VectorEmbedding e = (VectorEmbedding) o;
            if ( ! e.getId().endsWith(":0") ) return;
            Object key;
            try {
              key = id.fromString(e.getSourceId());
            } catch ( RuntimeException ex ) {
              return;
            }
            if ( getDelegate().find_(x, key) == null ) gone.add(e.getSourceId());
          }
        });
        RAGIndexer indexer = new RAGIndexer();
        for ( String sourceId : gone ) indexer.remove(x, getName(), sourceId);
        if ( ! gone.isEmpty() ) Loggers.logger(x, this).info("Removed the chunks of records that are gone", getName(), gone.size());
      `
    },
    {
      name: 'embed_',
      documentation: 'Brings the chunks of one NEW or DIRTY record in line with it; true if that took an AI call.',
      type: 'Boolean',
      async: true,
      args: 'Context x, foam.lang.FObject obj',
      code: async function(x, obj) {
        var S          = this.EmbeddingStatus;
        var indexer    = this.RAGIndexer.create();
        var id         = String(obj.id);
        var embeddable = this.embeddable_(x, obj);
        var called     = false;
        if ( embeddable ) {
          called = await indexer.index(x, this.name, obj);
        } else {
          await indexer.remove(x, this.name, id);
        }
        var current    = await this.delegate.find_(x, obj.id);
        if ( ! current || current.embeddingStatus === S.DISCARDED ) {
          await indexer.remove(x, this.name, id);
        } else if ( current.equals(obj) ) {
          current = current.clone();
          current.embeddingStatus = embeddable ? S.EMBEDDED : S.DISCARDED;
          await this.delegate.put_(x, current);
        }
        return called;
      },
      javaCode: `
        RAGIndexer indexer    = new RAGIndexer();
        boolean    embeddable = ((EmbeddingAware) obj).isEmbeddable(x);
        boolean    called     = false;
        if ( embeddable ) {
          called = indexer.index(x, getName(), obj);
        } else {
          indexer.remove(x, getName(), String.valueOf(obj.getProperty("id")));
        }
        finish_(x, obj, embeddable);
        return called;
      `
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
      `
    }
  ]
});
