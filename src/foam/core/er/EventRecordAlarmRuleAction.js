/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.er',
  name: 'EventRecordAlarmRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],

  documentation: `Generate or clear Alarm`,

  javaImports: [
    'foam.core.alarming.Alarm',
    'foam.core.alarming.AlarmReason',
    'foam.dao.DAO',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.log.LogLevel',
    'static foam.mlang.MLang.EQ',
    'foam.util.SafetyUtil'
  ],

  properties: [
    {
      documentation: 'Severity at or above this value will generate an alarm',
      name: 'alarmSeverity',
      class: 'Enum',
      of: 'foam.log.LogLevel',
      value: 'WARN'
    }
  ],
  methods: [
    {
      name: 'applyAction',
      javaCode: `
      EventRecord er = (EventRecord) obj;

      // NOTE: use localAlarmDAO, as alarmDAO will generate notification.
      DAO alarmDAO = (DAO) ruler.getX().get("localAlarmDAO");
      String name = er.alarmSummary();
      Alarm alarm = (Alarm) alarmDAO.find(EQ(Alarm.NAME, name));
      if ( er.getSeverity().getOrdinal() >= LogLevel.WARN.getOrdinal() ) {
        if ( alarm == null ) {
          alarm = new Alarm(name);
          alarm.setSeverity(er.getSeverity());
          alarm.setClusterable(er.getClusterable());
          alarm.setEventRecord(er.getId());
        } else {
          alarm = (Alarm) alarm.fclone();
        }
        StringBuilder note = new StringBuilder();
        if ( ! er.getMessage().equals(alarm.getNote()) ) {
          note.append(er.getMessage());
          if ( er.getException() != null &&
               er.getMessage() != null &&
               ! er.getMessage().equals(((Exception)er.getException()).getMessage()) ) {
            note.append("\\n");
            note.append(((Exception)er.getException()).getMessage());
          }
        }
        if ( ! alarm.getIsActive() ) {
          alarm.setIsActive(true);
        }
        if ( er.getSeverity().getOrdinal() > alarm.getSeverity().getOrdinal() ) {
          alarm.setSeverity(er.getSeverity());
          alarm.setNote(note.toString());
        } else if ( ! SafetyUtil.isEmpty(alarm.getNote()) &&
                    ! SafetyUtil.isEmpty(note.toString()) &&
                    ! note.equals(alarm.getNote()) ) {
          String n = note.toString();
          note.setLength(0);
          note.append(alarm.getNote());
          note.append("\\n");
          note.append(n);
        }
        alarm.setNote(note.toString());
        alarm = (Alarm) alarmDAO.put(alarm);
        er.setAlarm(alarm.getId());
      } else if ( alarm != null &&
                  alarm.getIsActive() ) {
        alarm = (Alarm) alarm.fclone();
        alarm.setIsActive(false);
        alarm = (Alarm) alarmDAO.put(alarm);
      }
      `
    }
  ]
});
