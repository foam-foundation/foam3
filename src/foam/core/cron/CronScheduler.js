/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cron',
  name: 'CronScheduler',

  implements: [
    'foam.lang.ContextAgent',
    'foam.core.auth.EnabledAware',
    'foam.core.COREService'
  ],

  documentation: ``,

  javaImports: [
    'foam.core.COREService',
    'foam.core.auth.EnabledAware',
    'foam.core.cron.SimpleIntervalSchedule',
    'foam.core.er.EventRecord',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.script.ScriptStatus',
    'foam.dao.AbstractDAO',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.MapDAO',
    'foam.dao.Sink',
    'foam.lang.Agency',
    'foam.lang.AgencyTimerTask',
    'foam.lang.ContextAwareSupport',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.log.LogLevel',
    'foam.mlang.MLang',
    'foam.mlang.sink.Min',
    'foam.mlang.sink.Sequence',
    'java.util.Date',
    'java.util.List',
    'java.util.Timer',
    'java.util.concurrent.atomic.AtomicBoolean'
  ],

  javaCode: `
  AtomicBoolean running_ = new AtomicBoolean();
  Object lock_           = new Object();
  `,

  properties: [
    {
      name: 'cronDelay',
      class: 'Long',
      value: 5000
    },
    {
      name: 'initialTimerDelay',
      class: 'Long',
      value: 60000
    },
    {
      name: 'schedulableDAO',
      class: 'String',
      value: 'schedulableDAO',
      documentation: `
        move existing schedulables to cronJobDAO
      `
    },
    {
      name: 'cronJobDAO',
      class: 'String',
      value: 'localCronJobDAO'
    },
    {
      name: 'enabled',
      class: 'Boolean',
      value: true
    },
    {
      name: 'timer',
      class: 'Object',
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      documentation: 'COREService implementation.',
      name: 'start',
      javaCode: `
      Loggers.logger(getX(), this).info("start");
      Timer timer = new Timer(this.getClass().getSimpleName());
      setTimer(timer);
      timer.schedule(
        new AgencyTimerTask(getX(), this),
        getInitialTimerDelay());
      `
    },
    {
      name: 'stop',
      javaCode: `
      synchronized ( lock_ ) {
        running_.set(false);
        Timer timer = (Timer) getTimer();
        if ( timer != null )
          timer.cancel();
      }
      `
    },
    {
      name: 'execute',
      javaCode: `
    final Logger logger = Loggers.logger(x, this);
    synchronized ( lock_ ) {
      if ( running_.get() ) {
        logger.warning("already running");
        return;
      }
      running_.set(true);
    }

    try {
      logger.info("initialize", "cronjobs", "start");
      DAO cronJobDAO = (DAO) x.get(getCronJobDAO());
      DAO schedulableDAO = (DAO) getX().get(getSchedulableDAO());
      schedulableDAO.where(MLang.EQ(Schedulable.ENABLED, true)).
        select(new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) {
            Schedulable schedulable = (Schedulable) ((FObject) obj).fclone();
            Date from = schedulable.getLastRun();
            if ( from == null ) from = new Date();
            schedulable.setScheduledTime(
              ((SimpleIntervalSchedule) schedulable.getSchedule()).
                calculateNextDate(
                  foam.lang.XLocator.get(),
                  from,
                  true
                )
            );
            cronJobDAO.put_(x, schedulable);
          }
        });

      // On startup calculate next scheduledTime
      cronJobDAO.where(
        MLang.AND(
          MLang.EQ(Cron.ENABLED, true),
          MLang.IN(Cron.STATUS, new ScriptStatus[] {
            ScriptStatus.UNSCHEDULED,
            ScriptStatus.ERROR
          })
        )
      ).select(new AbstractSink() {
        @Override
        public void put(Object obj, Detachable sub) {
          cronJobDAO.put_(x, (Cron) obj);
        }
      });

      logger.info("initialize", "cronjobs", "complete");

      while ( running_.get() ) {
        long delay = getCronDelay();
        if ( getEnabled() ) {
          Date now = new Date();
          cronJobDAO.where(
            MLang.AND(
              MLang.EQ(Cron.STATUS, ScriptStatus.RUNNING),
              MLang.GT(Cron.THREAD_TIMEOUT, 0)
            )
          ).select(new AbstractSink() {
            @Override
            public void put(Object obj, Detachable sub) {
              Cron cron = (Cron) ((FObject) obj).fclone();
              long elapsed = System.currentTimeMillis() - cron.getThreadStartTime();
              if ( elapsed > cron.getThreadTimeout() ) {
                cron.setStatus(ScriptStatus.INTERRUPTED);
                cronJobDAO.put_(x, cron);
              }
            }
          });

          Min min = (Min) MLang.MIN(Cron.SCHEDULED_TIME);
          ArraySink arraySink = new ArraySink();
          cronJobDAO.where(
            MLang.AND(
              MLang.EQ(Cron.ENABLED, true),
              MLang.LTE(Cron.SCHEDULED_TIME, now),
              MLang.IN(Cron.STATUS, new ScriptStatus[] {
                ScriptStatus.UNSCHEDULED,
                ScriptStatus.ERROR
              }))
          ).select(new Sequence.Builder(x).setArgs(new Sink[] {
            min,
            new AbstractSink() {
              @Override
              public void put(Object obj, Detachable sub) {
                Cron cron = (Cron) obj;
                if ( cron.canRun(x) ) {
                  cron = (Cron) cron.fclone();
                  cron.setStatus(ScriptStatus.SCHEDULED);
                  try {
                    cronJobDAO.put_(x, cron);
                  } catch ( Throwable t ) {
                    ((DAO) x.get("eventRecordDAO")).put(new EventRecord(x, this, "schedule", cron.getId(), LogLevel.ERROR, t));
                  }
                }
              }
            }
          }).build());

          // Check for new cronjobs every 5 seconds if no current jobs
          // or if their next scheduled execution time is > 5s away
          // Delay at least a little bit to avoid blocking in case of a script error.
          Date minDate = (Date) min.getValue();
          if( minDate != null &&
              getEnabled() ) {
            delay = Math.abs(minDate.getTime() - System.currentTimeMillis());
            delay = Math.min(getCronDelay(), delay);
            delay = Math.max(500, delay);
          }
        }
        try {
          Thread.sleep(delay);
        } catch ( InterruptedException e ) {
          // noop, do not kill cron scheduler since we now support cron timeout via interrupt
        }
      }
    } catch (Throwable t) {
      ((DAO) x.get("eventRecordDAO")).put(new EventRecord(x, this, "execute", null, LogLevel.ERROR, t));
    }
    `
    }
  ]
});
