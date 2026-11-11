/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.alarming',
  name: 'AlarmAndMonitoring',

  documentation: `Raises an alarm if certain conditions are met. See Alarm.md,
  section Alarming and Monitoring.`,

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.analytics.Candlestick',
    'foam.core.er.EventRecord',
    'foam.log.LogLevel',
    'foam.util.SafetyUtil',
    'foam.mlang.sink.Sum',
    'java.util.Date',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.GT',
    'static foam.mlang.MLang.LTE',
    'static foam.mlang.MLang.SUM'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
      agency.submit(x, new ContextAgent() {
        @Override
        public void execute(X x) {
          DAO configDAO = (DAO) x.get("alarmConfigDAO");
          MonitoringReport report = (MonitoringReport) obj;
          AlarmConfig config = (AlarmConfig) configDAO.find(report.getName());

          if ( config == null || ! config.getEnabled() ) {
            return;
          }

          DAO omDAO = (DAO) ( config.getUseCCOMLogger() ? x.get("localCcom1MinuteDAO") : x.get("om1MinuteDAO") );
          if ( omDAO == null ) {
            // Force OM DAO if CCOM DAO is not enabled
            omDAO = (DAO) x.get("om1MinuteDAO");
          }

          // Every count comes from the same complete minutes. A
          // candlestick closes on the last millisecond of its minute, so
          // the 12:00 one closes at 12:00:59.999. Reading each OM's latest
          // candlestick on its own, a run at 12:01:00.3 took requests from
          // the partial 12:01 minute and timeouts from 12:00, and could
          // raise an alarm that neither minute earned. The latest
          // candlestick also stays in the DAO until its OM is logged again,
          // so a burst of timeouts kept counting long after it ended. The
          // window ends at the last complete minute and spans cycleTime, so
          // the default 60 s reads exactly one minute.
          long end = System.currentTimeMillis() / 60000 * 60000 - 1;
          Date to = new Date(end);
          Date from = new Date(end - config.getCycleTime());
          report.setStartCount(AlarmAndMonitoring.this.sumCount(omDAO, config.getPreRequest(), from, to));
          report.setEndCount(AlarmAndMonitoring.this.sumCount(omDAO, config.getPostRequest(), from, to));
          report.setTimeoutCount(AlarmAndMonitoring.this.sumCount(omDAO, config.getTimeOutRequest(), from, to));

          // With no attempts in the window no check can trip, so an active
          // alarm would clear. Timeouts logged a minute after the last
          // request, once traffic stops, would clear a TIMEOUT alarm that
          // nothing has resolved. Leave the alarm as it is until a request
          // is logged.
          if ( report.getStartCount() == 0 ) {
            return;
          }

          float timeoutCount = report.getTimeoutCount();
          float sentCount = report.getStartCount();
          float responseCount = report.getEndCount();

          AlarmReason reason = null;
          if ( config.getMonitorType() == MonitorType.CREDENTIALS ) {
            reason = AlarmAndMonitoring.this.checkCredentials(x, config, report);
          } else if ( timeoutCount > 0 && sentCount > 0  && (timeoutCount / sentCount) > (float) config.getTimeoutValue() / 100 ) {
            reason = AlarmReason.TIMEOUT;
          } else if (( config.getMonitorType() == MonitorType.CONTROLCHECK ||
                      config.getMonitorType() == MonitorType.CONGESTION ) &&
                      sentCount > 0  &&
                      (responseCount / sentCount) < (float) config.getAlarmValue() / 100 ) {
            reason = config.getMonitorType() == MonitorType.CONTROLCHECK ? AlarmReason.CONTROLCHECK : AlarmReason.CONGESTION;
          } else if ( config.getMonitorType() == MonitorType.THRESHOLD && sentCount > config.getAlarmValue() ) {
            reason = AlarmReason.THRESHOLD;
          }

          // The alarm is raised and cleared through an EventRecord, so its
          // rules send the notifications. An EventRecord is put only when
          // the alarm changes state: this runs every cycle, and an ERROR
          // EventRecord on every cycle would send a notification each time.
          Alarm alarm = (Alarm) ((DAO) x.get("alarmDAO")).find(EQ(Alarm.NAME, config.getName()));
          boolean active = alarm != null && alarm.getIsActive();
          // A config below WARN raises no alarm, so the alarm never turns
          // on and an INFO config that trips would put a record every
          // cycle. Leave it alone instead.
          if ( reason != null && ! active &&
               config.getSeverity().getOrdinal() >= LogLevel.WARN.getOrdinal() ) {
            AlarmAndMonitoring.this.putEventRecord(x, config, report, reason, config.getSeverity());
          } else if ( reason == null && active ) {
            AlarmAndMonitoring.this.putEventRecord(x, config, report, null, LogLevel.INFO);
          }
        }
      }, "Alarm And Monitoring");
      `
    },
    {
      documentation: `Puts an EventRecord whose alarm name, the event, is the
        config's name. EventRecordAlarmRuleAction raises the alarm at its
        alarmSeverity, WARN, and clears it at INFO;
        EventRecordNotificationRuleAction notifies on the raise and the clear
        only when the config's severity is ERROR. The message holds the
        AlarmReason, when raising, and the counts behind the decision.
        The code stays empty: it is part of the alarm name, and the clear
        must name the same alarm as the raise whatever the reason was.`,
      name: 'putEventRecord',
      args: 'X x, foam.core.alarming.AlarmConfig config, foam.core.alarming.MonitoringReport report, foam.core.alarming.AlarmReason reason, foam.log.LogLevel severity',
      javaCode: `
      String message = ( reason != null ? reason.getName() + ", " : "" ) +
        "attempts: " + report.getStartCount() +
        ", responses: " + report.getEndCount() +
        ", failures: " + report.getTimeoutCount();
      EventRecord er = new EventRecord(x, null, config.getName(), null, null, message, severity, null);
      er.setClusterable(config.getClusterable());
      ((DAO) x.get("eventRecordDAO")).put(er);
      `
    },
    {
      documentation: `Returns the count of the candlesticks of key that closed
        after from and at or before to, 0 when key is empty.`,
      name: 'sumCount',
      type: 'Integer',
      args: 'DAO omDAO, String key, Date from, Date to',
      javaCode: `
      if ( SafetyUtil.isEmpty(key) ) return 0;
      Sum sum = (Sum) omDAO.where(AND(
        EQ(Candlestick.KEY, key),
        GT(Candlestick.CLOSE_TIME, from),
        LTE(Candlestick.CLOSE_TIME, to)
      )).select(SUM(Candlestick.COUNT));
      return (int) sum.getValue();
      `
    },
    {
      documentation: 'Returns CREDENTIALS when the alarm should be on, otherwise null.',
      name: 'checkCredentials',
      type: 'foam.core.alarming.AlarmReason',
      args: 'X x, foam.core.alarming.AlarmConfig config, foam.core.alarming.MonitoringReport report',
      javaCode: `
      // With timeOutRequest set, alarm only on the failures it names, such
      // as a credential failure, when they pass timeoutValue percent of the
      // requests. Otherwise any failure, a timeout included, would lower the
      // response ratio and raise a credentials alarm.
      if ( ! SafetyUtil.isEmpty(config.getTimeOutRequest()) ) {
        if ( report.getStartCount() != 0 &&
             (float) report.getTimeoutCount() / (float) report.getStartCount() > (float) config.getTimeoutValue() / 100 ) {
          return AlarmReason.CREDENTIALS;
        }
        return null;
      }
      if ( report.getStartCount() != 0  && report.getEndCount() != 0  && ((float) report.getEndCount() /(float) report.getStartCount()) < (float) config.getAlarmValue() / 100 ) {
        return AlarmReason.CREDENTIALS;
      }
      if ( report.getStartCount() != 0  && report.getEndCount() == 0  ) {
        return AlarmReason.CREDENTIALS;
      }
      return null;
      `
    }
  ]

});
