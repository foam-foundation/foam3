/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.measure',
  name: 'Measure',
  documentation: `
    Common help methods for all Measures.
  `,
  javaGenerateDefaultConstructor: false,
  javaGenerateConvenienceConstructor: false,

  javaImports: [
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.lang.XLocator',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'static foam.mlang.MLang.*',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.predicate.True',
    'foam.util.DateService',
    'java.text.SimpleDateFormat',
    'java.time.*',
    'java.util.*',
    'java.util.stream.Stream',
    'java.util.stream.Collectors',
    'java.util.function.BiFunction',
  ],

  constants: [
    {
      documentation: 'Would prefer this as a property, but we are using from static calls',
      name: 'TIME_ZONE',
      type: 'String',
      value: 'America/Toronto'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'daoKey'
    },
    {
      class: 'Object',
      javaType: 'foam.lang.PropertyInfo',
      documentation: 'PropertyInfo for a `date` in the model.',
      name: 'dateFilterKey'
    },
    {
      class: 'Object',
      javaType: 'foam.mlang.predicate.Predicate',
      name: 'basePredicate',
      javaFactory: `
        return new foam.mlang.predicate.True();
      `
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      javaFactory: `
        var dao = (DAO) getX().get(getDaoKey());
        if ( dao == null ) throw new RuntimeException("DAO: \`" + getDaoKey() + "\` Not Found." );
        return (DAO) getX().get(getDaoKey());
      `
    }
  ],

  methods: [
    {
      name: 'between',
      args: 'Date from, Date to',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return AND(
          GTE((PropertyInfo) getDateFilterKey(), from),
          LTE((PropertyInfo) getDateFilterKey(), to)
        );
      `
    },
    {
      name: 'openBetween',
      args: 'Date from, Date to',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return AND(
          GTE((PropertyInfo) getDateFilterKey(), from),
          LT((PropertyInfo) getDateFilterKey(), to)
        );
      `
    },
    {
      name: 'from',
      args: 'Date d',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return GTE((PropertyInfo) getDateFilterKey(), d);
      `
    },
    {
      name: 'until',
      args: 'Date d',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return LTE((PropertyInfo) getDateFilterKey(), d);
      `
    },
    {
      name: 'lastNDay',
      args: 'int n',
      type: 'foam.mlang.predicate.Predicate',
      documentation: `
        Count from today
        TODO: this method base on the LocalDate, make it support the timezone.
      `,
      javaCode: `
        LocalDate localDate = LocalDate.now();
        LocalDateTime startOfDay = localDate.atStartOfDay();
        LocalDateTime to = startOfDay.plusDays(1);
        LocalDateTime from = startOfDay.minusDays(n);
        return between(toDate(from), toDate(to));
      `
    },
    {
      name: 'thisHour',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return lastNHourInterval(1).get(0);
      `
    },
    {
      name: 'today',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return lastNDayInterval(1).get(0);
      `
    },
    {
      name: 'thisWeek',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return lastNWeekInterval(1).get(0);
      `
    },
    {
      name: 'thisMonth',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return lastNMonthInterval(1).get(0);
      `
    },
    {
      name: 'thisQuarter',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return lastNQuarterInterval(1).get(0);
      `
    },
    {
      name: 'thisYear',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
        return lastNYearInterval(1).get(0);
      `
    },
    {
      name: 'lastNHourInterval',
      args: 'int n',
      type: 'java.util.List<foam.mlang.predicate.Predicate>',
      documentation: 'Return array of daily range predicate for Date',
      javaCode: `
        var starts = startOfLastNHour(n);
        var ends = endOfLastNHour(n);
        var rets = new ArrayList<foam.mlang.predicate.Predicate>(n);
        for ( int i = 0 ; i < starts.size() ; i++ ) {
          rets.add(openBetween(starts.get(i), ends.get(i)));
        }
        return rets;
      `
    },
    {
      name: 'lastNDayInterval',
      args: 'int n',
      type: 'java.util.List<foam.mlang.predicate.Predicate>',
      documentation: 'Return array of daily range predicate for Date',
      javaCode: `
        var starts = startOfLastNDay(n);
        var ends = endOfLastNDay(n);
        var rets = new ArrayList<foam.mlang.predicate.Predicate>(n);
        for ( int i = 0 ; i < starts.size() ; i++ ) {
          rets.add(openBetween(starts.get(i), ends.get(i)));
        }
        return rets;
      `
    },
    {
      name: 'lastNWeekInterval',
      args: 'int n',
      type: 'java.util.List<foam.mlang.predicate.Predicate>',
      documentation: 'Return array of weekly range predicate for Date',
      javaCode: `
        var starts = startOfLastNWeek(n);
        var ends = endOfLastNWeek(n);
        var rets = new ArrayList<foam.mlang.predicate.Predicate>(n);
        for ( int i = 0 ; i < starts.size() ; i++ ) {
          rets.add(openBetween(starts.get(i), ends.get(i)));
        }
        return rets;
      `
    },
    {
      name: 'lastNMonthInterval',
      args: 'int n',
      type: 'java.util.List<foam.mlang.predicate.Predicate>',
      documentation: 'Return array of monthly range predicate for Date',
      javaCode: `
        var starts = startOfLastNMonth(n);
        var ends = endOfLastNMonth(n);
        var rets = new ArrayList<foam.mlang.predicate.Predicate>(n);
        for ( int i = 0 ; i < starts.size() ; i++ ) {
          rets.add(openBetween(starts.get(i), ends.get(i)));
        }
        return rets;
      `
    },
    {
      name: 'lastNYearInterval',
      args: 'int n',
      type: 'java.util.List<foam.mlang.predicate.Predicate>',
      documentation: 'Return array of yearly range predicate for Date',
      javaCode: `
        var starts = startOfLastNYear(n);
        var ends = endOfLastNYear(n);
        var rets = new ArrayList<foam.mlang.predicate.Predicate>(n);
        for ( int i = 0 ; i < starts.size() ; i++ ) {
          rets.add(openBetween(starts.get(i), ends.get(i)));
        }
        return rets;
      `
    },
    {
      name: 'lastNQuarterInterval',
      args: 'int n',
      type: 'java.util.List<foam.mlang.predicate.Predicate>',
      documentation: 'Return array of quarterly range predicate for Date',
      javaCode: `
        var starts = startOfLastNQuarter(n);
        var ends = endOfLastNQuarter(n);
        var rets = new ArrayList<foam.mlang.predicate.Predicate>(n);
        for ( int i = 0 ; i < starts.size() ; i++ ) {
          rets.add(openBetween(starts.get(i), ends.get(i)));
        }
        return rets;
      `
    },
    {
      name: 'getDateRangePredicates',
      args: 'String intervalType, int intervalStep',
      javaType: 'java.util.List<foam.mlang.predicate.Predicate>',
      javaCode: `
        switch(intervalType) {
          case "hourly":
            return lastNHourInterval(intervalStep);
          case "daily":
            return lastNDayInterval(intervalStep);
          case "weekly":
            return lastNWeekInterval(intervalStep);
          case "monthly":
            return lastNMonthInterval(intervalStep);
          case "quarterly":
            return lastNQuarterInterval(intervalStep);
          default:
            throw new RuntimeException("Unsupport type");
        }
      `
    },
    {
      name: 'getStartDateLabels',
      args: 'Measure m',
      args: 'String intervalType, int intervalStep',
      javaType: 'java.util.List<String>',
      javaCode: `
        switch(intervalType) {
          case "hourly":
            return startOfLastNHour(intervalStep).stream().map(d -> _hour_format.get().format(d)).collect(Collectors.toList());
          case "daily":
            return startOfLastNDay(intervalStep).stream().map(d -> _day_format.get().format(d)).collect(Collectors.toList());
          case "weekly":
            return startOfLastNWeek(intervalStep).stream().map(d -> _day_format.get().format(d)).collect(Collectors.toList());
          case "monthly":
            return startOfLastNMonth(intervalStep).stream().map(d -> _month_format.get().format(d)).collect(Collectors.toList());
          case "quarterly":
            return startOfLastNQuarter(intervalStep).stream().map(d -> _month_format.get().format(d)).collect(Collectors.toList());
          default:
            throw new RuntimeException("Unsupport type");
        }
      `
    }
  ],

  javaCode: `

    public Measure() {
      throw new RuntimeException("The constructor is prohibited");
    }

    public Measure(X x) {
      this(x, null, null);
    }

    public Measure(X x, PropertyInfo dateFilterKey, Predicate basePredicate) {
      if ( x != null ) setX(x);
      if ( dateFilterKey != null ) setDateFilterKey(dateFilterKey);
      if ( basePredicate != null ) setBasePredicate(basePredicate);
    }

    protected Date toDate(LocalDateTime t) {
      DateService service = (DateService) getX().get("dateService");
      return Date.from(t.atZone(service.getTimeZoneId(getX(), TIME_ZONE)).toInstant());
    }

    public <T> List<T> fetch() {
      return fetch(new foam.mlang.predicate.True());
    }

    public <T> List<T> fetch(Predicate datePredicate) {
      return fetch(datePredicate, i -> true);
    }

    public <T> List<T> fetch(Predicate datePredicate, java.util.function.Predicate<T>... ps) {
      DAO dao = getDao();
      List<T> items = ((ArraySink) dao.where(
        AND(
          getBasePredicate(),
          datePredicate
        )
      ).select(new ArraySink())).getArray();

      var t = items.stream();
      for (java.util.function.Predicate<T> p : ps) {
        t = t.filter(p);
      }

      return t.collect(Collectors.toList());
    }

    public <T> Double aggregate(BiFunction<Double, T, Double> accumulator) {
      return this.<T, T>aggregate(new foam.mlang.predicate.True(), i -> i, accumulator, i -> true);
    }

    public <T> Double aggregate(Predicate datePredicate, BiFunction<Double, T, Double> accumulator) {
      return this.<T, T>aggregate(datePredicate, i -> i, accumulator, i -> true);
    }

    public <T> Double aggregate(Predicate datePredicate, BiFunction<Double, T, Double> accumulator, java.util.function.Predicate<T>... ps) {
      return this.<T, T>aggregate(datePredicate, i -> i, accumulator, ps);
    }

    public <T, F> Double aggregate(Predicate datePredicate, java.util.function.Function<T, F> mapper, BiFunction<Double, F, Double> accumulator, java.util.function.Predicate<F>... ps) {
      DAO dao = getDao();
      List<T> items = ((ArraySink) dao.where(
        AND(
          getBasePredicate(),
          datePredicate
        )
      ).select(new ArraySink())).getArray();

      var t = items.stream();
      var m = t.map(mapper);
      for (java.util.function.Predicate<F> p : ps) {
        m = m.filter(p);
      }
      return m.reduce(0.0, accumulator, (d1, d2) -> d1+d2);
    }

    static final String DAY_PATTERN = "yyyy-MM-dd";

    // Support format: yyyy-MM-dd
    public static Date parseDay(String dayString) {
      SimpleDateFormat dateFormat = new SimpleDateFormat(DAY_PATTERN);
      try {
        return dateFormat.parse(dayString);
      } catch ( Exception e ) {
        return null;
      }
    }

    public java.util.function.Predicate not(java.util.function.Predicate p) {
      return (t) -> !p.test(t);
    }

    public java.util.function.Predicate oneOf(java.util.function.Predicate... ps) {
      return (t) -> {
        for (java.util.function.Predicate p : ps) {
          if ( p.test(t) ) return true;
        }
        return false;
      };
    }

    public java.util.function.Predicate allOf(java.util.function.Predicate... ps) {
      return (t) -> {
        for (java.util.function.Predicate p : ps) {
          if ( ! p.test(t) ) return false;
        }
        return true;
      };
    }

    public Date lastDay(int dayJump) {
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.HOUR_OF_DAY, 24);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);
      calendar.add(Calendar.DAY_OF_MONTH, -1*dayJump);
      return calendar.getTime();
    }


    public Date startOfDay() {
      return startOfLastNDay(1).get(0);
    }

    public Date endOfDay() {
      return endOfLastNDay(1).get(0);
    }

    public List<Date> startOfLastNHour(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.HOUR_OF_DAY, -1);
      }
      return ret;
    }

    public List<Date> endOfLastNHour(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);
      calendar.add(Calendar.HOUR_OF_DAY, 1);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.HOUR_OF_DAY, -1);
      }
      return ret;
    }

    public List<Date> startOfLastNDay(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.DAY_OF_MONTH, -1);
      }
      return ret;
    }

    public List<Date> endOfLastNDay(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.HOUR_OF_DAY, 24);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.DAY_OF_MONTH, -1);
      }
      return ret;
    }

    public Date startOfWeek() {
      return startOfLastNWeek(1).get(0);
    }

    public Date endOfWeek() {
      return endOfLastNWeek(1).get(0);
    }

    public List<Date> startOfLastNWeek(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.DAY_OF_WEEK, 1);
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.WEEK_OF_YEAR, -1);
      }
      return ret;
    }

    public List<Date> endOfLastNWeek(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.DAY_OF_WEEK, 0);
      calendar.set(Calendar.HOUR_OF_DAY, 24);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.WEEK_OF_YEAR, -1);
      }
      return ret;
    }

    public Date startOfMonth() {
      return startOfLastNMonth(1).get(0);
    }

    public Date endOfMonth() {
      return endOfLastNMonth(1).get(0);
    }

    public List<Date> startOfLastNMonth(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.DAY_OF_MONTH, 1);
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.MONTH, -1);
      }
      return ret;
    }

    public List<Date> endOfLastNMonth(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) getX().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(getX(), TIME_ZONE)));
      calendar.set(Calendar.DAY_OF_MONTH, 1);
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);
      calendar.add(Calendar.MONTH, 1);
    
      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.MONTH, -1);
      }
      return ret;
    }

    public static List<Date> startOfLastNYear(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) XLocator.get().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(XLocator.get(), TIME_ZONE)));
      calendar.set(Calendar.MONTH, 0);
      calendar.set(Calendar.DAY_OF_MONTH, 1);
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.YEAR, -1);
      }
      return ret;
    }

    public static List<Date> endOfLastNYear(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) XLocator.get().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(XLocator.get(), TIME_ZONE)));
      calendar.set(Calendar.MONTH, 0);
      calendar.set(Calendar.DAY_OF_MONTH, 1);
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);
      calendar.add(Calendar.YEAR, 1);
    
      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.YEAR, -1);
      }
      return ret;
    }

    public static List<Date> startOfLastNQuarter(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) XLocator.get().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(XLocator.get(), TIME_ZONE)));
      calendar.set(Calendar.DAY_OF_MONTH, 1);
      calendar.set(Calendar.MONTH, calendar.get(Calendar.MONTH)/3 * 3);
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);

      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.MONTH, -3);
      }
      return ret;
    }

    public static List<Date> endOfLastNQuarter(int n) {
      var ret = new ArrayList(n);
      DateService service = (DateService) XLocator.get().get("dateService");
      Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(service.getTimeZoneId(XLocator.get(), TIME_ZONE)));
      calendar.set(Calendar.DAY_OF_MONTH, 1);
      calendar.set(Calendar.MONTH, calendar.get(Calendar.MONTH)/3 * 3 + 2);
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);
    
      for ( int i = 0 ; i < n ; i++ ) {
        ret.add(0, calendar.getTime());
        calendar.add(Calendar.MONTH, -3);
      }
      return ret;
    }

    protected static ThreadLocal<SimpleDateFormat> _hour_format = new ThreadLocal<SimpleDateFormat>() {
      @Override
      protected SimpleDateFormat initialValue() {
        SimpleDateFormat df = new SimpleDateFormat("HH:mm");
        DateService service = (DateService) XLocator.get().get("dateService");
        df.setTimeZone(TimeZone.getTimeZone(service.getTimeZoneId(XLocator.get(), TIME_ZONE)));
        return df;
      }
    };

    protected static ThreadLocal<SimpleDateFormat> _day_format = new ThreadLocal<SimpleDateFormat>() {
      @Override
      protected SimpleDateFormat initialValue() {
        SimpleDateFormat df = new SimpleDateFormat("MMM/dd");
        DateService service = (DateService) XLocator.get().get("dateService");
        df.setTimeZone(TimeZone.getTimeZone(service.getTimeZoneId(XLocator.get(), TIME_ZONE)));
        return df;
      }
    };

    protected static ThreadLocal<SimpleDateFormat> _month_format = new ThreadLocal<SimpleDateFormat>() {
      @Override
      protected SimpleDateFormat initialValue() {
        SimpleDateFormat df = new SimpleDateFormat("YY-MMM");
        DateService service = (DateService) XLocator.get().get("dateService");
        df.setTimeZone(TimeZone.getTimeZone(service.getTimeZoneId(XLocator.get(), TIME_ZONE)));
        return df;
      }
    };

    public <K, V extends Comparable<? super V>> Map<K, V> descByValue(Map<K, V> map, int limit) {
      List<Map.Entry<K, V>> list = new ArrayList<>(map.entrySet());
      list.sort(Collections.reverseOrder(Map.Entry.comparingByValue()));

      Map<K, V> result = new LinkedHashMap<>();
      int count = 0;
      for (Map.Entry<K, V> entry : list) {
        if ( limit > 0 && count >= limit ) break;
        result.put(entry.getKey(), entry.getValue());
        count++;
      }
      return result;
    }

    public <K, V extends Comparable<? super V>> Map<K, V> ascByValue(Map<K, V> map, int limit) {
      List<Map.Entry<K, V>> list = new ArrayList<>(map.entrySet());
      list.sort(Map.Entry.comparingByValue());

      Map<K, V> result = new LinkedHashMap<>();
      int count = 0;
      for (Map.Entry<K, V> entry : list) {
        if ( limit > 0 && count >= limit ) break;
        result.put(entry.getKey(), entry.getValue());
        count++;
      }
      return result;
    }
  `
})
