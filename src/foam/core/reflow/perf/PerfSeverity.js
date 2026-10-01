/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.reflow.perf',
  name: 'PerfSeverity',

  documentation: 'Severity of a flagged performance issue, drives colour in the report.',

  values: [
    { name: 'OK',   label: 'OK' },
    { name: 'WARN', label: 'Warning' },
    { name: 'BAD',  label: 'Critical' }
  ]
});
