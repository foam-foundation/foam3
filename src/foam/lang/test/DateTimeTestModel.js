/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
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
    },
    {
      class: 'Date',
      name: 'derivedDate',
      documentation: `A date that only exists through its getter: unset until
        read, then taken from regularDate. Stands in for a property such as a
        file date parsed lazily out of a path, so a reader that goes straight
        to the backing field sees it unset.`,
      storageTransient: true,
      javaGetter: `
        if ( ! derivedDateIsSet_ && regularDateIsSet_ ) {
          derivedDate_ = regularDate_;
          derivedDateIsSet_ = true;
        }
        return foam.util.DateUtil.longToNullableDate(derivedDate_);
      `
    }
  ]
});
