/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'PermissionedPropertyDAOTestAddress',

  documentation: 'Nested test model whose code needs permissionedpropertydaotestaddress.ro.code to read.',

  properties: [
    {
      class: 'Long',
      name: 'code',
      readPermissionRequired: true
    }
  ]
});


foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'PermissionedPropertyDAOTestEmployee',

  documentation: 'Test model whose salary needs permissionedpropertydaotestemployee.ro.salary to read.',

  properties: [
    {
      class: 'Long',
      name: 'id'
    },
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'Long',
      name: 'salary',
      readPermissionRequired: true
    },
    {
      class: 'String',
      name: 'notes',
      readPermissionRequired: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.auth.test.PermissionedPropertyDAOTestAddress',
      name: 'address'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.auth.test',
  name: 'PermissionedPropertyDAOTest',
  extends: 'foam.core.test.Test',

  documentation: `A user who may not read salary must not be able to filter or
    sort on it either, whatever form the query takes; otherwise repeated
    selects with salary > N binary-search the hidden value.`,

  javaImports: [
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.PermissionedPropertyDAO',
    'foam.core.auth.ProxyAuthService',
    'foam.core.column.NestedPropertiesExpression',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'foam.mlang.Constant',
    'foam.mlang.order.Comparator',
    'foam.mlang.predicate.AQLExpr',
    'foam.mlang.predicate.FScriptPredicate',
    'foam.mlang.predicate.Keyword',
    'foam.mlang.predicate.MQLExpr',
    'foam.mlang.predicate.NamedProperty',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Count',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        X denyX  = x.put("auth", new ProxyAuthService() {
          @Override
          public boolean check(X x, String permission) {
            return ! permission.contains(".ro.") && ! permission.contains(".rw.");
          }
        });
        X allowX = x.put("auth", new ProxyAuthService() {
          @Override
          public boolean check(X x, String permission) { return true; }
        });

        DAO dao = new PermissionedPropertyDAO.Builder(x)
          .setDelegate(new MDAO(PermissionedPropertyDAOTestEmployee.getOwnClassInfo()))
          .build();
        dao.put(new PermissionedPropertyDAOTestEmployee.Builder(x).setId(1).setName("alice").setSalary(60000).setNotes("hidden-alpha")
          .setAddress(new PermissionedPropertyDAOTestAddress.Builder(x).setCode(7).build()).build());
        dao.put(new PermissionedPropertyDAOTestEmployee.Builder(x).setId(2).setName("bob").setSalary(40000).setNotes("hidden-beta")
          .setAddress(new PermissionedPropertyDAOTestAddress.Builder(x).setCode(3).build()).build());

        var SALARY = PermissionedPropertyDAOTestEmployee.SALARY;
        var NAME   = PermissionedPropertyDAOTestEmployee.NAME;

        var nested = new NestedPropertiesExpression.Builder(x)
          .setObjClass(PermissionedPropertyDAOTestEmployee.getOwnClassInfo())
          .setNestedProperty("salary")
          .build();
        var fscript = new FScriptPredicate.Builder(x).setQuery("salary>50000").build();

        Predicate[] salaryPredicates = new Predicate[] {
          GT(SALARY, 50000),
          MQLExpr.create("salary>50000"),
          AQLExpr.create("salary>50000"),
          GT(NamedProperty.create("salary"), 50000),
          AND(EQ(NAME, "alice"), OR(EQ(NAME, "bob"), GT(SALARY, 50000))),
          NOT(GT(SALARY, 50000)),
          GT(ADD(SALARY, 0), 50000),
          GT(nested, 50000),
          fscript
        };
        String[] labels = new String[] {
          "property", "MQLExpr", "AQLExpr", "NamedProperty", "nested AND/OR",
          "NOT", "Formula", "NestedPropertiesExpression", "FScriptPredicate"
        };

        for ( int i = 0 ; i < salaryPredicates.length ; i++ ) {
          test(isDenied(denyX, dao, salaryPredicates[i], null),
            labels[i] + " on salary is denied without the read permission");
        }

        // Positive controls: each string or composite form really reads salary,
        // so the denials above are not an unparsed query that read nothing.
        expect(count(allowX, dao, MQLExpr.create("salary>50000")),        1L, "MQLExpr matches alice when permitted");
        expect(count(allowX, dao, AQLExpr.create("salary>50000")),        1L, "AQLExpr matches alice when permitted");
        expect(count(allowX, dao, GT(NamedProperty.create("salary"), 50000)), 1L, "NamedProperty matches alice when permitted");
        expect(count(allowX, dao, GT(ADD(SALARY, 0), 50000)),            1L, "Formula matches alice when permitted");
        expect(count(allowX, dao, GT(nested, 50000)),                    1L, "NestedPropertiesExpression matches alice when permitted");
        expect(count(allowX, dao, fscript),                              1L, "FScriptPredicate matches alice when permitted");

        // address.code is read from the nested Address, not from the Employee
        // being queried, so the check has to resolve it against Address.
        var nestedFScript = new FScriptPredicate.Builder(x).setQuery("address.code>5").build();
        test(isDenied(denyX, dao, nestedFScript, null),            "FScript address.code is denied without the Address read permission");
        expect(count(allowX, dao, nestedFScript), 1L,              "FScript address.code matches alice when permitted");

        // The search box sends TEXT:abc as a Keyword. Matching hidden notes
        // would reveal them a substring at a time, so they are never searched,
        // while the visible name still is.
        expect(count(allowX, dao, keyword("hidden-alpha")), 0L,    "Keyword never matches the hidden notes");
        expect(count(denyX,  dao, keyword("alice")),        1L,    "Keyword still matches the visible name");

        test(isDenied(denyX, dao, null, SALARY),                 "ORDER BY salary is denied");
        test(isDenied(denyX, dao, null, DESC(SALARY)),           "ORDER BY salary DESC is denied");
        test(isDenied(denyX, dao, null, THEN_BY(NAME, SALARY)),  "ORDER BY name, salary is denied");

        // Queries that never touch salary must still work for the same user.
        test(! isDenied(denyX, dao, MQLExpr.create("name=alice"), null), "MQLExpr on name is allowed");
        test(! isDenied(denyX, dao, EQ(NAME, "alice"), DESC(NAME)),      "filter and sort on name are allowed");
        expect(count(denyX, dao, AQLExpr.create("name=alice")), 1L,      "AQLExpr on name matches alice");
      `
    },
    {
      name: 'isDenied',
      type: 'Boolean',
      args: 'X x, foam.dao.DAO dao, foam.mlang.predicate.Predicate predicate, foam.mlang.order.Comparator order',
      javaCode: `
        try {
          dao.select_(x, new Count(), 0, 1000, order, predicate);
          return false;
        } catch ( AuthorizationException e ) {
          return true;
        }
      `
    },
    {
      name: 'keyword',
      type: 'foam.mlang.predicate.Predicate',
      args: 'String text',
      javaCode: `
        Keyword keyword = new Keyword();
        keyword.setArg1(new Constant(text));
        return keyword;
      `
    },
    {
      name: 'count',
      type: 'Long',
      args: 'X x, foam.dao.DAO dao, foam.mlang.predicate.Predicate predicate',
      javaCode: `
        return ((Count) dao.select_(x, new Count(), 0, 1000, null, predicate)).getValue();
      `
    }
  ]
});
