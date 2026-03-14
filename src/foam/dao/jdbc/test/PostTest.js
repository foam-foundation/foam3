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
    'foam.dao.jdbc.*',
    'foam.mlang.sink.*',
    'java.util.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        var jdbcSpec = x.get("JDBCConnectionSpec");
        test (jdbcSpec != null, "JDBCConnectionSpec found in context");

        var employeeDAO = (DAO) x.get("testEmployeeDAO");

        TestEmployee testObject = new TestEmployee.Builder(x)
          .setFirstName("Sam")
          .setLastName("King")
          .setCompany(1)
          .build();
        
        employeeDAO.put(testObject);

        testObject = new TestEmployee.Builder(x)
          .setFirstName("Mam")
          .setLastName("King")
          .setCompany(1)
          .build();

        employeeDAO.put(testObject);

        testObject = new TestEmployee.Builder(x)
          .setFirstName("Uam")
          .setLastName("King")
          .setCompany(1)
          .build();

        employeeDAO.put(testObject);

        Count count = (Count) employeeDAO.select(new Count());
        test(count.getValue() >= 3, "count: " + count.getValue());


        GroupBy gr = new GroupBy.Builder(x)
          .setArg1(foam.dao.jdbc.test.TestEmployee.FIRST_NAME)
          .setArg2(new Count())
          .build();
        gr = (GroupBy) employeeDAO.select(gr);
        test(gr.getGroups().size() >= 3, "right number of groups selected: " + gr.getGroups());
        test(((Count) gr.getGroups().get("Uam")).getValue() == ( count.getValue() / 3 ) , "right number in group: " + gr.getGroups().get("Uam"));

        ArraySink sink = (ArraySink) employeeDAO.select(new ArraySink());
        List<TestEmployee> list = sink.getArray();
        test(list.size() == count.getValue(), "normal select works");

      `
    }
  ]
})
