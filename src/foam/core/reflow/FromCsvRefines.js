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
        return this.fromString(str?.replace(/,/g, ''));
      }
    }
  ]
});

