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
    whose model implements EmbeddingAware.
    A put marks a new record NEW, a record whose toIndexText changed DIRTY,
    and a record that stopped being embeddable DISCARDED (and drops its
    chunks). Any other put, e.g. one that only moves a block of a document,
    leaves the status as it was. A remove deletes the record and its chunks.
    sync() then embeds the NEW and DIRTY records, called by EmbeddingSync.
    Chunks are stored under this DAO's name, e.g. "noteDAO:42:0" for the
    first chunk of note 42.
  `,

  requires: [
    'foam.ai.vector.EmbeddingStatus',
    'foam.core.ai.vector.RAGIndexer',
    'foam.dao.ArraySink'
  ],

  javaImports: [
    'foam.core.ai.vector.RAGIndexer',
    'foam.core.logger.Loggers',
    'foam.dao.ArraySink',
    'foam.dao.RemoveSink',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.mlang.MLang',
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      documentation: 'The DAO\'s service name, e.g. "noteDAO": the daoKey of its chunks, which an answer\'s source link opens.'
    }
  ],

  methods: [
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
        Embeds this DAO's NEW and DIRTY records, at most limit of them with an
        AI call, and returns how many calls it made. A record whose stored
        chunks already hold its text, e.g. one loaded from a journal at boot,
        turns EMBEDDED with no call. After a failed call it tries one more
        record: if that one fails too, the provider is down, e.g. none is
        configured, and the error is thrown to the caller, which stops the
        sync. If it works, only the first record is refused, e.g. a text the
        provider rejects: one warning names it and the sync goes on. Either
        way the failed records keep their status, so the next sync retries them.
      `,
      type: 'Integer',
      async: true,
      args: 'Context x, int limit',
      code: async function(x, limit) {
        var status = this.of.getAxiomByName('embeddingStatus');
        var todo   = await this.delegate.select_(x, this.ArraySink.create(), 0, Number.MAX_SAFE_INTEGER, null,
          this.OR(this.EQ(status, this.EmbeddingStatus.NEW), this.EQ(status, this.EmbeddingStatus.DIRTY)));
        var calls  = 0;
        var failed = null; // the record whose call failed, until another call shows why
        var error  = null;
        for ( var obj of todo.array ) {
          if ( calls >= limit ) break;
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
        PropertyInfo status = (PropertyInfo) getOf().getAxiomByName("embeddingStatus");
        ArraySink    todo   = (ArraySink) getDelegate().select_(x, new ArraySink(), 0, Long.MAX_VALUE, null,
          MLang.OR(MLang.EQ(status, EmbeddingStatus.NEW), MLang.EQ(status, EmbeddingStatus.DIRTY)));
        int       calls  = 0;
        FObject   failed = null; // the record whose call failed, until another call shows why
        Throwable error  = null;
        for ( Object obj : todo.getArray() ) {
          if ( calls >= limit ) break;
          try {
            if ( ! embed_(x, (FObject) obj) ) continue;
            calls++;
          } catch ( RuntimeException e ) {
            calls++;
            if ( failed != null ) throw e;
            failed = (FObject) obj;
            error  = e;
            continue;
          }
          if ( failed != null ) {
            Loggers.logger(x, this).warning("Embedding refused one record, retried on the next sync", getName(), failed.getProperty("id"), error);
            failed = null;
          }
        }
        // no later call to tell the cause: one warning, and the next sync retries it
        if ( failed != null ) Loggers.logger(x, this).warning("Embedding refused one record, retried on the next sync", getName(), failed.getProperty("id"), error);
        return calls;
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
        String     id         = String.valueOf(obj.getProperty("id"));
        boolean    embeddable = ((EmbeddingAware) obj).isEmbeddable(x);
        boolean    called     = false;
        if ( embeddable ) {
          called = indexer.index(x, getName(), obj);
        } else {
          indexer.remove(x, getName(), id);
        }

        // The record may have changed while the AI call ran. Removed or
        // discarded meanwhile: the chunks just written must go too. Edited
        // meanwhile: its status stays, so the next sync embeds the new text.
        FObject current = getDelegate().find_(x, obj);
        if ( current == null || ((EmbeddingAware) current).getEmbeddingStatus() == EmbeddingStatus.DISCARDED ) {
          indexer.remove(x, getName(), id);
        } else if ( current.equals(obj) ) {
          // Written below the rules and the last-modified stamp, and the
          // status is not stored, so marking a record embedded leaves no
          // journal line, no history and no new lastModified.
          current = current.fclone();
          ((EmbeddingAware) current).setEmbeddingStatus(embeddable ? EmbeddingStatus.EMBEDDED : EmbeddingStatus.DISCARDED);
          getDelegate().put_(x, current);
        }
        return called;
      `
    }
  ]
});
