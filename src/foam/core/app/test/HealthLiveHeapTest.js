/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.app.test',
  name: 'HealthLiveHeapTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Health.memoryLiveEstimate must be the heap holding live data: positive and
    within memoryMax, with memoryLiveEstimatePercent between 0 and 100.
  `,

  javaImports: [
    'foam.core.app.Health'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Health health = new Health(x);

        test(health.getMemoryLiveEstimate() > 0, "memoryLiveEstimate is positive");
        test(health.getMemoryLiveEstimate() <= health.getMemoryMax(), "memoryLiveEstimate is within memoryMax");
        test(health.getMemoryLiveEstimatePercent() >= 0 && health.getMemoryLiveEstimatePercent() <= 100, "memoryLiveEstimatePercent is between 0 and 100");
      `
    }
  ]
});
