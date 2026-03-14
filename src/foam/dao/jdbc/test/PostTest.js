/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.jdbc.test',
  name: 'PostTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.dao.*',
    'foam.core.auth.*',
    'foam.lang.*',
    'foam.dao.jdbc.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        var jdbcSpec = x.get("JDBCConnectionSpec");
        test (jdbcSpec != null, "JDBCConnectionSpec found in context");

        JDBCPooledDataSource source = new JDBCPooledDataSource(x, "PoolA");
        X xcopy = x.put("JDBCDataSource", source);
        var employeeDAO = new PostgresDAO(xcopy, TestEmployee.getOwnClassInfo());

        TestEmployee testObject = new TestEmployee.Builder(x)
          .setId(23)
          .setFirstName("Sam")
          .setLastName("King")
          .build();
        employeeDAO.put(testObject);

        // In particular, ensure that 
        // - sequence number support
        // - GROUP BY 
        // - COUNT operations
        // still work as expected.
      `
    }
  ]
})
