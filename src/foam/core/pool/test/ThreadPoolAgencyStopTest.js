/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.pool.test',
  name: 'ThreadPoolAgencyStopTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Proves ThreadPoolAgency.stop(), which the shutdown hook calls, interrupts
    running tasks and waits for them to finish, up to shutdownTimeout.

    Pool threads are daemons, so without the wait the JVM halts a task in the
    middle of undoing its partial work.
  `,

  javaImports: [
    'foam.core.pool.ThreadPoolAgency',
    'java.util.concurrent.CountDownLatch',
    'java.util.concurrent.TimeUnit',
    'java.util.concurrent.atomic.AtomicBoolean'
  ],

  constants: [
    {
      name: 'SHUTDOWN_TIMEOUT',
      type: 'Long',
      value: 1500
    }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        stopWaitsForCleanup(x);
        stopGivesUpAtTimeout(x);
      `
    },
    {
      // One thread: the first task runs and the second waits in the queue.
      name: 'stopWaitsForCleanup',
      args: 'Context x',
      javaCode: `
        ThreadPoolAgency agency = startAgency(x);
        CountDownLatch started   = new CountDownLatch(1);
        AtomicBoolean  cleanedUp = new AtomicBoolean();
        AtomicBoolean  queuedRan = new AtomicBoolean();

        // Sleeps until interrupted, then takes 300 ms to undo its work.
        agency.submit(x, (_x) -> {
          started.countDown();
          try {
            Thread.sleep(60000);
          } catch (InterruptedException e) {
            try {
              Thread.sleep(300);
            } catch (InterruptedException e2) {
              return;
            }
            cleanedUp.set(true);
          }
        }, "cooperative");
        agency.submit(x, (_x) -> queuedRan.set(true), "queued");
        test(awaitStart(started), "cooperative task is running");

        long start = System.currentTimeMillis();
        agency.stop();
        long elapsed = System.currentTimeMillis() - start;
        test(elapsed < SHUTDOWN_TIMEOUT, "stop returned once the cooperative task finished, elapsed " + elapsed + " ms");
        test(cleanedUp.get(), "cooperative task finished its cleanup before stop returned");
        test(! queuedRan.get(), "queued task never ran");
      `
    },
    {
      name: 'stopGivesUpAtTimeout',
      args: 'Context x',
      javaCode: `
        ThreadPoolAgency agency = startAgency(x);
        CountDownLatch started  = new CountDownLatch(1);
        AtomicBoolean  finished = new AtomicBoolean();

        // Catches every interrupt and keeps going for 4 s, longer than SHUTDOWN_TIMEOUT.
        agency.submit(x, (_x) -> {
          started.countDown();
          long end = System.currentTimeMillis() + 4000;
          while ( System.currentTimeMillis() < end ) {
            try {
              Thread.sleep(50);
            } catch (InterruptedException e) {
              // swallowed on purpose
            }
          }
          finished.set(true);
        }, "swallowing");
        test(awaitStart(started), "swallowing task is running");

        long start = System.currentTimeMillis();
        agency.stop();
        long elapsed = System.currentTimeMillis() - start;
        test(elapsed >= SHUTDOWN_TIMEOUT && elapsed < 4000, "stop gave up after shutdownTimeout, elapsed " + elapsed + " ms");
        test(! finished.get(), "swallowing task was still running when stop returned");
      `
    },
    {
      name: 'startAgency',
      args: 'Context x',
      javaType: 'ThreadPoolAgency',
      javaCode: `
        ThreadPoolAgency agency = new ThreadPoolAgency.Builder(x)
          .setPrefix("stop-test")
          .setNumberOfThreads(1)
          .setShutdownTimeout(SHUTDOWN_TIMEOUT)
          .build();
        try {
          agency.start();
        } catch (Exception e) {
          throw new RuntimeException(e);
        }
        return agency;
      `
    },
    {
      name: 'awaitStart',
      args: [ { name: 'latch', javaType: 'java.util.concurrent.CountDownLatch' } ],
      javaType: 'boolean',
      javaCode: `
        try {
          return latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
          return false;
        }
      `
    }
  ]
});
