/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.boot.test',
  name: 'CSpecStatusTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.boot.CSpecStatus',
    'foam.core.logger.Logger',
    'java.util.ArrayList',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        final List<String> lines = new ArrayList<String>();
        Logger capture = new Logger() {
          void add(Object[] args) { lines.add(java.util.Arrays.toString(args)); }
          public void log(Object... args)     { add(args); }
          public void info(Object... args)    { add(args); }
          public void warning(Object... args) { add(args); }
          public void error(Object... args)   { add(args); }
          public void debug(Object... args)   { add(args); }
        };

        CSpec spec = new CSpec(x.put("logger", capture));
        spec.setName("cSpecStatusTestService");
        spec.updateStatus(CSpecStatus.REPLAYING, "Replay", "complete,cSpecStatusTestJournal");

        test(
          lines.stream().anyMatch(l -> l.contains("complete,cSpecStatusTestJournal")),
          "status reaches the context logger "+lines);

        // The logger is built out of itself, so its own status stays on stdout.
        CSpec loggerSpec = new CSpec(x.put("logger", capture));
        loggerSpec.setName("logger");
        int before = lines.size();
        loggerSpec.updateStatus(CSpecStatus.REPLAYING, "Replay", "complete,loggerJournal");

        test(
          lines.size() == before,
          "the logger service does not log through itself "+lines);
      `
    }
  ]
});
