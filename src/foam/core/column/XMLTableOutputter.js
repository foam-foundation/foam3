/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.column',
  name: 'XMLTableOutputter',
  extends: 'foam.core.column.TableColumnOutputter',

  documentation: `Outputter to output a table of values as XML. Keeps the
    <objects>/<object> envelope and the property-name tags of the raw
    XMLDriver, so an existing consumer's XPath still resolves; only the set of
    columns and the formatting of the values differ.`,

  methods: [
    {
      name: 'getColumnHeaders',
      documentation: `Tag names, not the labels the CSV header row carries: a
        property name is a valid XML name and is what the raw XMLDriver emits,
        while a label ('Case Status') is neither.`,
      code: function(x, of, arrOfPropNames) {
        return arrOfPropNames;
      }
    },

    function arrayToXML(arrayOfValues) {
      var tags   = arrayOfValues[0];
      var output = [ '<objects>' ];

      for ( var i = 1 ; i < arrayOfValues.length ; i++ ) {
        var row = arrayOfValues[i];
        output.push('  <object>');
        for ( var j = 0 ; j < tags.length ; j++ ) {
          output.push('    <' + tags[j] + '>' +
            ( foam.xml.Compact.escape(row[j]) || '' ) +
            '</' + tags[j] + '>');
        }
        output.push('  </object>');
      }

      output.push('</objects>');
      return output.join('\n');
    }
  ]
});
