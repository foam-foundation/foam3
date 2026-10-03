/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ascript',
  name: 'AScriptLibJavaTest',
  extends: 'foam.core.test.Test',

  documentation: `The server half of the AScript library. AScriptPropertyFilterTest
    runs the JavaScript Lib in a browser and never reaches Lib.java, so LOOKUP,
    TEXT, DATE and the date parts are checked here against the Java code.`,

  javaImports: [
    'foam.core.test.Test',
    'java.util.ArrayList',
    'java.util.Date',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map',
    'java.util.TimeZone'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // Date parts and TEXT read UTC whatever the JVM zone is.
        TimeZone saved = TimeZone.getDefault();
        try {
          TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
          dateTests();
          TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"));
          dateTests();
        } finally {
          TimeZone.setDefault(saved);
        }
        textTests();
        lookupTests();
      `
    },
    {
      name: 'dateTests',
      javaCode: `
        Date late = new Date(java.time.Instant.parse("2025-03-29T23:30:45Z").toEpochMilli());
        expect(Lib.YEAR(late),   2025, "YEAR reads UTC");
        expect(Lib.MONTH(late),  3,    "MONTH reads UTC");
        expect(Lib.DAY(late),    29,   "DAY reads UTC");
        expect(Lib.HOUR(late),   23,   "HOUR reads UTC");
        expect(Lib.MINUTE(late), 30,   "MINUTE reads UTC");
        expect(Lib.SECOND(late), 45,   "SECOND reads UTC");
        expect(Lib.WEEKDAY(late, null), 6, "WEEKDAY reads UTC (Saturday)");
        expect(Lib.TEXT(late, "YYMMDD"), "250329", "TEXT reads UTC late in the day");

        Date d = Lib.DATE(2025, 3, 29);
        expect(d.getTime(), java.time.Instant.parse("2025-03-29T12:00:00Z").toEpochMilli(), "DATE is noon UTC");
        expect(Lib.HOUR(d), 12, "HOUR of DATE is 12 in every zone");
      `
    },
    {
      name: 'textTests',
      javaCode: `
        Date d = Lib.DATE(2025, 3, 29);
        expect(Lib.TEXT(d, "YYYY-MM-DD"), "2025-03-29", "TEXT formats YYYY-MM-DD");
        expect(Lib.TEXT(d, "DD/MM/YYYY DD"), "29/03/2025 29", "TEXT replaces every occurrence of a token");
        expect(Lib.TEXT(7, ""), "7", "TEXT of a number with an empty format is its text");
        expect(Lib.TEXT(7, null), "7", "TEXT of a number with no format is its text");
        expect(Lib.TEXT(null, "YYMMDD"), "", "TEXT of null is empty");
      `
    },
    {
      name: 'lookupTests',
      javaCode: `
        Map<String, Object> five = new HashMap<>();
        five.put("qty", 5);
        five.put("label", "Five");
        Map<String, Object> six = new HashMap<>();
        six.put("qty", 6);
        six.put("label", "Six");
        List<Object> items = new ArrayList<>();
        items.add(five);
        items.add(six);

        expect(Lib.LOOKUP(items, "qty", 5L, "label"), "Five", "LOOKUP matches an Integer field against a Long literal");
        expect(Lib.LOOKUP(items.toArray(), "qty", 6, "label"), "Six", "LOOKUP reads an Object[]");
        expect(Lib.LOOKUP(items, "qty", 7L, "label"), null, "LOOKUP is null when nothing matches");
        expect(Lib.LOOKUP(null, "qty", 5L, "label"), null, "LOOKUP is null for a null array");

        Test t = new Test();
        t.setId("found");
        t.setFailed(3L);
        List<Object> objs = new ArrayList<>();
        objs.add(t);
        expect(Lib.LOOKUP(objs, "failed", 3, "id"), "found", "LOOKUP reads FObject properties and matches across number types");
        expect(Lib.LOOKUP(objs, "nosuch", 3, "id"), null, "LOOKUP is null for an unknown key property");
      `
    }
  ]
});
