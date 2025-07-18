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
    'foam.lang.Agency',
    'foam.lang.AgencyTimerTask',
    'foam.lang.ContextAwareSupport',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.dao.AbstractDAO',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.dao.MapDAO',
    'foam.dao.Sink',
    'foam.log.LogLevel',
    'foam.mlang.MLang',
    'foam.mlang.sink.Min',
    'foam.core.alarming.Alarm',
    'foam.core.alarming.AlarmReason',
    'foam.core.auth.EnabledAware',
    'foam.core.cron.SimpleIntervalSchedule',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.COREService',
    'foam.core.script.ScriptStatus',
    'java.util.Date',
    'java.util.Timer'
  ],

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
    }
  ],

  methods: [
    {
      documentation: 'COREService implementation.',
      name: 'start',
      javaCode: `
      Loggers.logger(getX(), this).info("start");
      Timer timer = new Timer(this.getClass().getSimpleName());
      timer.schedule(
        new AgencyTimerTask(getX(), this),
        getInitialTimerDelay());
      `
    },
    {
      documentation: 'Get the minimum scheduled cron job',
      name: 'getMinScheduledTime',
      type: 'DateTime',
      javaCode: `
    Min min = (Min) ((DAO) getX().get(getCronJobDAO()))
      .where(
        MLang.AND(
          MLang.EQ(Cron.ENABLED, true),
          MLang.HAS(Cron.SCHEDULED_TIME)
        ))
      .select(MLang.MIN(Cron.SCHEDULED_TIME));

    if ( min.getValue().equals(0) ) {
      return null;
    }

    return (Date) min.getValue();
      `
    },
    {
      name: 'execute',
      javaCode: `
    final Logger logger = Loggers.logger(x, this);
    try {
      logger.info("initialize", "cronjobs", "start");
      DAO schedulableDAO = (DAO) getX().get(getSchedulableDAO());
      schedulableDAO.where(MLang.EQ(Schedulable.ENABLED, true)).
        select(new Sink() {
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
            ((DAO) x.get(getCronJobDAO())).put(schedulable);
          }
          public void remove(Object obj, Detachable sub) {}
          public void eof() {}
          public void reset(Detachable sub) {}
        });
      logger.info("initialize", "cronjobs", "complete");

      while ( true ) {
        if ( getEnabled() ) {
          Date now = new Date();
          DAO cronJobDAO = (DAO) x.get(getCronJobDAO());
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

          cronJobDAO.where(
                         MLang.AND(
                                   MLang.LTE(Cron.SCHEDULED_TIME, now),
                                   MLang.EQ(Cron.ENABLED, true),
                                   MLang.IN(Cron.STATUS, new ScriptStatus[] {
                                                          ScriptStatus.UNSCHEDULED,
                                                          ScriptStatus.ERROR,
                                     })
                                   )
                         )
            .orderBy(Cron.SCHEDULED_TIME)
            .select(new AbstractSink() {
                             @Override
                             public void put(Object obj, Detachable sub) {
                               Cron cron = (Cron) ((FObject) obj).fclone();
                               try {
                                 if ( cron.canRun(x) ) {
                                   cron.setStatus(ScriptStatus.SCHEDULED);
                                   cronJobDAO.put_(x, cron);
                                 }
                               } catch (Throwable t) {
                                 logger.error("Unable to schedule cron job", cron.getId(), t.getMessage(), t);
                                 Alarm alarm = new Alarm("CronScheduler - Unabled to schedule");
                                 alarm.setSeverity(LogLevel.ERROR);
                                 alarm.setReason(AlarmReason.CONFIGURATION);
                                 alarm.setNote(cron.getId()+"\\n"+t.getMessage());
                                 ((DAO) x.get("alarmDAO")).put(alarm);
                               }
                             }
                           });
        }
        // Check for new cronjobs every 5 seconds if no current jobs
        // or if their next scheduled execution time is > 5s away
        // Delay at least a little bit to avoid blocking in case of a script error.
        long delay = getCronDelay();
        Date minScheduledTime = getMinScheduledTime();
        if( minScheduledTime != null &&
            getEnabled() ) {
          delay = Math.abs(minScheduledTime.getTime() - System.currentTimeMillis());
          delay = Math.min(getCronDelay(), delay);
          delay = Math.max(500, delay);
        }
        Thread.sleep(delay);
      }
    } catch (Throwable t) {
      logger.error(t.getMessage(), t);
      ((DAO) x.get("alarmDAO")).put(new foam.core.alarming.Alarm.Builder(x)
        .setName("CronScheduler")
        .setSeverity(foam.log.LogLevel.ERROR)
        .setNote(t.getMessage())
        .build());
    }
    `
    }
  ]
});
