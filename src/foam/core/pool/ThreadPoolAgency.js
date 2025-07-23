/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.pool',
  name: 'ThreadPoolAgency',
  extends: 'foam.core.pool.AbstractFixedThreadPool',

  implements: [
    'foam.lang.ContextAgent',
    'foam.core.COREService'
  ],

  documentation: ``,

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.ContextAgentTimerTask',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.lang.ProxyX',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'java.util.concurrent.LinkedBlockingQueue',
    'java.util.concurrent.ExecutorService',
    'java.util.concurrent.Executors',
    'java.util.concurrent.RejectedExecutionException',
    'java.util.concurrent.ThreadFactory',
    'java.util.concurrent.ThreadPoolExecutor',
    'java.util.concurrent.TimeUnit',
    'java.util.concurrent.atomic.AtomicInteger',
    'java.util.Timer'
  ],

  javaCode: `
    protected ThreadPoolExecutor pool_          = null;
    protected Object             queuedLock_    = new Object();
    protected Object             executingLock_ = new Object();
    protected Object             executedLock_  = new Object();
    protected ThreadGroup        threadGroup_   = null;

    protected class ContextAgentRunnable
      implements Runnable {

      protected X            x_;
      protected ContextAgent agent_;
      protected String       description_;

      public ContextAgentRunnable(X x, ContextAgent agent, String description) {
        x_ = x;
        agent_ = agent;
        description_ = description;
      }

      public void run() {
        incrExecuting(1);
        incrQueued(-1);

        PM pm = PM.create(x_, this.getClass(), agent_.getClass().getSimpleName() + ":" + description_);

        X oldX = ((ProxyX) XLocator.get()).getX();

        try {
          XLocator.set(x_);
          agent_.execute(x_);
        } catch (Throwable t) {
          Loggers.logger(x_, this).error(agent_.getClass().getSimpleName(), description_, t.getMessage(), t);
        } finally {
          XLocator.set(oldX);
          incrExecuting(-1);
          incrExecuted();
          pm.log(x_);
        }
      }
    }
  `,

  properties: [
    {
      documentation: 'report stats when true',
      name: 'reportingEnabled',
      class: 'Boolean'
    },
    {
      name: 'reportInterval',
      class: 'Long',
      value: 30000
    },
    {
      name: 'stackDepth',
      class: 'Int',
      value: 10
    },
    {
      name: 'timer',
      class: 'Object',
      hidden: true,
      transient: true
    }
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
    Loggers.logger(getX(), this).info(getPrefix(), "start");
    initThreadPool();
    scheduleReporting();
    `
    },
    {
      name: 'stop',
      javaCode: `
        getPool().shutdownNow();
        synchronized ( queuedLock_ ) {
          clearQueued();
        }
        synchronized ( executedLock_ ) {
          clearExecuted();
        }
        synchronized ( executingLock_ ) {
          clearExecuting();
        }
      `
    },
    {
      name: 'reload',
      javaCode: `
      stop();
      Loggers.logger(getX(), this).info(getPrefix(), "reload");
      initThreadPool();
      scheduleReporting();
      `
    },
    {
      name: 'scheduleReporting',
      javaCode: `
    if ( getReportingEnabled() ) {
      Timer timer = new java.util.Timer(this.getClass().getSimpleName(), true);
      setTimer(timer);
      timer.schedule(new ContextAgentTimerTask(getX(), this), getReportInterval());
    } else {
      Timer timer = (Timer) getTimer();
      if ( timer != null ) {
        timer.cancel();
        setTimer(null);
      }
    }
    `
    },
    {
      name: 'incrExecuting',
      args: [
        {
          name: 'd',
          type: 'int'
        }
      ],
      javaCode: `
    synchronized ( executingLock_ ) {
      setExecuting(getExecuting() + d);
    }
      `
    },
    {
      name: 'incrExecuted',
      javaCode: `
    synchronized ( executingLock_ ) {
      setExecuted(getExecuted() + 1);
    }
      `
    },
    {
      name: 'incrQueued',
      args: [
        {
          name: 'd',
          type: 'int'
        }
      ],
      javaCode: `
    synchronized ( queuedLock_ ) {
      setQueued(getQueued() + d);
    }
      `
    },
    {
      name: 'getPool',
      type: 'ExecutorService',
      javaCode: `
    return pool_;
      `
    },
    {
      name: 'submit',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'agent',
          type: 'foam.lang.ContextAgent'
        },
        {
          name: 'description',
          type: 'String'
        }
      ],
      javaCode: `
    incrQueued(1);
    return getPool().submit(new ContextAgentRunnable(x, agent, description));
     `
    },
    {
      documentation: 'Best effort at reporting what threads are waiting on. Only reports stack frames with foam in the class path.',
      name: 'getWaiting',
      type: 'Long',
      javaCode: `
      if ( getStackDepth() == 0 ) return -1;

      long waiting = 0;
      try {
        Thread[] threads = new Thread[threadGroup_.activeCount()];
        int count = threadGroup_.enumerate(threads);
        Logger logger = Loggers.logger(getX(), this);
        for ( int i = 0; i < count; i++ ) {
          Thread thread = threads[i];
          if ( thread.getState() == Thread.State.WAITING ) {
            waiting++;
            int depth = 0;
            logger.info(getPrefix(), "thread", thread.getId(), thread.getName(), "WAITING", "stack");
            StackTraceElement[] stackTraceElement = thread.getStackTrace();
            StackTraceElement element = null;
            for ( int j = 0; j < stackTraceElement.length; j++ ) {
              element = stackTraceElement[j];
              if ( element.getClassName().contains("foam") ) {
                if ( depth == 0 &&
                     j > 0 ) {
                  // last java library entry for context
                  System.out.println(stackTraceElement[j-1]);
                }
                System.out.println(element);
                depth++;
              }

              if ( depth > getStackDepth() ) {
                break;
              }
            }
            // foam not in the stack frames, report last java frame
            if ( depth == 0 ) {
              System.out.println(element);
            }
          }
        }
      } catch ( Throwable t ) {
        t.printStackTrace();
      }
      return waiting;
      `
    },
    {
      name: 'execute',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
      Loggers.logger(x, this).info(getPrefix(), "available", getNumberOfThreads(), "queued", getQueued(), "waiting", getWaiting(), "executing", getExecuting(), "executed", getExecuted());
      scheduleReporting();
      `
    },
    {
      name: 'initThreadPool',
      type: 'Void',
      visibility: 'protected',
      javaCode: `
        threadGroup_ = new ThreadGroup(Thread.currentThread().getThreadGroup(), getPrefix());
        pool_ = new ThreadPoolExecutor(
          getNumberOfThreads(),
          getNumberOfThreads(),
          10,
          TimeUnit.SECONDS,
          new LinkedBlockingQueue<Runnable>(),
          new ThreadFactory() {
            final AtomicInteger threadNumber = new AtomicInteger(1);

            public Thread newThread(Runnable runnable) {
              Thread thread = new Thread(
                threadGroup_,
                runnable,
                getPrefix() + "-" + threadNumber.getAndIncrement(),
                0
                );
              // Thread does not block server from shut down.
              thread.setDaemon(true);
              thread.setPriority(Thread.NORM_PRIORITY);
              return thread;
            }
          }
        );
        pool_.allowCoreThreadTimeOut(true);

      `
    }
  ]
});
