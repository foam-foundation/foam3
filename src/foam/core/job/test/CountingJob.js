/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job.test',
  name: 'CountingJob',
  extends: 'foam.core.job.Job',

  documentation: `Job whose only work is to record that it ran, under its tag, so a test can tell
    one run from two, see the order Jobs ran in, and see whether two Jobs ran at the same time.`,

  properties: [
    {
      class: 'String',
      name: 'tag'
    },
    {
      documentation: 'Jobs with the same overlapKey are checked for running at the same time.',
      class: 'String',
      name: 'overlapKey'
    },
    {
      documentation: 'How long the Job takes, in milliseconds.',
      class: 'Int',
      name: 'sleepMs'
    },
    {
      documentation: 'When true the Job throws after it has recorded its run.',
      class: 'Boolean',
      name: 'fails'
    },
    {
      documentation: 'When true the write that marks the Job RUNNING throws, as a jobDAO that is down would.',
      class: 'Boolean',
      name: 'saveFails'
    }
  ],

  javaCode: `
    public static final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger> RUNS =
      new java.util.concurrent.ConcurrentHashMap<>();
    public static final java.util.concurrent.CopyOnWriteArrayList<String> ORDER =
      new java.util.concurrent.CopyOnWriteArrayList<>();
    public static final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger> ACTIVE =
      new java.util.concurrent.ConcurrentHashMap<>();
    public static final java.util.Set<String> OVERLAPPED =
      java.util.concurrent.ConcurrentHashMap.newKeySet();
  `,

  methods: [
    {
      name: 'save',
      args: 'foam.lang.X x',
      javaCode: `
        if ( getSaveFails() && getStatus() == foam.core.job.JobStatus.RUNNING )
          throw new RuntimeException("CountingJob " + getTag() + " cannot be saved");
        super.save(x);
      `
    },
    {
      name: 'execute',
      javaCode: `
        RUNS.computeIfAbsent(getTag(), k -> new java.util.concurrent.atomic.AtomicInteger()).incrementAndGet();
        ORDER.add(getTag());

        java.util.concurrent.atomic.AtomicInteger active =
          ACTIVE.computeIfAbsent(getOverlapKey(), k -> new java.util.concurrent.atomic.AtomicInteger());
        if ( active.incrementAndGet() > 1 ) OVERLAPPED.add(getOverlapKey());
        try {
          if ( getSleepMs() > 0 ) Thread.sleep(getSleepMs());
        } catch ( InterruptedException e ) {
          Thread.currentThread().interrupt();
        } finally {
          active.decrementAndGet();
        }

        if ( getFails() ) throw new RuntimeException("CountingJob " + getTag() + " fails");
      `
    }
  ]
});
