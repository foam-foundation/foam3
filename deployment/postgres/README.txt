Explicit support for PostgresDAO removed from EasyDAO.
To add, craft a services entry which sets the innerDAO to a PostgresDAO.
The PostgresDAO will pull "JDBCConnectionSpec" from the context for connection
parameters (See foam.dao.jdbc.JDBCPooledDataSource and AbstractJDBCDAO).

NOTE: the default implementation only supports a single JDBCConnectionSpec. To
support multiple databases and connections, for each, create a uniquely named
service entry and place it in a sub-context passed to the PostgresDAO.
(example below)

p({
  "class":"foam.core.boot.CSpec",
  "name":"exampleJDBCConnectionSpec",
  "lazy":true,
  "serve":false,
  "class":"foam.core.boot.CSpec",
  "service":{
    "class":"foam.dao.jdbc.JDBCConnectionSpec",
    "databaseServer":"postgresql",
    "hostName":"localhost",
    "databaseName":"testSQLDAO",
    "userName":"foam_user",
    "userPassword":"foam_password",
    "port":5432
  }
})

p({
  "class": "foam.core.boot.CSpec",
  "name": "exampleDAO",
  "description": "DAO backed postgresql",
  "authenticate": true,
  "serviceScript": """
    x = x.put("JDBCConnectionSpec", x.get("exampleJDBCConnectionSpec"));
    x = x.put("JDBCDataSource", new foam.dao.jdbc.JDBCPooledDataSource(x, "PoolA"));
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.Example.getOwnClassInfo())
      .setInnerDAO(new foam.dao.jdbc.PostgresDAO(x, com.example.Example.getOwnClassInfo()))
      .build()
  """
})
