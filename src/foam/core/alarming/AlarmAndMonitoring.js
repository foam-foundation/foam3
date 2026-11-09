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
    'java.util.Date',
    'static foam.mlang.MLang.EQ'
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

          Date currentCloseTime = new Date();
          currentCloseTime.setSeconds(0);

          Candlestick receiveResponses = (Candlestick) omDAO.orderBy(new foam.mlang.order.Desc(Candlestick.CLOSE_TIME)).find(
            EQ(Candlestick.KEY, config.getPostRequest())
          );
          Candlestick sentRequest = (Candlestick) omDAO.orderBy(new foam.mlang.order.Desc(Candlestick.CLOSE_TIME)).find(
            EQ(Candlestick.KEY, config.getPreRequest())
          );

          Candlestick timeout = (Candlestick) omDAO.orderBy(new foam.mlang.order.Desc(Candlestick.CLOSE_TIME)).find(
            EQ(Candlestick.KEY, config.getTimeOutRequest())
          );

          boolean updateAlarm = false;

          // check to see if the sent candlestick is the latest one
          if ( sentRequest != null && Math.abs(sentRequest.getCloseTime().getTime() - currentCloseTime.getTime()) < config.getCycleTime() ) {
            updateAlarm = true;
            report.setStartCount(report.getStartCount() + (int) sentRequest.getCount());
          }
          // check to see if the response candlestick is the latest one
          if ( receiveResponses != null && Math.abs(receiveResponses.getCloseTime().getTime() - currentCloseTime.getTime()) < config.getCycleTime() ) {
              updateAlarm = true;
              report.setEndCount(report.getEndCount() + (int) receiveResponses.getCount());
          }
          if ( timeout != null && (Math.abs(timeout.getCloseTime().getTime() - currentCloseTime.getTime()) < config.getCycleTime()) ) {
              updateAlarm = true;
              report.setTimeoutCount(report.getTimeoutCount() + (int) timeout.getCount());
          }

          if ( ! updateAlarm ) {
            return;
          }

          // The latest candlestick of a key stays in the DAO until that key
          // is logged again, so reading it directly would keep counting a
          // burst of timeouts long after it ended, and the alarm would never
          // clear. The report holds only the candlesticks that closed within
          // cycleTime.
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
          if ( reason != null && ! active ) {
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
        config's name. EventRecordAlarmRuleAction raises the alarm at WARN or
        ERROR and clears it at INFO; EventRecordNotificationRuleAction
        notifies on an ERROR raise and on a clear. The message holds the
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
