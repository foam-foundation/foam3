/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.bench',
  name: 'BenchmarkRunner',
  extends: 'foam.core.script.Script',
  classIsFinal: false,

  implements: [
    'foam.lang.ContextAgent',
    'foam.lang.ContextAware'
  ],

  imports: [
    'benchmarkResultDAO'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.dao.DAO',
    'foam.lib.csv.CSVOutputter',
    'foam.lib.csv.CSVOutputterImpl',
    'foam.log.LogLevel',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.IN',
    'foam.mlang.sink.Average',
    'foam.core.app.AppConfig',
    'foam.core.app.Mode',
    'foam.core.auth.Subject',
    'foam.core.logger.Logger',
    'foam.core.logger.LogLevelFilterLogger',
    'foam.core.logger.Loggers',
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.ProxyLogger',
    'foam.core.logger.StdoutLogger',
    'foam.core.pm.PM',
    'foam.core.pm.PMInfo',
    'foam.core.pm.PMInfoId',
    'foam.core.script.BeanShellExecutor',
    'foam.core.script.JShellExecutor',
    'foam.core.script.Language',
    'foam.core.script.ScriptEvent',
    'foam.core.script.ScriptStatus',
    'foam.util.SafetyUtil',
    'foam.util.UIDGenerator',
    'foam.util.AUIDGenerator',
    'java.io.IOException',
    'java.math.BigDecimal',
    'java.math.RoundingMode',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map',
    'java.util.Set',
    'java.util.concurrent.CountDownLatch',
    'java.util.concurrent.ConcurrentHashMap',
    'java.util.concurrent.atomic.AtomicLong'
  ],

  javaCode: `
    // legacy support so not to break 'scripts'. This suppresses
    // output to logger, which results in duplicate output, as
    // this runner already outputs the results.

    public String getResult() {
      return "";
    }

    public String formatResults() {
      return "";
    }
  `,

  sections: [
    {
      name: 'benchmarkResultsSection',
      title: 'Results',
      order: 2
    },
    {
      name: '_defaultSection',
      title: 'Info',
      order: 1
    }
  ],

  tableColumns: [
    'id',
    'lastRun',
    'status',
    'threadCount',
    'runPerThread',
    'executionCount',
    'benchmarkId'
  ],

  constants: [
    {
      documentation: 'Context key to benchmark access to the runner.',
      name: 'RUNNER',
      value: 'RUNNER'
    },
    {
      documentation: 'Context key informating the execute method which Thread number the current run is.',
      name: 'THREAD',
      value: 'THREAD'
    },
    {
      documentation: 'Context key informaing the execute method which execution the current run is.',
      name: 'EXECUTION',
      value: 'EXECUTION'
    }
  ],

  properties: [
    {
      class: 'Int',
      name: 'threadCount',
      value: 4,
      javaFactory: 'return Runtime.getRuntime().availableProcessors();'
    },
    {
      class: 'Boolean',
      name: 'runPerThread'
    },
    {
      class: 'Boolean',
      name: 'reverseThreads'
    },
    {
      class: 'Int',
      name: 'executionCount',
      value: 1000
    },
    {
      class: 'Boolean',
      name: 'clearPMs',
      docmentation: 'clear PMs before executing the benchmark',
    },
    {
      class: 'Boolean',
      name: 'debugLoggingEnabled',
      value: false
    },
    {
      class: 'Boolean',
      name: 'infoLoggingEnabled',
      value: true
    },
    {
      class: 'Boolean',
      name: 'oneTimeSetup'
    },
    {
      class: 'Boolean',
      name: 'oneTimeTeardown'
    },
    {
      class: 'Reference',
      of: 'foam.core.bench.Benchmark',
      name: 'benchmarkId'
    },
    {
      class: 'List',
      name: 'results',
      javaFactory: 'return new ArrayList();',
      storageTransient: true,
      visibility: 'HIDDEN'
    },
    {
      class: 'String',
      name: 'daoKey',
      value: 'benchmarkRunnerDAO',
      transient: true,
      visibility: 'HIDDEN'
    },
    {
      class: 'String',
      name: 'eventDaoKey',
      value: 'benchmarkRunnerEventDAO',
      transient: true,
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'runScript',
      javaCode: `
      Logger logger = (Logger) x.get("logger");
      LogLevelFilterLogger loggerFilter = null;
      while ( logger != null ) {
        if ( logger instanceof LogLevelFilterLogger ) {
          loggerFilter = (LogLevelFilterLogger) logger;
          break;
        }
        if ( logger instanceof ProxyLogger ) {
          logger = ((ProxyLogger) logger).getDelegate();
        } else {
          break;
        }
      }
      if ( loggerFilter == null ) {
        throw new RuntimeException("LogLevelFilterLogger not found");
      }
      boolean savedDebugLoggingEnabled = loggerFilter.getLogDebug();
      boolean savedInfoLoggingEnabled = loggerFilter.getLogInfo();

      long startTime = System.currentTimeMillis();
      try {
        loggerFilter.setLogDebug(getDebugLoggingEnabled());
        loggerFilter.setLogInfo(getInfoLoggingEnabled());

        er(x, "start", LogLevel.INFO, null);
        execute(x.put(RUNNER, this));
      } finally {
        setLastRun(new java.util.Date());
        setLastDuration(System.currentTimeMillis() - startTime);

        ScriptEvent event = new ScriptEvent(x);
        event.setLastRun(this.getLastRun());
        event.setLastDuration(this.getLastDuration());
        event.setOutput(this.getOutput());
        event.setOwner(this.getId());
        event.setScriptId(this.getId());
        event.setHostname(System.getProperty("hostname", "localhost"));
        event.setClusterable(this.getClusterable());
        ((DAO) x.get(getEventDaoKey())).put(event);

        er(x, "end", LogLevel.INFO, null);
        loggerFilter.setLogDebug(savedDebugLoggingEnabled);
        loggerFilter.setLogInfo(savedInfoLoggingEnabled);
      }
      `
    },
    {
      name: 'execute',
      type: 'Void',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
      AppConfig config = (AppConfig) x.get("appConfig");
      if ( config.getMode() == Mode.PRODUCTION ) {
        Loggers.logger(x, this).warning("Benchmark execution disabled in PRODUCTION");
        return;
      }

      final Set<String> pmInfoIds = new ConcurrentHashMap().newKeySet();

      try {
        final Benchmark benchmark = getBenchmark(x);

        Logger log = (Logger) x.get("logger");
        if ( log == null ) {
          log = StdoutLogger.instance();
        }
        final Logger logger = new PrefixLogger(new Object[] {
          this.getClass().getSimpleName(),
          getId(),
          benchmark.getId()
        }, log);
        logger.info("execute");

        AUIDGenerator uidGenerator = new AUIDGenerator.Builder(getX())
            .setSalt("benchmarkResultDAO")
            .build();
        String uid = uidGenerator.getNextString();

        int availableThreads = Math.min(Runtime.getRuntime().availableProcessors(), getThreadCount());
        int run = 1;
        int threads = 1;

        if ( ! getRunPerThread() ||
             reverseThreads_ ) {
          threads = availableThreads;
        }

        if ( getClearPMs() ) {
          ((DAO) x.get("pmInfoDAO")).removeAll();
        }

        boolean setup = false;
        boolean teardown = false;
        while ( true ) {
          final CountDownLatch latch = new CountDownLatch(threads);
          final AtomicLong pass = new AtomicLong();
          final AtomicLong fail = new AtomicLong();
          ThreadGroup group = new ThreadGroup("BenchmarkRunner");
          BenchmarkResult br = new BenchmarkResult();
          br.setUid(uid);
          br.setRun(run);
          br.setHostname(System.getProperty("hostname", "localhost"));
          // br.setName(benchmark.getName());
          br.setName(this.getId());
          br.setThreads(threads);

          final BenchmarkResult finalBr = br;

          if ( getOneTimeSetup() && ! setup ) {
            PM pm = new PM("BenchmarkRunner", benchmark.getId(), "setup");
            try {
              // set up the benchmark
              logger.info("setup");
              benchmark.setup(x, br);
              pm.log(x);
              setup = true;
            } catch (Throwable t) {
              pm.error(x, t.getMessage());
              Throwable e = t;
              if ( t instanceof RuntimeException && t.getCause() != null ) {
                e = t.getCause();
              }
              logger.error("oneTimeSetup", e.getMessage());
              logger.debug(e);
              break;
            }
          }

          // clear timing pms associated with this benchmark runner
          ((DAO) x.get("pmInfoDAO")).where(EQ(PMInfo.KEY, getId())).removeAll();

          // get start time
          long startTime = System.currentTimeMillis();

          // execute all the threads
          for ( int i = 0 ; i < threads ; i++ ) {
            final int tno = i;
            Thread thread = new Thread(group, new Runnable() {
                @Override
                public void run() {
                  pmInfoIds.add(benchmark.getId()+":execute:"+Thread.currentThread().getId());
                  if ( ! getOneTimeSetup() ) {
                    PM pm = new PM(getId(), benchmark.getId(), "setup", Thread.currentThread().getId());
                    try {
                      // set up the benchmark
                      logger.info("setup");
                      benchmark.setup(x, finalBr);
                      pm.log(x);
                    } catch (Throwable t) {
                      pm.error(x, t.getMessage());
                      Throwable e = t;
                      if ( t instanceof RuntimeException && t.getCause() != null ) {
                        e = t.getCause();
                      }
                      logger.error("thread", tno, "setup", e.getMessage());
                      logger.debug(e);
                      fail.incrementAndGet();
                      latch.countDown();
                      return;
                    }
                  }

                  long passed = 0;
                  for ( int j = 0 ; j < getExecutionCount() ; j++ ) {
                    PM pm = new PM(getId(), benchmark.getId(), "execute", Thread.currentThread().getId());
                    X savedX = XLocator.get();
                    try {
                      X y = x.put(THREAD, tno).put(EXECUTION, j);
                      XLocator.set(y);
                      benchmark.execute(y);
                      passed++;
                    } catch (Throwable t) {
                      pm.error(x, t.getMessage());
                      fail.incrementAndGet();
                      Throwable e = t;
                      if ( t instanceof RuntimeException && t.getCause() != null ) {
                        e = t.getCause();
                      }
                      logger.error("thread", tno, "execution", j, e.getMessage());
                      logger.debug(e);
                    } finally {
                      pm.log(x);
                      XLocator.set(savedX);
                    }
                  }
                  pass.addAndGet(passed++);

                  // count down the latch when finished
                  latch.countDown();

                  if ( ! getOneTimeTeardown() ) {
                    logger.info("teardown");
                    benchmark.teardown(x, finalBr);
                  }
                }
              }) {
                @Override
                public String toString() {
                  return getId() + "-Thread " + tno;
                }
              };
            // start the thread
            thread.start();
          }

          // wait until latch reaches 0
          try {
            latch.await();
          } catch (InterruptedException e) {
            break;
          }

          // calculate length taken
          // get number of threads completed and duration
          // print out transactions per second
          long endTime = System.currentTimeMillis();

          Average avg = new Average(x, PMInfo.TOTAL_TIME, 0.0, 0L, -1);
          ((DAO) x.get("pmInfoDAO"))
            .where(
              AND(
                EQ(PMInfo.KEY, getId()),
                IN(PMInfo.NAME, pmInfoIds.toArray(new String[pmInfoIds.size()]))
              )
            ).select(avg);

          // long time = endTime - startTime;
          double time = (double) avg.getValue();
          float complete = (float) (threads * getExecutionCount());
          float duration = (float) (time / 1000.0f);
          br.setPass(pass.get());
          br.setFail(fail.get());
          br.setTotal(pass.get() + fail.get());
          try {
            br.setOperationsS(new BigDecimal((complete / duration)).setScale(2, RoundingMode.HALF_UP).floatValue());
            br.setOperationsST(new BigDecimal((complete / duration) / (float) threads).setScale(2, RoundingMode.HALF_UP).floatValue());
          } catch (NumberFormatException e) {
            // occurs on tiny execution times
          }
          if ( getOneTimeTeardown() && ! teardown ) {
            logger.info("teardown");
            benchmark.teardown(x, br);
            teardown = true;
          }

          br = (BenchmarkResult) getBenchmarkResults(x).put(br);

          getResults().add(br);

          String results = formatResults(x, getResults());
          setOutput(results);
          logger.info(results);

          if ( getRunPerThread() ) {
            if ( reverseThreads_ ) {
              threads--;
            } else {
              threads++;
            }

            if ( threads <= 0 || threads > availableThreads ) {
              break;
            }

            run++;
          } else {
            break;
          }
        }
      } catch (Throwable e) {
        throw new RuntimeException(e);
      }
      `
    },
    {
      name: 'formatResults',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'results',
          type: 'java.util.List'
        }
      ],
      type: 'String',
      javaCode: `
      StringBuilder csv = new StringBuilder();
      csv.append(getId());
      csv.append(",");
      csv.append(new java.util.Date().toString());
      csv.append("\\n");

      if ( results == null ||
           results.size() == 0 ) {
        csv.append("no results\\n");
        return csv.toString();
      }

      CSVOutputter out = new CSVOutputterImpl.Builder(getX())
        .setOf(BenchmarkResult.getOwnClassInfo())
        .build();
      for ( BenchmarkResult br : ((List<BenchmarkResult>)results) ) {
        out.outputFObject(x, br);
      }

      csv.append(out.toString());

      return csv.toString();
      `
    },
    {
      name: 'getBenchmark',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      type: 'foam.core.bench.Benchmark',
      javaCode: `
        if ( ! SafetyUtil.isEmpty(getBenchmarkId()) ) {
          Benchmark benchmark = (Benchmark) ((DAO) x.get("benchmarkDAO")).find(getBenchmarkId());
          if ( benchmark != null )
            return (Benchmark) benchmark.fclone();
          else if ( SafetyUtil.isEmpty(getCode()) )
            throw new RuntimeException("Benchmark not found "+getBenchmarkId());
        }

        Language l = getLanguage();
        if ( l == foam.core.script.Language.JSHELL )
          return (Benchmark) new JShellExecutor().runExecutor(x, null, getCode());
        else if ( l == foam.core.script.Language.BEANSHELL )
          return (Benchmark) new BeanShellExecutor(null).execute(x, null, getCode());
        else
          throw new RuntimeException("Script language not supported");
      `,
      javaThrows: [
        'java.lang.ClassNotFoundException',
        'java.lang.InstantiationException',
        'java.lang.IllegalAccessException',
        'SecurityException',
        'NoSuchFieldException',
        'IOException',
        'Exception'
      ]
    }
  ]
});
