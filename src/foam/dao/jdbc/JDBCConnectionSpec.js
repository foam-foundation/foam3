/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.jdbc',
  name: 'JDBCConnectionSpec',
  documentation: 'A JDBC Connection Specification to add to the system context.',
  properties: [
    {
      class: 'String',
      name: 'databaseServer'
    },
    {
      class: 'String',
      name: 'hostName'
    },
    {
      class: 'String',
      name: 'databaseName'
    },
    {
      class: 'String',
      name: 'userName'
    },
    {
      class: 'Password',
      name: 'userPassword'
    },
    {
      class: 'String',
      name: 'port'
    }
  ],
  methods: [
    {
        name: 'buildConnectionURI',
        type: 'String',
        javaCode: `
          if ( foam.util.SafetyUtil.equals(getDatabaseServer(), "mysql") )
            return "jdbc:" + getDatabaseServer() + "://" + getHostName() +
                   ( foam.util.SafetyUtil.isEmpty(getPort()) ? "" : ":" + getPort() ) +
                   "/" + getDatabaseName() + "?useUnicode=true&useJDBCCompliantTimezoneShift=true" +
                   "&useLegacyDatetimeCode=false&serverTimezone=UTC" +
                   "&user=" + getUserName() + "&password=" + getUserPassword();
          else if ( foam.util.SafetyUtil.equals(getDatabaseServer(), "postgresql") )
            return "jdbc:" + getDatabaseServer() + "://" + getHostName() +
                   ( foam.util.SafetyUtil.isEmpty(getPort()) ? "" : ":" + getPort() ) +
                   "/" + getDatabaseName() +
                   "?user=" + getUserName() +
                   "&password=" + getUserPassword();
          else throw new RuntimeException("Unsupported database server: " + getDatabaseServer());
        `
    }
  ]
});
