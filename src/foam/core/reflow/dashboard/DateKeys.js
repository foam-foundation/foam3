/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Single source of truth for date-grouping expressions.
 *
 * Each entry ties one expr class to:
 *   calculate(periodCount) -> { minDate, maxDate }  (for the DAO filter)
 *   parse(key)             -> Date | null           (group key -> axis position)
 *   periodStart(date)      -> Date                  (snap to start of period)
 *   next(date)             -> Date                  (step to the next period)
 *
 * periodStart/next let the gap filler walk a range one period at a time
 * without knowing any key formats: it renders each key with the
 * expression itself. They work in UTC, because the exprs build their
 * keys from getUTC* — using local components here would shift a period
 * at the boundaries.
 *
 * An expr NOT listed here carries no recoverable date — DateToHHExpr,
 * DateToHHMMExpr and DateToHHMMSSExpr emit a time of day with no date,
 * so they must stay on the category axis.
 *
 * Entries that share behaviour (the two day granularities) call the
 * dailyCalculate/dayStart/nextDay methods below by full path rather
 * than referencing them directly: the entries are built while the LIB
 * is still being defined, so the methods don't exist yet at that point.
 */

foam.LIB({
  name: 'foam.core.reflow.dashboard.DateKeys',

  constants: {
    ENTRIES: [
      {
        exprClassNames: ['foam.mlang.expr.DateToWeekExpr'],
        calculate: function(periodCount) {
          var minDate = new Date();
          var maxDate = new Date();
          minDate.setDate(minDate.getDate() - ((periodCount - 1) * 7));
          var dayOfWeek = minDate.getDay();
          var daysToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
          minDate.setDate(minDate.getDate() - daysToMonday);
          minDate.setHours(0, 0, 0, 0);
          var currentDayOfWeek = maxDate.getDay();
          var daysToSunday = (currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek);
          maxDate.setDate(maxDate.getDate() + daysToSunday);
          maxDate.setHours(23, 59, 59, 999);
          return { minDate: minDate, maxDate: maxDate };
        },
        parse: function(key) {
          // 'YYYY-Www' -> Monday of that ISO week.
          // ISO week 1 is the week containing Jan 4th.
          var m = /^(\d{4})-W(\d{2})$/.exec(String(key));
          if ( ! m ) return null;
          var jan4 = new Date(+m[1], 0, 4);
          var dow  = jan4.getDay() || 7;            // Mon=1 ... Sun=7
          var d    = new Date(+m[1], 0, 4 - (dow - 1) + (+m[2] - 1) * 7);
          d.setHours(0, 0, 0, 0);
          return d;
        },
        periodStart: function(d) {
          var u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          var dow = u.getUTCDay() || 7;             // Mon=1 ... Sun=7
          u.setUTCDate(u.getUTCDate() - (dow - 1));
          return u;
        },
        next: function(d) {
          var u = new Date(d);
          u.setUTCDate(u.getUTCDate() + 7);
          return u;
        }
      },
      {
        exprClassNames: ['foam.mlang.expr.DateToQuarterExpr'],
        calculate: function(periodCount) {
          var minDate = new Date();
          var maxDate = new Date();
          minDate.setMonth(minDate.getMonth() - ((periodCount - 1) * 3));
          var quarter = Math.floor(minDate.getMonth() / 3);
          minDate.setMonth(quarter * 3, 1);
          minDate.setHours(0, 0, 0, 0);
          var currentQuarter = Math.floor(maxDate.getMonth() / 3);
          maxDate.setMonth((currentQuarter + 1) * 3, 0);
          maxDate.setHours(23, 59, 59, 999);
          return { minDate: minDate, maxDate: maxDate };
        },
        parse: function(key) {
          var m = /^(\d{4})-Q([1-4])$/.exec(String(key));
          return m ? new Date(+m[1], (+m[2] - 1) * 3, 1) : null;
        },
        periodStart: function(d) {
          return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));
        },
        next: function(d) {
          var u = new Date(d);
          u.setUTCMonth(u.getUTCMonth() + 3);
          return u;
        }
      },
      {
        exprClassNames: ['foam.mlang.expr.DateToYYYYMMExpr'],
        calculate: function(periodCount) {
          var minDate = new Date();
          var maxDate = new Date();
          minDate.setMonth(minDate.getMonth() - (periodCount - 1), 1);
          minDate.setHours(0, 0, 0, 0);
          maxDate.setMonth(maxDate.getMonth() + 1, 0);
          maxDate.setHours(23, 59, 59, 999);
          return { minDate: minDate, maxDate: maxDate };
        },
        parse: function(key) {
          var m = /^(\d{4})\/(\d{2})$/.exec(String(key));
          return m ? new Date(+m[1], +m[2] - 1, 1) : null;
        },
        periodStart: function(d) {
          return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        },
        next: function(d) {
          var u = new Date(d);
          u.setUTCMonth(u.getUTCMonth() + 1);
          return u;
        }
      },
      {
        exprClassNames: ['foam.mlang.expr.DateToYYYYExpr'],
        calculate: function(periodCount) {
          var minDate = new Date();
          var maxDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - (periodCount - 1), 0, 1);
          minDate.setHours(0, 0, 0, 0);
          maxDate.setFullYear(maxDate.getFullYear(), 11, 31);
          maxDate.setHours(23, 59, 59, 999);
          return { minDate: minDate, maxDate: maxDate };
        },
        parse: function(key) {
          var m = /^(\d{4})$/.exec(String(key));
          return m ? new Date(+m[1], 0, 1) : null;
        },
        periodStart: function(d) {
          return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        },
        next: function(d) {
          var u = new Date(d);
          u.setUTCFullYear(u.getUTCFullYear() + 1);
          return u;
        }
      },
      {
        exprClassNames: ['foam.mlang.expr.DateToYYYYMMDDExpr'],
        calculate: function(periodCount) {
          return foam.core.reflow.dashboard.DateKeys.dailyCalculate(periodCount);
        },
        parse: function(key) {
          var m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(key));
          return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
        },
        periodStart: function(d) {
          return foam.core.reflow.dashboard.DateKeys.dayStart(d);
        },
        next: function(d) {
          return foam.core.reflow.dashboard.DateKeys.nextDay(d);
        }
      },
      {
        exprClassNames: ['foam.mlang.expr.DateToDayOfYearExpr'],
        calculate: function(periodCount) {
          return foam.core.reflow.dashboard.DateKeys.dailyCalculate(periodCount);
        },
        parse: function(key) {
          // 'YYYY-DDD', DDD is 1-based (Jan 1 === 001).
          var m = /^(\d{4})-(\d{3})$/.exec(String(key));
          return m ? new Date(+m[1], 0, +m[2]) : null;
        },
        periodStart: function(d) {
          return foam.core.reflow.dashboard.DateKeys.dayStart(d);
        },
        next: function(d) {
          return foam.core.reflow.dashboard.DateKeys.nextDay(d);
        }
      }
    ]
  },

  methods: [
    // Shared by the two day-granularity entries.
    function dailyCalculate(periodCount) {
      var minDate = new Date();
      var maxDate = new Date();
      minDate.setDate(minDate.getDate() - (periodCount - 1));
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(23, 59, 59, 999);
      return { minDate: minDate, maxDate: maxDate };
    },

    function dayStart(d) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    },

    function nextDay(d) {
      var u = new Date(d);
      u.setUTCDate(u.getUTCDate() + 1);
      return u;
    },

    function entryFor(expr) {
      if ( ! expr ) return null;
      var es = this.ENTRIES;
      for ( var i = 0; i < es.length; i++ ) {
        for ( var j = 0; j < es[i].exprClassNames.length; j++ ) {
          var cls = foam.lookup(es[i].exprClassNames[j], true);
          if ( cls && cls.isInstance(expr) ) return es[i];
        }
      }
      return null;
    },

    function isTemporal(expr) {
      return !! this.entryFor(expr);
    },

    function parse(expr, key) {
      var e = this.entryFor(expr);
      return e ? e.parse(key) : null;
    },

    function calculatorFor(expr) {
      var e = this.entryFor(expr);
      return e ? e.calculate : null;
    }
  ]
});