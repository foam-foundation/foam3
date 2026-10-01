/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.column',
  name: 'CSVTableOutputter',
  extends: 'foam.core.column.TableColumnOutputter',

  documentation: 'Outputter to output array of values to CSV',

  constants: [
    {
      name: 'BOM',
      // UTF-8 byte order mark. Excel ignores the download's charset and reads
      // a CSV as Windows-1252 unless the file starts with one, turning 'É'
      // into 'Ã‰' and '—' into 'â€”'.
      value: '\uFEFF'
    }
  ],

  methods: [
    function arrayToCSV(arrayOfValues) {
      var output = [];
      for ( var row of arrayOfValues ) {
        row = row.map(v =>  {
          return v ? '"' + (v.replaceAll && v.replaceAll('"', '""') || v) +  '"' : '';
        });
        output.push(row.join(','));
      }
      return this.BOM + output.join('\n');
    }
  ]
});
