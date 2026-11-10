/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.er.test',
  name: 'EventRecordTest',
  extends: 'foam.core.test.Test',

  documentation: 'Test EventRecord generates alarm and notification',

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ArraySink',
    'foam.dao.Sink',
    'foam.log.LogLevel',
    'static foam.mlang.MLang.EQ',
    'foam.core.alarming.Alarm',
    'foam.core.er.EventRecord',
    'foam.core.notification.Notification',
    'foam.core.notification.email.EmailMessage',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
      DAO erDAO = (DAO) x.get("eventRecordDAO");
      String s = "EventRecordTest";

      EventRecord er = new EventRecord();
      er.setX(x);
      er.setSource(this);
      er.setEvent(s);
      er.setCode(s);
      er.setMessage(s);
      er.setPartner(s);
      er.setSeverity(LogLevel.ERROR);
      er = (EventRecord) erDAO.put_(x, er);

      Thread.sleep(3000);

      // test for alarm
      Alarm alarm = (Alarm) ((DAO) x.get("localAlarmDAO")).find(EQ(Alarm.NAME, er.alarmSummary()));
      test( alarm != null, "alarm exists");
      test ( alarm.getIsActive(), "Alarm active");

      er = new EventRecord();
      er.setX(x);
      er.setSource(this);
      er.setEvent(s);
      er.setCode(s);
      er.setMessage(s);
      er.setPartner(s);
      er.setSeverity(LogLevel.INFO);
      er = (EventRecord) erDAO.put_(x, er);

      Thread.sleep(1000);

      alarm = (Alarm) ((DAO) x.get("localAlarmDAO")).find(EQ(Alarm.NAME, er.alarmSummary()));
      test( alarm != null, "alarm exists");
      test ( ! alarm.getIsActive(), "Alarm cleared");

      // notification will generate email
      DAO emailMessageDAO = (DAO) x.get("emailMessageDAO");
      List<EmailMessage> emailMessages = (List) ((ArraySink) emailMessageDAO.select(new ArraySink())).getArray();
      EmailMessage message = null;
      for ( EmailMessage msg : emailMessages ) {
        if ( msg.getSubject().contains("EventRecordTest") ) {
          message = msg;
          break;
        }
      }
      test( message != null, (message == null ? "message is null" : "email subject contains expected text: EventRecordTest == ["+message.getSubject()+"]"));

      // A WARN record raises an alarm when raiseAlarm is true, but is below
      // notificationSeverity, ERROR, so it sends no notification either way.
      String quiet = "EventRecordTestWarnNoAlarm";
      er = new EventRecord();
      er.setX(x);
      er.setSource(this);
      er.setEvent(quiet);
      er.setMessage(quiet);
      er.setSeverity(LogLevel.WARN);
      er.setRaiseAlarm(false);
      erDAO.put_(x, er);

      String raised = "EventRecordTestWarnAlarm";
      er = new EventRecord();
      er.setX(x);
      er.setSource(this);
      er.setEvent(raised);
      er.setMessage(raised);
      er.setSeverity(LogLevel.WARN);
      erDAO.put_(x, er);

      Thread.sleep(1000);

      boolean quietSent = false;
      boolean raisedSent = false;
      emailMessages = (List) ((ArraySink) emailMessageDAO.select(new ArraySink())).getArray();
      for ( EmailMessage msg : emailMessages ) {
        if ( msg.getSubject().contains(quiet) ) quietSent = true;
        if ( msg.getSubject().contains(raised) ) raisedSent = true;
      }
      test( ! quietSent, "WARN record with raiseAlarm false sends no notification");
      test( ! raisedSent, "WARN record with raiseAlarm true sends no notification");
      Alarm warnAlarm = (Alarm) ((DAO) x.get("localAlarmDAO")).find(EQ(Alarm.NAME, er.alarmSummary()));
      test( warnAlarm != null && warnAlarm.getIsActive(), "WARN record with raiseAlarm true raises an alarm");
      `
    }
  ]
});
