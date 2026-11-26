/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'OMLoggerBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `Logs keyCount OMs through OMLogger per execution.
    OMLogger adds each log to the current minute's Candlestick in
    localOm1MinuteDAO, and only a key's first log in a minute puts a new
    Candlestick. With newKeys every log uses a key not seen before, so every
    log is a put: the cost of a decorator on localOm1MinuteDAO. Without it
    the same keys repeat, so after the first execution every log finds its
    Candlestick and no put happens.`,

  javaImports: [
    'foam.core.om.OMLogger',
    'foam.lang.X'
  ],

  properties: [
    { class: 'Int', name: 'keyCount', value: 20000 },
    { class: 'Boolean', name: 'newKeys' }
  ],

  methods: [
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        OMLogger omLogger = (OMLogger) x.get("OMLogger");
        String prefix = getNewKeys() ? "OMLoggerBenchmark:" + System.nanoTime() + ":" : "OMLoggerBenchmark:same:";
        for ( int i = 0 ; i < getKeyCount() ; i++ ) {
          omLogger.log(prefix + i);
        }
      `
    }
  ]
});
