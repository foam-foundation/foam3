/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.partition',
  name: 'DatePartitioningScheme',

  documentation: `Granularity a DatePartitionedDAO splits journals by. Each
    value implements its own partition naming and stepping, so DAO code stays
    scheme-agnostic: name a date's partition with getPartition(cal), walk a
    date range one partition at a time with step(cal).`,

  methods: [
    {
      name: 'getPartition',
      documentation: `Partition name for the calendar's date, also used as the
        journal-name suffix. Months are emitted 1-based to be easier for humans.`,
      abstract: true,
      type: 'String',
      args: 'java.util.Calendar cal'
    },
    {
      name: 'step',
      documentation: 'Advance the calendar to the next partition.',
      abstract: true,
      type: 'Void',
      args: 'java.util.Calendar cal'
    }
  ],

  values: [
    {
      name: 'YYYYMM',
      javaCode: `
        public String getPartition(java.util.Calendar cal) {
          return cal.get(java.util.Calendar.YEAR) + "/" + (cal.get(java.util.Calendar.MONTH) + 1);
        }
        public void step(java.util.Calendar cal) {
          cal.add(java.util.Calendar.MONTH, 1);
        }
      `
    },
    {
      name: 'YYYYWW',
      javaCode: `
        public String getPartition(java.util.Calendar cal) {
          return cal.get(java.util.Calendar.YEAR) + "/" + cal.get(java.util.Calendar.WEEK_OF_YEAR);
        }
        public void step(java.util.Calendar cal) {
          cal.add(java.util.Calendar.WEEK_OF_YEAR, 1);
        }
      `
    },
    {
      name: 'YYYYDDD',
      javaCode: `
        public String getPartition(java.util.Calendar cal) {
          return cal.get(java.util.Calendar.YEAR) + "/" + cal.get(java.util.Calendar.DAY_OF_YEAR);
        }
        public void step(java.util.Calendar cal) {
          cal.add(java.util.Calendar.DAY_OF_YEAR, 1);
        }
      `
    },
    {
      name: 'YYYYMMDD',
      javaCode: `
        public String getPartition(java.util.Calendar cal) {
          return cal.get(java.util.Calendar.YEAR) + "/" + (cal.get(java.util.Calendar.MONTH) + 1) + "/" + cal.get(java.util.Calendar.DAY_OF_MONTH);
        }
        public void step(java.util.Calendar cal) {
          cal.add(java.util.Calendar.DAY_OF_MONTH, 1);
        }
      `
    }
  ]
});
