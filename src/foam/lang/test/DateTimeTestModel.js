/**
 * @license
 * Copyright 2025 PayTic. All Rights Reserved.
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'DateTimeTestModel',

  documentation: 'Test model with both DateTime and DateTimeUTC properties for comparison',

  properties: [
    {
      class: 'Long',
      name: 'id'
    },
    {
      class: 'DateTime',
      name: 'regularDateTime',
      documentation: 'Standard DateTime property - formats in local timezone'
    },
    {
      class: 'DateTimeUTC',
      name: 'utcDateTime',
      documentation: 'DateTimeUTC property - formats in UTC timezone'
    },
    {
      class: 'Date',
      name: 'regularDate',
      documentation: 'Standard Date property'
    },
    {
      class: 'String',
      name: 'eventName'
    }
  ]
});
