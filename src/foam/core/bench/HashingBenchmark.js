/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.bench',
  name: 'HashingBenchmark',
  extends: 'foam.core.bench.Benchmark',

  javaCode: `
    java.util.List users_ = null;
  `,

  methods: [
    {
      name: 'setup',
      args: 'Context x, BenchmarkResult br',
      javaCode: `
        foam.dao.Sink sink = new foam.dao.ArraySink();
        sink = ((foam.dao.DAO) x.get("localUserDAO")).select(sink);
        users_ = ((foam.dao.ArraySink) sink).getArray();
      `
    },
    {
      name: 'execute',
      args: 'Context x',
      javaCode: `
        try {
          // get random user
          int n = (int) (Math.random() * users_.size());
          ((foam.core.auth.User) users_.get(n)).hash();
        } catch (Throwable t) {
          t.printStackTrace();
        }
      `
    }
  ]
});
