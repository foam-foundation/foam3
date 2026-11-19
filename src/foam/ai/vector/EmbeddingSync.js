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
    never waits on an AI call. Each EmbeddingAwareDAO adds itself here when it
    is built; no list of DAOs is configured. A DAO built lazily joins when
    something first uses it, so its records are embedded from then on.
    A save of a NEW or DIRTY record calls wake(), which starts a sync in the
    background: a note saved on a server is searchable a moment later, once
    the provider answers. In a browser the sync starts a second after the
    change, so a burst of saves costs one sync.
    On a server the "embeddingSync" cron is the fallback: it calls sync()
    every 30 minutes to embed what a save could not, e.g. records loaded at
    boot, which are all NEW, or records left DIRTY while the provider was down.
    When the provider is down, e.g. an app with no embedding provider, a sync
    stops with one warning, and saves start no sync until the cron's next run
    gets through. A single record the provider refuses gets one warning and
    does not stop the others. Failed records keep their status, so the next
    sync retries them.
    An app replaces how records are embedded by overriding the embeddingSync
    service, and which provider embeds the text by overriding embeddingService.
  `,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'java.util.List',
    'java.util.concurrent.CopyOnWriteArrayList',
    'java.util.concurrent.atomic.AtomicBoolean'
  ],

  properties: [
    {
      class: 'Int',
      name: 'textsPerCall',
      documentation: `
        How many chunks a server sends the provider in one call, gathered from
        as many records as it takes. Fewer round trips: 64 chunks of 2 a record
        embed 32 records a call.
      `,
      value: 64
    },
    {
      class: 'Boolean',
      name: 'embedOnSave',
      documentation: `
        Whether a save starts a sync on a server. Off, records are embedded by
        the cron only, e.g. to keep the provider's calls to set hours.
      `,
      value: true,
      flags: ['java']
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
      class: 'Object',
      name: 'requested_',
      documentation: 'Whether a sync is waiting to start, so a burst of saves on a server queues one sync, not one each.',
      javaType: 'AtomicBoolean',
      javaFactory: 'return new AtomicBoolean();',
      flags: ['java'],
      hidden: true,
      transient: true
    },
    {
      class: 'Boolean',
      name: 'down_',
      documentation: 'Whether the last sync stopped because the provider was down. Saves start no sync until a sync gets through.',
      flags: ['java'],
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
      documentation: `Adds an EmbeddingAwareDAO whose records this sync embeds. A DAO
        built again under the same name, e.g. "noteDAO", replaces the one before it.`,
      args: 'foam.ai.vector.EmbeddingAwareDAO dao',
      code: function(dao) {
        this.daos_ = this.daos_.filter(d => d.name !== dao.name).concat(dao);
        this.wake();
      },
      javaCode: `
        getDaos_().removeIf(d -> d.getName().equals(dao.getName()));
        getDaos_().add(dao);
      `
    },
    {
      name: 'wake',
      documentation: `
        Called by EmbeddingAwareDAO when a save leaves a record NEW or DIRTY.
        Starts a sync in the background and returns at once.
      `,
      code: function() { this.onChange(); },
      javaCode: `
        // One sync waiting is enough: it embeds every record marked before it starts.
        if ( ! getEmbedOnSave() || getDown_() || getRequested_().getAndSet(true) ) return;
        ((Agency) getX().get("threadPool")).submit(getX(), new ContextAgent() {
          public void execute(X x) { sync(x); }
        }, "embeddingSync");
      `
    },
    {
      name: 'sync',
      documentation: 'Embeds the marked records of every DAO added.',
      async: true,
      args: 'Context x',
      code: async function(x) {
        for ( var dao of this.daos_ ) {
          try {
            await dao.sync(x, this.textsPerCall);
          } catch ( e ) {
            // two calls in a row failed: the provider is down, and every other record would fail the same way
            x.warn('Embedding sync stopped, retried on the next sync', dao.name, e);
            return;
          }
        }
      },
      javaCode: `
        // one sync at a time: a save's sync and the cron's never embed the same record twice
        synchronized ( this ) {
          getRequested_().set(false);
          for ( EmbeddingAwareDAO dao : getDaos_() ) {
            try {
              dao.sync(x, getTextsPerCall());
            } catch ( Throwable t ) {
              // Two calls in a row failed: the provider is down, e.g. none is
              // configured, and every other record would fail the same way.
              Loggers.logger(x, this).warning("Embedding sync stopped, retried on the next sync", dao.getName(), t);
              setDown_(true);
              return;
            }
          }
          setDown_(false);
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
