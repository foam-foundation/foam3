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
    Health.memoryLiveEstimate must be the heap holding live data: positive, within
    memoryMax, and close to the same estimate computed here from the memory
    pools. The heap moves between the two reads, so the comparison is loose.
  `,

  javaImports: [
    'foam.core.app.Health',
    'java.lang.management.ManagementFactory',
    'java.lang.management.MemoryPoolMXBean',
    'java.lang.management.MemoryType'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Health health = new Health(x);

        test(health.getMemoryLiveEstimate() > 0, "memoryLiveEstimate is positive");
        test(health.getMemoryLiveEstimate() <= health.getMemoryMax(), "memoryLiveEstimate is within memoryMax");
        test(health.getMemoryLiveEstimatePercent() >= 0 && health.getMemoryLiveEstimatePercent() <= 100, "memoryLiveEstimatePercent is between 0 and 100");
        expect(
          health.getMemoryLiveEstimatePercent(),
          (long) ((health.getMemoryLiveEstimate() / (float) health.getMemoryMax()) * 100.0),
          "memoryLiveEstimatePercent is memoryLiveEstimate over memoryMax");

        long expected = 0;
        for ( MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans() ) {
          if ( pool.getType() != MemoryType.HEAP ) continue;
          var afterGC = pool.getCollectionUsage();
          boolean old = pool.getName().contains("Old") || pool.getName().contains("Tenured");
          expected += ( old || afterGC == null ) ? pool.getUsage().getUsed() : afterGC.getUsed();
        }
        long tolerance = Math.max(health.getMemoryMax() / 10, 64L * 1024 * 1024);
        test(Math.abs(health.getMemoryLiveEstimate() - expected) <= tolerance, "memoryLiveEstimate matches the pool estimate recomputed here");
      `
    }
  ]
});
