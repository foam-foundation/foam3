/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "compaction-test",

  files: [
    { name: 'TestRecord',        flags: 'js&test|java&test' },
    { name: 'CompactionDAOTest', flags: 'js&test|java&test' }
  ],

  journalFiles: [
    { name: 'compactionTestRecords', flags: 'test' }
  ]
});
