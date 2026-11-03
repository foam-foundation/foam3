/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.export',
  name: 'JSONLDriver',
  implements: [ 'foam.core.export.ExportDriver' ],

  documentation: `Exports a DAO as JSON Lines format (one compact JSON object per
    line, no wrapping array). Suitable for ML training pipelines such as MLX and
    Hugging Face datasets that expect .jsonl input.

    Respects X.filteredTableColumns — exports only the visible columns by default.
    When the user checks "Include all columns in export" in the Export modal,
    ExportModal sets filteredTableColumns to null and all properties are exported.`,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.json.Outputter',
      name: 'outputter',
      factory: function() { return foam.json.Strict; },
      hidden: true
    }
  ],

  methods: [
    function serialize_(obj, columns) {
      if ( ! columns || ! columns.length ) return this.outputter.stringify(obj);
      var out = {};
      columns.forEach(function(col) {
        var key = typeof col === 'string' ? col : (col.name || col);
        out[key] = obj[key];
      });
      return JSON.stringify(out);
    },

    function exportFObject(X, obj) {
      return this.serialize_(obj, X.filteredTableColumns);
    },

    function exportDAO(X, dao) {
      var self = this;
      var cols = X.filteredTableColumns;
      return dao.select().then(function(sink) {
        return sink.array.map(function(obj) {
          return self.serialize_(obj, cols);
        }).join('\n');
      });
    }
  ]
});
