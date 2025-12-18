/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.script.javet.test',
  name: 'JavetShellConcurrentTest',
  extends: 'foam.core.test.JavaTest',

  documentation: `Run concurrent JavetShells.
Determine if one shell can see globalThis data of another.
`,

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.script.javet.*',
    'foam.lang.X',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.util.SafetyUtil',

    'java.io.ByteArrayOutputStream',
    'java.io.PrintStream',
    'java.util.ArrayList',
    'java.util.List',
    'java.util.Map',
    'java.util.concurrent.ConcurrentHashMap',
    'java.util.concurrent.Future',
    'java.util.concurrent.atomic.AtomicLong',
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        final Logger logger    = Loggers.logger(x, this);
        final Map<String, List> map = new ConcurrentHashMap();
        final StringBuffer err = new StringBuffer();
        final AtomicLong count = new AtomicLong();
        final int clients      = 5;
        final int loops        = 250;

        var code = """
let id = '%s';
var a = globalThis.a;
if ( a && a !== id ) {
  console.info('found another globalThis.a', id, globalThis.a);
}
globalThis.a = id;

var b = x.b;
if ( b && b !== id ) {
  console.info('found another x.b', id, b);
}
x.createSubContext({b: id});

for ( let i = 0; i < %s; i++ ) {
  console.info('loop', id, i);
}
        """;
        PrintStream ps = new PrintStream(new ByteArrayOutputStream()) {
          @Override
          public void println(String s) {
            if ( s.contains("loop,") )
              count.getAndIncrement();
            else if ( s.contains("found another") ) {
              String[] parts = s.split(",");
              String id = parts[parts.length -1].trim();
              List<String> ids = map.get(Thread.currentThread().getName());
              if ( ! ids.contains(id) ) {
                logger.warning("map.contains NOT", id, String.join(",", ids));
                err.append(s);
              } else {
                logger.info("map.contains", id);
              }
            }
          }
        };
        Future[] futures = new Future[clients];
        Agency agency = (Agency) x.get("javetThreadPool");
        for ( int i = 0; i < clients; i++ ) {
          String id = String.valueOf(i);
          logger.info("agency.submit", id);
          Future future = agency.submit(x, new ContextAgent() {
            public void execute(X x) {
              logger.info("agency.execute", id);
              List ids = map.get(Thread.currentThread().getName());
              if ( ids == null ) {
                ids = new ArrayList();
                map.put(Thread.currentThread().getName(), ids);
              }
              ids.add(id);
              logger.info("map.put", id);

              JavetShell shell = (JavetShell) x.get("javetShell");
              shell.setPrintStream(ps);
              shell.setCode(code.formatted(id, loops));
              logger.info("shell.execute", id, shell.getCode());
              shell.execute(x);
            }
          }, id);
          futures[i] = future;
        }
        // wait for futures
        for ( int i = 0; i < clients; i++ ) {
          futures[i].get();
          logger.info("future,complete", i);
        }
        logger.info("futures,complete");
        logger.info("count", count.get(), "err", err);

        test( count.get() == (long) clients * loops, "Expected count "+count.get());
        test( SafetyUtil.isEmpty(err.toString()), "Other globalThis.a and x.b not found " + err.toString());
      `
    }
  ]
});
