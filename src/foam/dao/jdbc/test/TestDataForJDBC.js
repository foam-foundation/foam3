/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.jdbc.test',
  name: 'TestDataForJDBC',
  properties: [
    {
      class: 'Int',
      name: 'id',
      sqlType: 'int'
    },
    {
      class: 'String',
      name: 'name',
      sqlType: 'VARCHAR(40)'
    }
  ]
});

foam.CLASS({
  package: 'foam.dao.jdbc.test',
  name: 'TestCompany',
  properties: [
    {
      name: 'id',
      class: 'Long', // for testing seqno
      sqlType: 'bigint'
    },
    {
      name: 'name',
      class: 'String',
      sqlType: 'VARCHAR(40)'
    }
  ]
});

foam.CLASS({
  package: 'foam.dao.jdbc.test',
  name: 'TestEmployee',
  properties: [
    {
      name: 'id',
      class: 'Long',
      sqlType: 'bigint'
    },
    {
      name: 'firstName',
      class: 'String',
      sqlType: 'VARCHAR(40)'
    },
    {
      name: 'lastName',
      class: 'String',
      sqlType: 'VARCHAR(40)'
    }
  ]
});

//Foreign Key from TestEmployee to TestCompany
foam.RELATIONSHIP({
  sourceModel: 'foam.dao.jdbc.test.TestCompany',
  forwardName: 'employees',
  targetModel: 'foam.dao.jdbc.test.TestEmployee',
  inverseName: 'company'
});

