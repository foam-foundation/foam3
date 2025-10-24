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

  properties: [
    {
      class: 'Function',
      name: 'fromCSV',
      value: function(str) {
        if (typeof str === 'string' && str.includes(',')) {
          str = str.replace(/,/g, '');
        }
        return this.fromString(str);
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
