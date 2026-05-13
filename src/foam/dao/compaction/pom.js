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
    { name: 'BlockingDAO',                                       flags: 'js|java'},
    { name: 'Compaction',                                        flags: 'js|java'},
    { name: 'CompactionDAO',                                     flags: 'js|java'},
    { name: 'CompactionException',                               flags: 'js|java'},
    { name: 'CompactionSink',                                    flags: 'js|java'},
    { name: 'CreatedCompactionSink',                             flags: 'js|java'},
    { name: 'LastModifiedCompactionSink',                        flags: 'js|java'},
    { name: 'LifecycleDeletedCompactionSink',                    flags: 'js|java'},
    { name: 'PredicateCompactionSink',                           flags: 'js|java'}
  ]
});
