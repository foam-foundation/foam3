/**
 * PAYTIC CONFIDENTIAL
 *
 * [2026] Paytic Inc.
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Paytic Inc.
 * The intellectual and technical concepts contained
 * herein are proprietary to Paytic Inc
 * and may be covered by Canadian and Foreign Patents, patents
 * in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Paytic Inc.
 */
package foam.core.alarming.test;

import foam.core.alarming.*;
import foam.core.analytics.Candlestick;
import foam.core.er.EventRecord;
import foam.core.om.OMLogger;
import foam.dao.ArraySink;
import foam.dao.DAO;
import foam.lang.X;
import static foam.mlang.MLang.COUNT;
import static foam.mlang.MLang.DESC;
import static foam.mlang.MLang.EQ;
import static foam.mlang.MLang.GTE;
import foam.mlang.sink.Count;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class OMAlarmTest
  extends foam.core.test.JavaTest {

  static String OM_REQUEST = "request";
  static String OM_RESPONSE = "response";
  static String OM_TIMEOUT = "timeout";
  static String CONTROL = "Control";
  static String CONTROLCHECK = "ControlCheck";
  static String CONGESTION = "Congestion";
  static String BURST = "Burst";
  static String CREDENTIALS = "Credentials";
  static String QUIET = "Quiet";
  static String PARTIAL = "Partial";

  public void runTest(X x) {
    try {
      OMLogger omLogger = (OMLogger) x.get("OMLogger");

      DAO alarmDAO = (DAO) x.get("alarmDAO");
      alarmDAO.removeAll();
      Count alarmCount = (Count) alarmDAO.select(COUNT());
      test ( ((Long)alarmCount.getValue()) == 0, "No alarms "+alarmCount);

      DAO alarmConfigDAO = (DAO) x.get("alarmConfigDAO");

      // A 'control' subject alarm - should not be active.
      AlarmConfig ac = new AlarmConfig();
      ac.setName(CONTROL);
      ac.setPreRequest(CONTROL+"."+OM_REQUEST);
      ac.setPostRequest(CONTROL+"."+OM_RESPONSE);
      ac.setMonitorType(MonitorType.CONTROLCHECK);
      alarmConfigDAO.put(ac);

      ac = new AlarmConfig();
      ac.setName(CONTROLCHECK);
      ac.setSeverity(foam.log.LogLevel.ERROR);
      ac.setPreRequest(CONTROLCHECK+"."+OM_REQUEST);
      ac.setPostRequest(CONTROLCHECK+"."+OM_RESPONSE);
      ac.setMonitorType(MonitorType.CONTROLCHECK);
      alarmConfigDAO.put(ac);

      ac = new AlarmConfig();
      ac.setName(CONGESTION);
      ac.setSeverity(foam.log.LogLevel.ERROR);
      ac.setPreRequest(CONGESTION+"."+OM_REQUEST);
      ac.setPostRequest(CONGESTION+"."+OM_RESPONSE);
      ac.setTimeOutRequest(CONGESTION+"."+OM_TIMEOUT);
      alarmConfigDAO.put(ac);

      // generating 99 rather than 100 OMs so the ratios are just
      // above the thresholds of 75% and 10%
      for ( int i = 0; i < 99; i++) {
        omLogger.log(CONTROL,OM_REQUEST);
        if ( i % 4 > 0 )
          omLogger.log(CONTROL,OM_RESPONSE);
        //else
          // no response

        omLogger.log(CONTROLCHECK,OM_REQUEST);
        if ( i % 4 > 0 )
          omLogger.log(CONTROLCHECK,OM_RESPONSE);
        //else
          // no response

        omLogger.log(CONGESTION,OM_REQUEST);
        if ( i % 10 > 0 )
          omLogger.log(CONGESTION,OM_RESPONSE);
        else
          omLogger.log(CONGESTION,OM_TIMEOUT);
      }
      // generate 100th - as control subject
      omLogger.log(CONTROL,OM_REQUEST);
      omLogger.log(CONTROL,OM_RESPONSE);

      evaluate(x, CONTROL);
      evaluate(x, CONTROLCHECK);
      evaluate(x, CONGESTION);

      alarmCount = (Count) alarmDAO.select(COUNT());
      test ( ((Long)alarmCount.getValue()) > 0, "alarms generated "+ alarmCount.getValue());
      List<Alarm> alarms = (List) ((ArraySink) alarmDAO.select(new ArraySink())).getArray();
      Map<String, Alarm> alarmMap = new HashMap();
      for ( Alarm alarm : alarms ) {
        alarmMap.put(alarm.getName(), alarm);
      }
      Alarm alarm = alarmMap.get(CONTROL);
      // A monitor that never trips raises no alarm.
      test(alarm == null || ! alarm.getIsActive() , CONTROL+" no active alarm "+alarm);

      alarm = alarmMap.get(CONTROLCHECK);
      test(alarm != null && alarm.getIsActive() , CONTROLCHECK + " active alarm found "+alarm);

      alarm = alarmMap.get(CONGESTION);
      test(alarm != null && alarm.getIsActive() , CONGESTION+" active alarm found "+alarm);

      testBurst(x, omLogger, alarmConfigDAO);
      testCredentials(x, omLogger, alarmConfigDAO);
      testQuiet(x, omLogger, alarmConfigDAO);
      testPartialMinute(x, omLogger, alarmConfigDAO);
    } catch (Throwable t) {
      test(false, t.getMessage());
    }
  }

  // A burst of timeouts raises a TIMEOUT alarm. Timeouts that arrive after
  // the requests stop leave it on, and it clears once requests are answered
  // again, even though the burst's candlestick is still the latest one for
  // the timeout OM.
  void testBurst(X x, OMLogger omLogger, DAO alarmConfigDAO) throws InterruptedException {
    AlarmConfig ac = new AlarmConfig();
    ac.setName(BURST);
    ac.setSeverity(foam.log.LogLevel.ERROR);
    ac.setMonitorType(MonitorType.OTHER);
    ac.setPreRequest(BURST+"."+OM_REQUEST);
    ac.setPostRequest(BURST+"."+OM_RESPONSE);
    ac.setTimeOutRequest(BURST+"."+OM_TIMEOUT);
    alarmConfigDAO.put(ac);

    for ( int i = 0; i < 10; i++ ) {
      omLogger.log(BURST,OM_REQUEST);
      omLogger.log(BURST,OM_TIMEOUT);
    }
    evaluate(x, BURST);
    Alarm alarm = findAlarm(x, BURST);
    test(alarm != null && alarm.getIsActive(), BURST+" raised by 10 timeouts in 10 attempts "+alarm);

    age(x, BURST+"."+OM_REQUEST);
    age(x, BURST+"."+OM_TIMEOUT);
    for ( int i = 0; i < 5; i++ )
      omLogger.log(BURST,OM_TIMEOUT);
    evaluate(x, BURST);
    alarm = findAlarm(x, BURST);
    test(alarm != null && alarm.getIsActive(), BURST+" stays on with 5 timeouts and no attempts in the window "+alarm);

    age(x, BURST+"."+OM_TIMEOUT);
    for ( int i = 0; i < 10; i++ ) {
      omLogger.log(BURST,OM_REQUEST);
      omLogger.log(BURST,OM_RESPONSE);
    }
    evaluate(x, BURST);
    alarm = findAlarm(x, BURST);
    test(alarm != null && ! alarm.getIsActive(), BURST+" clears with 10 answered attempts after the burst "+alarm);
  }

  // A CREDENTIALS config with timeOutRequest alarms only on the failures that
  // OM names, credential failures here. Unanswered requests, such as
  // timeouts, do not raise it.
  void testCredentials(X x, OMLogger omLogger, DAO alarmConfigDAO) throws InterruptedException {
    AlarmConfig ac = new AlarmConfig();
    ac.setName(CREDENTIALS);
    ac.setSeverity(foam.log.LogLevel.ERROR);
    ac.setMonitorType(MonitorType.CREDENTIALS);
    ac.setPreRequest(CREDENTIALS+"."+OM_REQUEST);
    ac.setPostRequest(CREDENTIALS+"."+OM_RESPONSE);
    ac.setTimeOutRequest(CREDENTIALS+".invalid");
    alarmConfigDAO.put(ac);

    for ( int i = 0; i < 10; i++ ) {
      omLogger.log(CREDENTIALS,OM_REQUEST);
      if ( i % 2 == 0 )
        omLogger.log(CREDENTIALS,OM_RESPONSE);
      else
        omLogger.log(CREDENTIALS,OM_TIMEOUT);
    }
    evaluate(x, CREDENTIALS);
    Alarm alarm = findAlarm(x, CREDENTIALS);
    test(alarm == null || ! alarm.getIsActive(), CREDENTIALS+" not raised by 5 timeouts in 10 attempts "+alarm);

    age(x, CREDENTIALS+"."+OM_REQUEST);
    age(x, CREDENTIALS+"."+OM_RESPONSE);
    age(x, CREDENTIALS+"."+OM_TIMEOUT);
    for ( int i = 0; i < 10; i++ ) {
      omLogger.log(CREDENTIALS,OM_REQUEST);
      if ( i % 2 == 0 )
        omLogger.log(CREDENTIALS,OM_RESPONSE);
      else
        omLogger.log(CREDENTIALS,"invalid");
    }
    evaluate(x, CREDENTIALS);
    alarm = findAlarm(x, CREDENTIALS);
    test(alarm != null && alarm.getIsActive(), CREDENTIALS+" raised by 5 credential failures in 10 attempts "+alarm);
  }

  // A config below WARN raises no alarm, so it must not put a record on
  // every cycle while it trips.
  void testQuiet(X x, OMLogger omLogger, DAO alarmConfigDAO) throws InterruptedException {
    AlarmConfig ac = new AlarmConfig();
    ac.setName(QUIET);
    ac.setSeverity(foam.log.LogLevel.INFO);
    ac.setMonitorType(MonitorType.CONTROLCHECK);
    ac.setPreRequest(QUIET+"."+OM_REQUEST);
    ac.setPostRequest(QUIET+"."+OM_RESPONSE);
    alarmConfigDAO.put(ac);

    for ( int i = 0; i < 10; i++ )
      omLogger.log(QUIET,OM_REQUEST);
    evaluate(x, QUIET);
    evaluate(x, QUIET);
    Count records = (Count) ((DAO) x.get("eventRecordDAO")).where(EQ(EventRecord.EVENT, QUIET)).select(COUNT());
    test(((Long) records.getValue()) == 0, QUIET+" INFO config that trips puts no EventRecord "+records.getValue());
  }

  // Timeouts from the last complete minute and a request from the current,
  // partial one are not compared: the window holds only complete minutes, so
  // it sees 6 timeouts and no attempts, and raises nothing.
  void testPartialMinute(X x, OMLogger omLogger, DAO alarmConfigDAO) throws InterruptedException {
    AlarmConfig ac = new AlarmConfig();
    ac.setName(PARTIAL);
    ac.setSeverity(foam.log.LogLevel.ERROR);
    ac.setMonitorType(MonitorType.OTHER);
    ac.setPreRequest(PARTIAL+"."+OM_REQUEST);
    ac.setPostRequest(PARTIAL+"."+OM_RESPONSE);
    ac.setTimeOutRequest(PARTIAL+"."+OM_TIMEOUT);
    alarmConfigDAO.put(ac);

    for ( int i = 0; i < 6; i++ )
      omLogger.log(PARTIAL,OM_TIMEOUT);
    closeMinute(x);
    omLogger.log(PARTIAL,OM_REQUEST);
    omLogger.log(PARTIAL,OM_RESPONSE);

    MonitoringReport report = new MonitoringReport();
    report.setName(PARTIAL);
    ((DAO) x.get("monitoringReportDAO")).put(report);
    Thread.sleep(1000);
    Alarm alarm = findAlarm(x, PARTIAL);
    test(alarm == null || ! alarm.getIsActive(), PARTIAL+" 6 timeouts last minute and 1 request this minute raise nothing "+alarm);
  }

  // AlarmAndMonitoring reads only complete minutes, so the candlesticks
  // logged in the current minute are moved into the previous one first.
  void evaluate(X x, String name) throws InterruptedException {
    closeMinute(x);
    MonitoringReport report = new MonitoringReport();
    report.setName(name);
    ((DAO) x.get("monitoringReportDAO")).put(report);
    Thread.sleep(1000);
  }

  // Moves every candlestick of the current, partial minute back one minute,
  // as if that minute had closed. Within 3 s of the next minute it waits for
  // it first, so the moved candlesticks are still the last complete minute
  // when the report is evaluated.
  void closeMinute(X x) throws InterruptedException {
    long ms = System.currentTimeMillis() % 60000;
    if ( ms > 57000 ) Thread.sleep(60000 - ms + 100);
    long minuteStart = System.currentTimeMillis() / 60000 * 60000;
    DAO dao = (DAO) x.get("localOm1MinuteDAO");
    List<Candlestick> current = (List) ((ArraySink) dao.where(GTE(Candlestick.CLOSE_TIME, new Date(minuteStart))).select(new ArraySink())).getArray();
    for ( Candlestick c : current ) {
      dao.remove(c);
      Candlestick moved = (Candlestick) c.fclone();
      moved.setCloseTime(new Date(c.getCloseTime().getTime() - 60000));
      dao.put(moved);
    }
  }

  Alarm findAlarm(X x, String name) {
    return (Alarm) ((DAO) x.get("alarmDAO")).find(EQ(Alarm.NAME, name));
  }

  // Moves the latest candlestick of key ten minutes back, as if it had been
  // logged then, so it stays the latest but is outside the window.
  void age(X x, String key) {
    DAO dao = (DAO) x.get("localOm1MinuteDAO");
    Candlestick c = (Candlestick) dao.orderBy(DESC(Candlestick.CLOSE_TIME)).find(EQ(Candlestick.KEY, key));
    if ( c == null ) return;
    dao.remove(c);
    c = (Candlestick) c.fclone();
    c.setCloseTime(new Date(c.getCloseTime().getTime() - 10 * 60 * 1000));
    dao.put(c);
  }
}
