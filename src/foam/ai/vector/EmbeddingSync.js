/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'EmbeddingSync',

  documentation: `
    Embeds the records that EmbeddingAwareDAO marked NEW or DIRTY, so a save
    never waits on an AI call. Each EmbeddingAwareDAO that EasyDAO builds adds
    itself here; no list of DAOs is configured. A DAO built lazily joins when
    something first uses it, so its records are embedded from then on.
    On a server it is the embeddingSync service, and the "embeddingSync" cron
    calls sync() every 5 minutes. In a browser, an app that exports one as
    embeddingSync gets a sync a moment after each change to its DAOs, e.g.
    a note saved in a page that has no server is searchable a second later.
    Either way one sync makes at most batchSize AI calls; the next sync goes
    on where it stopped. When the provider is down, e.g. an app with no
    embedding provider, each run stops after two failed calls with one
    warning. A single record the provider refuses gets one warning and does
    not stop the others. Failed records are retried on the next run.
  `,

  javaImports: [
    'foam.core.logger.Loggers',
    'java.util.List',
    'java.util.concurrent.CopyOnWriteArrayList'
  ],

  properties: [
    {
      class: 'Int',
      name: 'batchSize',
      documentation: 'The most embedding calls one sync makes, so one run over a large DAO stays short.',
      value: 50
    },
    {
      class: 'Object',
      name: 'daos_',
      documentation: 'The EmbeddingAwareDAOs that added themselves.',
      javaType: 'List<EmbeddingAwareDAO>',
      javaFactory: 'return new CopyOnWriteArrayList<>();',
      factory: function() { return []; },
      hidden: true,
      transient: true
    },
    {
      name: 'running_',
      documentation: 'The browser sync under way, so a change made meanwhile starts the next one after it.',
      flags: ['js'],
      hidden: true,
      transient: true
    }
  ],

  methods: [
    {
      name: 'add',
      documentation: 'Adds an EmbeddingAwareDAO whose records this sync embeds.',
      args: 'foam.ai.vector.EmbeddingAwareDAO dao',
      code: function(dao) {
        this.daos_.push(dao);
        dao.on.sub(this.onChange);
        this.onChange();
      },
      javaCode: 'getDaos_().add(dao);'
    },
    {
      name: 'sync',
      documentation: 'Embeds the marked records of every DAO added, up to batchSize AI calls.',
      async: true,
      args: 'Context x',
      code: async function(x) {
        var budget = this.batchSize;
        for ( var dao of this.daos_ ) {
          if ( budget <= 0 ) break;
          try {
            budget -= await dao.sync(x, budget);
          } catch ( e ) {
            // two calls in a row failed: the provider is down, and every other record would fail the same way
            x.warn('Embedding sync stopped, retried on the next sync', dao.name, e);
            return;
          }
        }
        // more left than one batch: carry on a moment later
        if ( budget <= 0 ) this.onChange();
      },
      javaCode: `
        int budget = getBatchSize();
        for ( EmbeddingAwareDAO dao : getDaos_() ) {
          if ( budget <= 0 ) break;
          try {
            budget -= dao.sync(x, budget);
          } catch ( Throwable t ) {
            // Two calls in a row failed: the provider is down, e.g. none is
            // configured, and every other record would fail the same way.
            Loggers.logger(x, this).warning("Embedding sync stopped, retried on the next sync", dao.getName(), t);
            return;
          }
        }
      `
    }
  ],

  listeners: [
    {
      name: 'onChange',
      documentation: `
        In a browser, a change to a DAO starts a sync a second later, so a
        burst of saves, such as a page loading many records, costs one sync.
        A sync already running finishes first.
      `,
      flags: ['js'],
      isMerged: true,
      mergeDelay: 1000,
      code: function() {
        this.running_ = ( this.running_ || Promise.resolve() ).then(() => this.sync(this.__subContext__));
      }
    }
  ]
});
