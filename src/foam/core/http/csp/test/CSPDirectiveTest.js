/**
 * Copyright
 * @license 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.http.csp.test',
  name: 'CSPDirectiveTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.http.csp.*',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'jakarta.servlet.*'
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x',
      type: 'X',
      javaCode: `
      x = x.put("cspDirectiveDAO", new foam.dao.MDAO(CSPDirective.getOwnClassInfo()));

      return x;
      `
    },
    {
      name: 'runTest',
      javaCode: `
      x = setup(x);
      DAO dao = (DAO) x.get("cspDirectiveDAO");

      CSPFilter filter = new CSPFilter(x);
      filter.initDAOListeners(x);

      String policy = filter.buildPolicy(x, "localhost");
      test ( SafetyUtil.isEmpty(policy), "Policy empty");

      CSPDirective d1 = new CSPDirective(x);
      d1.setName("script-src");
      d1.setKey("test1");
      d1.setValue("test1");
      d1 = (CSPDirective) dao.put(d1).fclone();

      CSPDirective d2 = new CSPDirective(x);
      d2.setName("script-src");
      d2.setKey("test2");
      d2.setValue("test2");
      d2 = (CSPDirective) dao.put(d2).fclone();

      policy = filter.buildPolicy(x, "localhost");
      test ( ! SafetyUtil.isEmpty(policy), "Policy not empty");
      test ( policy.indexOf("test2") >= 0, "Policy contains directive");

      d2.setEnabled(false);
      d2 = (CSPDirective) dao.put(d2).fclone();

      // Allow cache to clear via listener
      try {
        Thread.currentThread().sleep(10L);
      } catch (InterruptedException e ) {
        // nop
      }
      policy = filter.buildPolicy(x, "localhost");
      test ( policy.indexOf("test2") == -1, "Policy does not contain disabled directive");

      d2.setEnabled(true);
      d2 = (CSPDirective) dao.put(d2).fclone();

      CSPDirective d3 = new CSPDirective(x);
      d3.setName("script-src");
      d3.setKey("test2");
      d3.setValue("test3");
      d3 = (CSPDirective) dao.put(d3).fclone();

      // Allow cache to clear via listener
      try {
        Thread.currentThread().sleep(10L);
      } catch (InterruptedException e ) {
        // nop
      }
      policy = filter.buildPolicy(x, "localhost");
      test ( policy.indexOf("test2") == -1 && policy.indexOf("test3") >= 0, "Policy contain replaced directive");

      CSPDirective d4 = new CSPDirective(x);
      d4.setName("script-src");
      d4.setKey("test4");
      d4.setValue("test4");
      d4.setDomain("test4");
      d4 = (CSPDirective) dao.put(d4).fclone();

      // Allow cache to clear via listener
      try {
        Thread.currentThread().sleep(10L);
      } catch (InterruptedException e ) {
        // nop
      }
      policy = filter.buildPolicy(x, "localhost");
      test ( policy.indexOf("test4") == -1, "Policy does not contain domain directive");

      policy = filter.buildPolicy(x, "test4");
      test ( policy.indexOf("test4") >= 0, "Policy does contain domain directive");
      `
    }
  ]
})
