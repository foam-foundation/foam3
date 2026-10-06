/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "compaction",

  projects: [
    { name: 'test/pom', flags: 'test' }
  ],

  files: [
    { name: 'Compaction',                                        flags: 'js|java'},
    { name: 'CompactionCmd',                                     flags: 'js|java'},
    { name: 'Compactor',                                        flags: 'js|java'},
    { name: 'CompactionException',                               flags: 'js|java'},
    { name: 'LifecycleDeletedCompactionSink',                    flags: 'js|java'},
  ]
});
