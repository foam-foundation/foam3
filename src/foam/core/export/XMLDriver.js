/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.export',
  name: 'XMLDriver',
  implements: [ 'foam.core.export.ExportDriver' ],

  documentation: 'Class for exporting data from a DAO to XML',

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.xml.Outputter',
      name: 'outputter',
      factory: function() {
        // Exports are read by people: output dates as ISO strings rather
        // than the epoch milliseconds the shared Compact outputter emits.
        return foam.xml.Outputter.create({
          pretty: false,
          formatDatesAsNumbers: false,
          outputDefaultValues: false,
          outputDefinedValues: false
        });
      },
      hidden: true
    }
  ],

  methods: [
    function exportFObject(X, obj) {
      return this.outputter.stringify(obj);
    },
    function exportDAO(X, dao) {
      var self = this;
      return dao.select().then(function (sink) {
        return self.outputter.stringify(sink.array);
      });
    }
  ]
});
