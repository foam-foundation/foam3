/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "compaction",
  projects: [
    { name: '../../src/pom' },
    { name: '../../src/foam/dao/compaction/pom' }
  ],
  files: [
    { name: "../../src/foam/core/ticket/TicketCommentCompactionSink", flags: "js|java" },
    { name: "../../src/foam/core/ticket/TicketCompactionSink",        flags: "js|java" }
  ]
});
