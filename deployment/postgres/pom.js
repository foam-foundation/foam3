/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'postgres',

  projects: [
    { name: '../../src/foam/dao/jdbc/pom' }
  ],

  javaDependencies: [
    'org.apache.commons:commons-dbcp2:2.14.0 -xml-apis:xml-apis -xerces:xerces',
    'org.apache.commons:commons-pool2:2.13.1',
    'org.postgresql:postgresql:42.7.14',
  ]
});
