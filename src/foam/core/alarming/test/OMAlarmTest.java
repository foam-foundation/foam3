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
import foam.core.om.OMLogger;
import foam.dao.ArraySink;
import foam.dao.DAO;
import foam.lang.X;
import static foam.mlang.MLang.COUNT;
import foam.mlang.sink.Count;
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
      ac.setPreRequest(CONTROLCHECK+"."+OM_REQUEST);
      ac.setPostRequest(CONTROLCHECK+"."+OM_RESPONSE);
      ac.setMonitorType(MonitorType.CONTROLCHECK);
      alarmConfigDAO.put(ac);

      ac = new AlarmConfig();
      ac.setName(CONGESTION);
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

      DAO monitoringReportDAO = (DAO) x.get("monitoringReportDAO");
      MonitoringReport report = new MonitoringReport();
      report.setName(CONTROL);
      monitoringReportDAO.put(report);

      report = new MonitoringReport();
      report.setName(CONTROLCHECK);
      monitoringReportDAO.put(report);

      report = new MonitoringReport();
      report.setName(CONGESTION);
      monitoringReportDAO.put(report);

      alarmCount = (Count) alarmDAO.select(COUNT());
      test ( ((Long)alarmCount.getValue()) > 0, "alarms generated "+ alarmCount.getValue());
      List<Alarm> alarms = (List) ((ArraySink) alarmDAO.select(new ArraySink())).getArray();
      Map<String, Alarm> alarmMap = new HashMap();
      for ( Alarm alarm : alarms ) {
        alarmMap.put(alarm.getName(), alarm);
      }
      Alarm alarm = alarmMap.get(CONTROL);
      test(alarm != null && ! alarm.getIsActive() , CONTROL+" not active alarm found "+alarm);

      alarm = alarmMap.get(CONTROLCHECK);
      test(alarm != null && alarm.getIsActive() , CONTROLCHECK + " active alarm found "+alarm);

      alarm = alarmMap.get(CONGESTION);
      test(alarm != null && alarm.getIsActive() , CONGESTION+" active alarm found "+alarm);
    } catch (Throwable t) {
      test(false, t.getMessage());
    }
  }
}
