/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.util',
  name: 'DateService',

  documentation: `
    Service interface for date parsing, adaptation, and conversion operations.
    Provides centralized date handling functionality for the application.
  `,

  javaImports: [
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'java.util.Date'
  ],

  skeleton: true,
  skeletonImports: [
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'java.util.Date'
  ],
  client: true,
  clientImports: [
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'java.util.Date'
  ],

  methods: [
    {
      name: 'parseDateString',
      async: true,
      args: 'Context x, String d',
      type: 'Date',
      documentation: 'Parses date strings in formats: YYYY/MM/DD, MM/DD/YYYY, YY/MM/DD, YYYY-MM-DD, MM-DD-YYYY, YY-MM-DD'
    },
    {
      name: 'adapt',
      async: true,
      args: 'Context x, Object o',
      type: 'Date',
      documentation: 'Adapts various types to Date, normalizing to noon GMT'
    },
    {
      name: 'getTimeZoneId',
      async: true,
      args: 'Context x, String timeZoneStr',
      type: 'java.time.ZoneId',
      documentation: 'Gets timezone ID from context'
    },
    {
      name: 'localDateToDate',
      async: true,
      args: 'Context x, java.time.LocalDate localDate',
      type: 'Date',
      documentation: 'Converts a local date to Date at start of day in system timezone'
    },
    {
      name: 'localDateToDateWithZone',
      async: true,
      args: 'Context x, java.time.LocalDate localDate, java.time.ZoneId zone',
      type: 'Date',
      documentation: 'Converts a local date to Date at start of day in specified timezone'
    },
    {
      name: 'localDateTimeToDate',
      async: true,
      args: 'Context x, java.time.LocalDateTime localDateTime',
      type: 'Date',
      documentation: 'Converts a local datetime to Date using system timezone'
    },
    {
      name: 'localDateTimeToDateWithZone',
      async: true,
      args: 'Context x, java.time.LocalDateTime localDateTime, java.time.ZoneId zone',
      type: 'Date',
      documentation: 'Converts a local datetime to Date using specified timezone'
    },
    {
      name: 'dateToLocalDate',
      async: true,
      args: 'Context x, Date date',
      type: 'java.time.LocalDate',
      documentation: 'Converts Date to local date using system timezone (date only, no time)'
    },
    {
      name: 'dateToLocalDateWithZone',
      async: true,
      args: 'Context x, Date date, java.time.ZoneId zone',
      type: 'java.time.LocalDate',
      documentation: 'Converts Date to local date using specified timezone'
    },
    {
      name: 'dateToLocalDateTime',
      async: true,
      args: 'Context x, Date date',
      type: 'java.time.LocalDateTime',
      documentation: 'Converts Date to local datetime using system timezone'
    },
    {
      name: 'dateToLocalDateTimeWithZone',
      async: true,
      args: 'Context x, Date date, java.time.ZoneId zone',
      type: 'java.time.LocalDateTime',
      documentation: 'Converts Date to local datetime using specified timezone'
    },
    {
      name: 'getMaxDate',
      async: true,
      args: 'Context x',
      type: 'Date',
      documentation: 'Returns the maximum date value'
    },
    {
      name: 'parseDateTimeString',
      async: true,
      args: 'Context x, String d',
      type: 'Date',
      documentation: 'Parses datetime strings with time components in formats: YYYY-MM-DDTHH:MM:SS, YYYY-MM-DD HH:MM:SS, MM/DD/YYYY HH:MM:SS, YYYYMMDDHHMMSS'
    }
  ]
});
