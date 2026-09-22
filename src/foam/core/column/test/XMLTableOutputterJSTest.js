/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.column.test',
  name: 'XMLTableOutputterJSTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.export.XMLTableExportDriver'
  ],

  documentation: `The table-driven XML export emits one element per selected
    column, named after the property so an existing consumer's XPath still
    resolves, with XML-escaped values and ISO 8601 24h dates.`,

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var driver    = this.XMLTableExportDriver.create({}, x);
        var outputter = driver.outputter;

        x.test(outputter.getColumnHeaders(x, null, [ 'status', 'program.name' ])
                 .join(',') === 'status,program.name',
          'column headers are property names, not labels');

        var xml = outputter.arrayToXML([
          [ 'status', 'note' ],
          [ 'Open',   'a & b < c' ],
          [ 'Closed', '' ]
        ]);
        x.test(xml ===
          '<objects>\n' +
          '  <object>\n' +
          '    <status>Open</status>\n' +
          '    <note>a &amp; b &lt; c</note>\n' +
          '  </object>\n' +
          '  <object>\n' +
          '    <status>Closed</status>\n' +
          '    <note></note>\n' +
          '  </object>\n' +
          '</objects>',
          'one element per column, values escaped, empty cells kept: ' + JSON.stringify(xml));

        // Local-time date, as the outputter formats in the exporting browser's timezone
        var d = new Date(2026, 8, 2, 0, 59, 5);
        x.test(outputter.dateTimeToString(d) === '2026-09-02 00:59:05',
          'date format is ISO 8601 date with 24h time: ' + outputter.dateTimeToString(d));

        var pm = new Date(2026, 7, 27, 22, 4, 42);
        x.test(outputter.dateTimeToString(pm) === '2026-08-27 22:04:42',
          'afternoon times are 24h, not AM/PM: ' + outputter.dateTimeToString(pm));
      }
    }
  ]
});
