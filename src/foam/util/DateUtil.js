/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util',
  name: 'DateUtil',

  documentation: `
    Backward compatibility wrapper for DateUtil.
    Delegates to DateService for all operations.

    DEPRECATED: Use DateService directly via dependency injection instead.
    This class exists only for backward compatibility with existing code.
  `,

  javaImports: [
    'foam.util.DateService',
    'foam.util.DateServiceImpl',
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId',
    'java.util.Date'
  ],

  constants: [
    {
      name: 'MAX_DATE',
      type: 'Date',
      factory: function() {
        return new Date(8640000000000000);
      },
      javaFactory: 'return new Date(Long.MAX_VALUE);'
    }
  ],

  javaCode: `
    // Static method wrappers for backward compatibility
    public static Date parseDateString(String d) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.parseDateString(x, d);
    }

    public static Date adapt(Object o) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.adapt(x, o);
    }

    public static ZoneId getTimeZoneId(foam.lang.X x, String timeZoneStr) {
      DateService service = (DateService) x.get("dateService");
      return service.getTimeZoneId(x, timeZoneStr);
    }

    public static Date localDateToDate(LocalDate localDate) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.localDateToDate(x, localDate);
    }

    public static Date localDateTimeToDate(LocalDateTime localDateTime) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.localDateTimeToDate(x, localDateTime);
    }

    public static LocalDate dateToLocalDate(Date date) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.dateToLocalDate(x, date);
    }

    public static LocalDateTime dateToLocalDateTime(Date date) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.dateToLocalDateTime(x, date);
    }

    // Java method overloads with ZoneId for backward compatibility
    public static Date localDateToDate(LocalDate localDate, ZoneId zone) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.localDateToDateWithZone(x, localDate, zone);
    }

    public static Date localDateTimeToDate(LocalDateTime localDateTime, ZoneId zone) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.localDateTimeToDateWithZone(x, localDateTime, zone);
    }

    public static LocalDate dateToLocalDate(Date date, ZoneId zone) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.dateToLocalDateWithZone(x, date, zone);
    }

    public static LocalDateTime dateToLocalDateTime(Date date, ZoneId zone) {
      foam.lang.X x = foam.lang.XLocator.get();
      DateService service = (DateService) x.get("dateService");
      return service.dateToLocalDateTimeWithZone(x, date, zone);
    }
  `
});
