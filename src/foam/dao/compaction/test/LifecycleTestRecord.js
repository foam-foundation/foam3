/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction.test',
  name: 'LifecycleTestRecord',

  implements: [ 'foam.core.auth.LifecycleAware' ],

  documentation: `TestRecord with a lifecycle, for the case where a row is
    soft-deleted rather than removed. Kept separate so TestRecord stays the
    minimal model the delta-detection tests rely on.`,

  properties: [
    { class: 'Long',   name: 'id' },
    { class: 'String', name: 'name' }
  ]
});
