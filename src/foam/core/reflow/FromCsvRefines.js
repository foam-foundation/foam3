/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.csv',
  name: 'PropertyFromCSV',
  refines: 'foam.lang.Property',

  properties: [
    {
      class: 'Function',
      name: 'fromCSV',
      value: function(str) {
        return this.fromString(str);
      }
    }
  ]
});


foam.CLASS({
  name: 'IntFromCSVRefines',
  refines: 'foam.lang.Int',

  documentation: 'Parses integer values from CSV using NumberParser. Long, Byte, Short inherit this.',

  properties: [
    {
      class: 'Function',
      name: 'fromCSV',
      value: function(str, format) {
        /**
         * @param {string} str - The CSV string value to parse
         * @param {string} format - Parser format: undefined for standard (1,000.00), 'european' for (1.000,00)
         */

        // Not a string? Use default FOAM parsing
        if ( ! str || typeof str !== 'string' ) {
          return this.fromString(str);
        }

        // Try parsing with NumberParser (handles thousands separators and locale formats)
        var result = foam.parse.NumberParser.create().parseString(str, format);

        // NumberParser failed? Fall back to default FOAM parsing for backward compatibility
        if ( isNaN(result) ) {
          return this.fromString(str);
        }

        // Round to integer (Int, Long, Byte, Short are whole numbers)
        return Math.round(result);
      }
    }
  ]
});


foam.CLASS({
  name: 'FloatFromCSVRefines',
  refines: 'foam.lang.Float',

  documentation: 'Parses float values from CSV using NumberParser. Double inherits this.',

  properties: [
    {
      class: 'Function',
      name: 'fromCSV',
      value: function(str, format) {
        /**
         * @param {string} str - The CSV string value to parse
         * @param {string} format - Parser format: undefined for standard (1,000.00), 'european' for (1.000,00)
         */

        // Not a string? Use default FOAM parsing
        if ( ! str || typeof str !== 'string' ) {
          return this.fromString(str);
        }

        // Try parsing with NumberParser (handles thousands separators and locale formats)
        var result = foam.parse.NumberParser.create().parseString(str, format);

        // NumberParser failed? Fall back to default FOAM parsing for backward compatibility
        if ( isNaN(result) ) {
          return this.fromString(str);
        }

        // Return decimal value as-is (no rounding for Float/Double)
        return result;
      }
    }
  ]
});


foam.CLASS({
  name: 'DateFromCSVRefines',
  refines: 'foam.lang.Date',

  properties: [
    {
      class: 'Function',
      name: 'fromCSV',
      value: function(str, format) {
        // format is the parser symbol name: 'START', 'ddmmyyyy', or 'yyyyddmm'
        if ( ! str || str === '' ) return null;
        return foam.util.DateUtil.parseDateString(str, format);
      }
    }
  ]
});


foam.CLASS({
  name: 'DateTimeFromCSVRefines',
  refines: 'foam.lang.DateTime',

  properties: [
    {
      class: 'Function',
      name: 'fromCSV',
      value: function(str, format) {
        // format is the parser symbol name: 'START', 'ddmmyyyy', or 'yyyyddmm'
        if ( ! str || str === '' ) return null;
        return foam.util.DateUtil.parseDateTime(str, format);
      }
    }
  ]
});


foam.CLASS({
  name: 'DateTimeUTCFromCSVRefines',
  refines: 'foam.lang.DateTimeUTC',

  properties: [
    {
      class: 'Function',
      name: 'fromCSV',
      value: function(str, format) {
        // format is the parser symbol name: 'START', 'ddmmyyyy', or 'yyyyddmm'
        if ( ! str || str === '' ) return null;
        return foam.util.DateUtil.parseDateTimeUTC(str, format);
      }
    }
  ]
});
