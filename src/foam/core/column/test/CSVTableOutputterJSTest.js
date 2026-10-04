/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.column.test',
  name: 'CSVTableOutputterJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `CSV export output must open correctly in Excel: the file
    starts with a UTF-8 BOM so accented and special characters are not read
    as Windows-1252, and the default date format is ISO 8601 with a 24h time
    so every Excel locale parses the column as a date and sorts it
    chronologically.`,

  requires: [
    'foam.core.export.CSVTableExportDriver'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var driver    = this.CSVTableExportDriver.create({}, x);
        var outputter = driver.outputter;
        var csv       = outputter.arrayToCSV([ [ 'Émetteur', 'a — b' ] ]);

        x.test(csv.charCodeAt(0) === 0xFEFF,
          'CSV output starts with the UTF-8 BOM');
        x.test(csv.slice(1) === '"Émetteur","a — b"',
          'BOM is the only prefix; rows are unchanged: ' + JSON.stringify(csv.slice(1)));

        // Local-time date, as the outputter formats in the exporting browser's timezone
        var d = new Date(2026, 8, 2, 0, 59, 5);
        x.test(outputter.dateTimeToString(d) === '2026-09-02 00:59:05',
          'default date format is ISO 8601 date with 24h time: ' + outputter.dateTimeToString(d));
        x.test(outputter.dateToString(d) === '2026-09-02',
          'default Date-only format is ISO 8601: ' + outputter.dateToString(d));

        var pm = new Date(2026, 7, 27, 22, 4, 42);
        x.test(outputter.dateTimeToString(pm) === '2026-08-27 22:04:42',
          'afternoon times are 24h, not AM/PM: ' + outputter.dateTimeToString(pm));

        var ddmm = driver.choices[1][0];
        x.test(ddmm[0](d) + ' ' + ddmm[1](d) === '02/09/2026 00:59:05',
          'DDMMYYYY choice is unchanged: ' + ddmm[0](d) + ' ' + ddmm[1](d));
      }
    }
  ]
});
