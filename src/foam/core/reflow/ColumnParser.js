/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ColumnParser',
  extends: 'foam.parse.Grammar',

  documentation: "Call either .parseString() to parse an individual column or .parseString(columns, 'columnList') to parse a array of columns.",

  properties: [
    'of'
  ],

  methods: [
    /**
     * Normalize column name to FOAM property naming convention (camelCase).
     * Converts underscore/space-separated names to camelCase.
     * Examples:
     *   Element_attribute → elementAttribute
     *   Parent_Child_value → parentChildValue
     *   CONSTANT_CASE → constantCase
     *   FIRST NAME → firstName
     *   _leading → leading
     *   multi__under → multiUnder
     */
    function normalizeToPropertyName(str) {
      if ( ! str ) return str;

      // Replace spaces with underscores to unify separators
      str = str.replace(/\s+/g, '_');

      // If no underscore, just lowercase first char
      if ( str.indexOf('_') === -1 ) {
        return str.charAt(0).toLowerCase() + str.slice(1);
      }

      var parts = str.split('_');
      var result = '';
      var first = true;

      for ( var i = 0 ; i < parts.length ; i++ ) {
        if ( parts[i].length > 0 ) {
          if ( first ) {
            result = parts[i].charAt(0).toLowerCase() + parts[i].slice(1).toLowerCase();
            first = false;
          } else {
            result += parts[i].charAt(0).toUpperCase() + parts[i].slice(1).toLowerCase();
          }
        }
      }

      return result;
    },

    function grammar(alt, seq, seq0, seq1, eof, literal, literalIC, repeat, repeat0, sym, action, str, plus, notChars, peek) {
      var self = this;
      var ps = this.of.getAxiomsByClass(foam.lang.Property);

      // Build normalized lookup map: normalized identifier → property
      // Normalizes both property names and input for consistent matching
      var propertyMap = {};
      ps.forEach(function(p) {
        // Store by normalized name (handles non-standard property names)
        propertyMap[self.normalizeToPropertyName(p.name).toLowerCase()] = p;
        if ( p.shortName ) {
          propertyMap[self.normalizeToPropertyName(p.shortName).toLowerCase()] = p;
        }
        p.aliases.forEach(function(a) {
          propertyMap[self.normalizeToPropertyName(a).toLowerCase()] = p;
        });
      });

      // Single parser: normalize input and lookup in map
      var fieldNameParser = action(
        seq1(0, str(plus(notChars(',\t\n\r'))), sym('end')),
        function(input) {
          input = input.trim();
          if ( ! input ) return foam.parse.ParserWithAction.NO_PARSE;

          // Normalize input and lookup
          var normalized = self.normalizeToPropertyName(input);
          var prop = propertyMap[normalized.toLowerCase()];
          return prop || foam.parse.ParserWithAction.NO_PARSE;
        }
      );

      return {
        START: sym('fieldName'),

        end: peek(alt(',', eof())),

        fieldName: fieldNameParser,

        ws: repeat0(' '),

        comma: seq0(sym('ws'), ',', sym('ws')),

        columnList: seq1(1,
          sym('ws'),
          repeat(sym('fieldName'), sym('comma')),
          sym('ws'),
          eof())
      };
    }
  ]
});
