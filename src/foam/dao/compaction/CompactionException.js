/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  name: 'CompactionException',
  package: 'foam.dao.compaction',
  extends: 'foam.lang.FOAMException',

  javaCode: `
    public CompactionException(String message) {
      super(message);
    }

    public CompactionException(Throwable cause) {
      super(cause.getMessage(), cause);
    }

    public CompactionException(String message, Throwable cause) {
      super(message, cause);
    }
  `
});
