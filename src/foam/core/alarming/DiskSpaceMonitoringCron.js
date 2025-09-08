/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.alarming',
  name: 'DiskSpaceMonitoringCron',
  documentation: `
    Cronjob to monitor disk space and create an alarm when a certain limit is exceeded
  `,

  implements: [
    'foam.lang.ContextAgent',
    'foam.lang.ContextAware'
  ],

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.log.LogLevel',
    'java.io.IOException',
    'java.nio.file.Files',
    'java.nio.file.FileStore',
    'java.nio.file.Paths'
  ],

  constants: [
  ],

  properties: [
    {
      class: 'Double',
      name: 'thresholdPercent',
      documentation: 'Disk usage percentage threshold to trigger alarm',
      value: 90
    },
    {
      class: 'String',
      name: 'path',
      documentation: 'path to monitor',
      value: '/'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        String note;
        try {
          FileStore store = Files.getFileStore(Paths.get(getPath()));
          double total = (double) store.getTotalSpace();
          double free = (double) store.getUnallocatedSpace();
          double percentUsed = ((total - free) / total) * 100.0;
          if ( percentUsed > getThresholdPercent() ) {
            note = String.format("Disk usage at %.2f%% exceeds threshold of %.2f%% on %s", percentUsed, getThresholdPercent(), getPath());
            Alarm alarm = new Alarm.Builder(x)
              .setName("Disk space monitoring alarm")
              .setReason(AlarmReason.THRESHOLD)
              .setSeverity(LogLevel.ERROR)
              .setNote(note)
              .build();
            ((DAO) x.get("alarmDAO")).put(alarm);
            Loggers.logger(x, this).error(note);
            return;
          }

          note = String.format("Disk space usage check passed. Percentage used: %.2f%%, Alarm threshold: %.2f%%", percentUsed, getThresholdPercent());
          Loggers.logger(x, this).info(note);
        } catch (IOException e) {
          note = String.format("Unable to check disk space usage for path: %s", getPath());
          Loggers.logger(x, this).error(note, e);
        }
      `
    },
  ]
})