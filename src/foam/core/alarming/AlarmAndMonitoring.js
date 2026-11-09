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
    'java.util.Date',
    'java.util.Calendar',
    'java.util.TimeZone',
    'foam.core.analytics.Candlestick',
    'foam.core.logger.Logger',
    'static foam.mlang.MLang.AND',
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

          boolean newAlarm = false;
          DAO alarmDAO = (DAO) x.get("alarmDAO");
          Alarm alarm = (Alarm) alarmDAO.find(EQ(Alarm.NAME, config.getName()));
          if ( alarm == null ) {
            alarm = new Alarm.Builder(x)
              .setName(config.getName())
              .setIsActive(false)
              .build();
            newAlarm = true;
          } else {
            alarm = (Alarm) alarm.fclone();
          }

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
          if ( config.getMonitorType() == MonitorType.CREDENTIALS  && updateAlarm ) {
            alarm = AlarmAndMonitoring.this.checkCredentials(x, config, report, alarm);
            alarmDAO.put(alarm);
            return;
          }

          // The latest candlestick of a key stays in the DAO until that key is
          // logged again, so reading it directly would keep counting a burst
          // of timeouts long after it ended, and the alarm would never clear. The report holds only the candlesticks that
          // closed within cycleTime.
          float timeoutCount = report.getTimeoutCount();
          float sentCount = report.getStartCount();
          float responseCount = report.getEndCount();

          if ( ! updateAlarm || (newAlarm && sentCount == responseCount) ) {
            return;
          }

          if ( timeoutCount > 0 && sentCount > 0  && (timeoutCount / sentCount) > (float) config.getTimeoutValue() / 100 ) {
            if ( ! alarm.getIsActive() || !( alarm.getReason() == AlarmReason.TIMEOUT) ) {
              alarm.setReason(AlarmReason.TIMEOUT);
              alarm.setIsActive(true);
            }
          } else if (( config.getMonitorType() == MonitorType.CONTROLCHECK ||
                      config.getMonitorType() == MonitorType.CONGESTION ) &&
                      sentCount > 0  &&
                      (responseCount / sentCount) < (float) config.getAlarmValue() / 100 ) {
            AlarmReason checkReason = config.getMonitorType() == MonitorType.CONTROLCHECK ? AlarmReason.CONTROLCHECK : AlarmReason.CONGESTION;

            if ( ! alarm.getIsActive() || !( alarm.getReason() == checkReason ) ) {
              alarm.setReason(checkReason);
              alarm.setIsActive(true);
            }
          } else if ( config.getMonitorType() == MonitorType.THRESHOLD && sentCount > config.getAlarmValue() ) {
            if ( ! alarm.getIsActive() ) {
              alarm.setReason(AlarmReason.THRESHOLD);
              alarm.setIsActive(true);
            }
          } else {
            if ( alarm.getIsActive() ) {
              report.setStartCount(0);
              report.setEndCount(0);
              report.setTimeoutCount(0);
              alarm.setReason(AlarmReason.UNSPECIFIED);
              alarm.setIsActive(false);
            }
          }

          // Have to do this manually as not all alarms modify the state and therefore lastModifiedAware decorator will not update lastModified
          alarm.setLastModified(new Date());

          alarmDAO.put(alarm);
        }
      }, "Alarm And Monitoring");
      `
    },
    {
      name: 'checkCredentials',
      type: 'foam.core.alarming.Alarm',
      args: [
        {
          type: 'Context',
          name: 'x',
        },
        {
          type: 'foam.core.alarming.AlarmConfig',
          name: 'config'
        },
        {
          type: 'foam.core.alarming.MonitoringReport',
          name: 'report',
        },
        {
          type: 'foam.core.alarming.Alarm',
          name: 'alarm'
        }
      ],
      javaCode: `
      // With timeOutRequest set, alarm only on the failures it names, such
      // as a credential failure, when they pass timeoutValue percent of the
      // requests. Otherwise any failure, a timeout included, would lower the
      // response ratio and raise a credentials alarm.
      if ( ! foam.util.SafetyUtil.isEmpty(config.getTimeOutRequest()) ) {
        if ( report.getStartCount() != 0 &&
             (float) report.getTimeoutCount() / (float) report.getStartCount() > (float) config.getTimeoutValue() / 100 ) {
          alarm.setReason(AlarmReason.CREDENTIALS);
          alarm.setIsActive(true);
        } else if ( alarm.getIsActive() ) {
          report.setStartCount(0);
          report.setEndCount(0);
          report.setTimeoutCount(0);
          alarm.setReason(AlarmReason.UNSPECIFIED);
          alarm.setIsActive(false);
        }
        return alarm;
      }
      if ( report.getStartCount() != 0  && report.getEndCount() != 0  && ((float) report.getEndCount() /(float) report.getStartCount()) < (float) config.getAlarmValue() / 100 ) {
        if ( ! alarm.getIsActive() || !( alarm.getReason() == AlarmReason.CREDENTIALS) ) {
          alarm.setReason(AlarmReason.CREDENTIALS);
          alarm.setIsActive(true);
        }
      }  else if ( report.getStartCount() != 0  && report.getEndCount() == 0  ) {
        alarm.setReason(AlarmReason.CREDENTIALS);
        alarm.setIsActive(true);
      } else {
        if ( alarm.getIsActive() ) {
          report.setStartCount(0);
          report.setEndCount(0);
          report.setTimeoutCount(0);
          alarm.setReason(AlarmReason.UNSPECIFIED);
          alarm.setIsActive(false);
        }
      }
      return alarm;
      `
    }
  ]

});
