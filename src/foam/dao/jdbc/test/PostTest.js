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
    'foam.core.logger.Logger',
    'foam.lang.*',
    'foam.dao.jdbc.*',
    'foam.mlang.sink.*',
    'java.sql.Connection',
    'java.sql.ResultSet',
    'java.sql.Statement',
    'java.util.*',
    'static foam.mlang.MLang.*',
    'foam.mlang.predicate.FScriptPredicate',
    'foam.util.SafetyUtil',
    'foam.dao.index.AddIndexCommand'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        var jdbcSpec = x.get("JDBCConnectionSpec");
        test (jdbcSpec != null, "JDBCConnectionSpec found in context");

        var employeeDAO = (DAO) x.get("testEmployeeDAO");
        employeeDAO.removeAll();

        TestEmployee testObject = new TestEmployee.Builder(x)
          .setFirstName("Sam")
          .setLastName("King")
          .setCompany(1)
          .build();
        testObject = (TestEmployee) employeeDAO.put(testObject);
        test(testObject != null, "employee #1 created with Id: " + testObject.getId());

        testObject = new TestEmployee.Builder(x)
          .setFirstName("Mam")
          .setLastName("King")
          .setCompany(1)
          .build();
        testObject = (TestEmployee) employeeDAO.put(testObject);
        test(testObject != null, "employee #2 created with Id: " + testObject.getId());

        testObject = new TestEmployee.Builder(x)
          .setFirstName("Uam")
          .setLastName("King")
          .setCompany(1)
          .build();
        testObject = (TestEmployee) employeeDAO.put(testObject);
        test(testObject != null, "employee #3 created with Id: " + testObject.getId());

        testObject = new TestEmployee.Builder(x)
          .setFirstName("Tobe")
          .setLastName("Removed")
          .setCompany(1)
          .build();
        testObject = (TestEmployee) employeeDAO.put(testObject);
        test(testObject != null, "employee #4 created with Id: " + testObject.getId());

        // Test Count
        Count count = (Count) employeeDAO.select(new Count());
        test(count.getValue() >= 3, "count: " + count.getValue());

        // Test GroupBy
        GroupBy gr = new GroupBy.Builder(x)
          .setArg1(foam.dao.jdbc.test.TestEmployee.FIRST_NAME)
          .setArg2(new Count())
          .build();
        gr = (GroupBy) employeeDAO.select(gr);
        test(gr.getGroups().size() >= 3, "right number of groups selected: " + gr.getGroups());
        test(((Count) gr.getGroups().get("Uam")).getValue() == ( count.getValue() / 3 ) , "Right number in group: " + gr.getGroups().get("Uam"));

        // Test select
        ArraySink sink = (ArraySink) employeeDAO.select(new ArraySink());
        List<TestEmployee> employees = sink.getArray();
        test(employees.size() == count.getValue(), "normal select works");

        // FScriptPredicate doesn't work because createStatement isn't implemented
        // // Test find with FScriptPredicate
        // employee = (TestEmployee) employeeDAO.find(new FScriptPredicate("id==1", null));
        // test(employee != null && employee.getId() == 1, "Find FScriptPredicate 1");
        // // Test select with FScriptPredicate
        // results = (List) ((ArraySink) employeeDAO.select_(x, new ArraySink(), 0, 0, null, new FScriptPredicate("id==3", null))).getArray();
        // test(results.size() == 1, "Select FScriptPredicate size expected 1, found " + results.size());

        // Test find by FObject
        TestEmployee employee = (TestEmployee) employeeDAO.find(employees.get(0));
        test(employee != null && employee.getId() == ((TestEmployee) employees.get(0)).getId(), "find by FObject returns employee");

        // Test find by property of identityExpr
        employee = (TestEmployee) employeeDAO.find(((TestEmployee) employees.get(0)).getId());
        test(employee != null && employee.getId() == ((TestEmployee) employees.get(0)).getId(), "Find by Id works" + employee);

        // Test find with predicate
        employee = (TestEmployee) employeeDAO.find(EQ(TestEmployee.FIRST_NAME, "Tobe"));
        test(employee != null && SafetyUtil.equals(employee.getFirstName(), "Tobe"), "find by predicate works");

        // Test select with Predicate
        var results = (List) ((ArraySink) employeeDAO.select_(x, new ArraySink(), 0, 0, null, EQ(TestEmployee.ID, 1))).getArray();
        test(results.size() == 1, "Select Predicate size expected 1, found "+results.size());

        // Test remove
        employeeDAO.remove(employee); // remove Tobe Removed

        // Test size reduced after remove
        results = (List) ((ArraySink) employeeDAO.select(new ArraySink())).getArray();
        test(results != null && employees.size() == results.size() + 1, "Select after remove returns right number of employees");

        // Test correct removed item removed.
        employee = (TestEmployee) employeeDAO.find(employee);
        test(employee == null, "Removed employee not found");

        // Test removeAll with predicate
        Count beforeRemove = (Count) employeeDAO.select(new Count());
        employeeDAO.where(EQ(TestEmployee.FIRST_NAME, "Sam")).removeAll();
        Count afterRemove = (Count) employeeDAO.select(new Count());
        test(afterRemove.getValue() < beforeRemove.getValue(), "removeAll with predicate reduced count: " + beforeRemove.getValue() + " -> " + afterRemove.getValue());
        employee = (TestEmployee) employeeDAO.find(EQ(TestEmployee.FIRST_NAME, "Sam"));
        test(employee == null, "removeAll with predicate: Sam no longer found");

        // Test removeAll with no predicate
        employeeDAO.removeAll();
        count = (Count) employeeDAO.select(new Count());
        test(count.getValue() == 0, "removeAll with no predicate: table empty, count = " + count.getValue());
      

        addRowsForIndexTest(x, employeeDAO, 10000);
        boolean usingIndex = checkExplainUsesIndex(x, "select * from testemployee where firstname = 'Uam' and id > 2000");
        var disclaimer = "it SHOULD be using the index, but it's alright if it doesn't";
        test(usingIndex, "explain uses index for firstname = 'Uam' and id > 2000, " + disclaimer);
      `
    },
    {
      name: 'checkExplainUsesIndex',
      args: 'X x, String sql',
      type: 'Boolean',
      javaCode: `
        Connection c = null;
        Statement stmt = null;
        ResultSet resultSet = null;

        JDBCPooledDataSource jp = new foam.dao.jdbc.JDBCPooledDataSource(x);
        javax.sql.DataSource dataSource_ = jp.getDataSource();

        try {
          c = dataSource_.getConnection();
          stmt = c.createStatement();
          resultSet = stmt.executeQuery("explain " + sql);
          while ( resultSet.next() ) {
            String line = resultSet.getString(1);
            if ( line != null && (
              line.contains("Bitmap Index Scan") ||
              line.contains("Bitmap Heap Scan")
            ) ) {
              return true;
            }
          }

          return false;
        } catch ( Throwable t ) {
          Logger logger = (Logger) x.get("logger");
          if ( logger != null ) logger.error(t);
          return false;
        } finally {
          try {
            if ( resultSet != null ) resultSet.close();
            if ( stmt != null ) stmt.close();
            if ( c != null ) c.close();
          } catch ( Throwable e ) {}
        }
      `
    },
    {
      name: 'addRowsForIndexTest',
      args: 'X x, DAO employeeDAO, int rows',
      type: 'Void',
      javaCode: `
        for ( int i = 0; i < rows; i++ ) {
          String firstName;
          if ( i % 1000 == 0 ) {
            firstName = "Uam";
          } else if ( i % 3 == 0 ) {
            firstName = "Sam";
          } else if ( i % 3 == 1 ) {
            firstName = "Mam";
          } else {
            firstName = "Tobe";
          }
          TestEmployee obj = new TestEmployee.Builder(x)
            .setFirstName(firstName)
            .setLastName("L" + i)
            .setCompany(1)
            .build();
          obj = (TestEmployee) employeeDAO.put(obj);
        }
      `
    }
  ]
})
