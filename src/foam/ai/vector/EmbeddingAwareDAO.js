/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'EmbeddingAwareDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `
    Keeps the chunks in vectorStoreDAO in step with an EmbeddingAware DAO's
    records. EasyDAO adds it to any DAO whose model implements EmbeddingAware.
    A put stores the record first, then embeds it in the background, so the
    caller never waits on an AI call and a failed call only logs a warning.
    A put that leaves toIndexText and isEmbeddable as they were, e.g. one that
    only moves a block of a document, does nothing more. A record that is
    no longer embeddable loses its chunks. A remove deletes the record and its
    chunks. The background work runs as the system, so a user who may edit a
    record needs no right on the index.
    Chunks are stored under this DAO's name, e.g. "noteDAO:42:0" for the
    first chunk of note 42.
  `,

  requires: [
    'foam.core.ai.vector.RAGIndexer',
    'foam.dao.ArraySink'
  ],

  javaImports: [
    'foam.ai.vector.EmbeddingAware',
    'foam.core.ai.vector.RAGIndexer',
    'foam.core.logger.Loggers',
    'foam.dao.RemoveSink',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      documentation: `The DAO's service name, e.g. "noteDAO": the daoKey of its chunks.`
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
        var old   = await this.delegate.find_(x, obj.id);
        var saved = await this.delegate.put_(x, obj);
        if ( ! old || old.toIndexText(x) !== saved.toIndexText(x) || this.embeddable_(x, old) !== this.embeddable_(x, saved) ) {
          this.index_(saved);
        }
        return saved;
      },
      javaCode: `
        EmbeddingAware old   = (EmbeddingAware) getDelegate().find_(x, obj);
        FObject        saved = getDelegate().put_(x, obj);
        EmbeddingAware now   = (EmbeddingAware) saved;
        if ( old == null || ! SafetyUtil.equals(old.toIndexText(x), now.toIndexText(x)) || old.isEmbeddable(x) != now.isEmbeddable(x) ) {
          index_(saved);
        }
        return saved;
      `
    },
    {
      name: 'index_',
      documentation: `
        Brings the chunks of a saved record in line with the record as it is
        stored when the work runs, not as it was saved: two quick saves of one
        record then end with the chunks of the later text, whichever finishes
        last. RAGIndexer makes no AI call when the stored chunks already hold
        that text.
      `,
      args: 'foam.lang.FObject saved',
      code: function(saved) {
        var x       = this.__context__;
        var indexer = this.RAGIndexer.create();
        this.delegate.find_(x, saved.id).then(current => {
          if ( current && this.embeddable_(x, current) ) return indexer.index(x, this.name, current);
          return indexer.remove(x, this.name, String(saved.id));
        }).catch(e => x.warn('Embedding failed, the record has no chunks until its text changes', this.name, saved.id, e));
      },
      javaCode: `
        ((Agency) getX().get("threadPool")).submit(getX(), new ContextAgent() {
          public void execute(X x) {
            RAGIndexer indexer = new RAGIndexer();
            try {
              FObject current = getDelegate().find_(x, saved);
              if ( current != null && ((EmbeddingAware) current).isEmbeddable(x) ) {
                indexer.index(x, getName(), current);
              } else {
                indexer.remove(x, getName(), String.valueOf(saved.getProperty("id")));
              }
            } catch ( RuntimeException e ) {
              Loggers.logger(x, this).warning("Embedding failed, the record has no chunks until its text changes", getName(), saved.getProperty("id"), e);
            }
          }
        }, "Embedding " + getName() + " " + saved.getProperty("id"));
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
    }
  ]
});
