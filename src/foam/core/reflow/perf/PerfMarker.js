/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.reflow.perf',
  name: 'PerfMarker',

  documentation: `Inspects a finished PerfReport and returns the PerfIssues it finds.
    One concern per marker; each marker owns its own thresholds. PerfReport.analyze()
    runs every registered marker and concatenates the results.`,

  methods: [
    {
      name: 'mark',
      type: 'Array',
      args: [ { name: 'report', type: 'foam.core.reflow.perf.PerfReport' } ]
    }
  ]
});
