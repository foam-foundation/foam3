/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'jdbc',

  files: [
    { name: "JDBCConnectionSpec",                       flags: "js|java" },
    { name: "ConnectionPool",                           flags: "js|java" },
    { name: "test/TestDataForJDBC",                     flags: "js&test|java&test" },
    { name: "test/PostTest",                            flags: "js&test|java&test" },
  ],

  javaFiles: [
    { name: "IndexedPreparedStatement" },
    { name: "JDBCPooledDataSource" },
    { name: "AbstractJDBCDAO" },
    { name: "MySQLDAO" },
    { name: "PostgresDAO" }
  ],

  javaDependencies: [
    'mysql:mysql-connector-java:8.0.16'
  ]
});