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

      // Build two lookup maps:
      // 1. Exact match map (case-insensitive) - for aliases and exact property names
      // 2. Normalized match map - for fuzzy matching
      var exactMap      = {};
      var normalizedMap = {};

      ps.forEach(function(p) {
        var normalizedKey;

        // Exact match: property name as-is (case-insensitive)
        exactMap[p.name.toLowerCase()] = p;

        // Normalized match - don't overwrite existing (first match wins)
        normalizedKey = self.normalizeToPropertyName(p.name).toLowerCase();
        if ( ! normalizedMap[normalizedKey] ) {
          normalizedMap[normalizedKey] = p;
        }

        if ( p.shortName ) {
          exactMap[p.shortName.toLowerCase()] = p;
          normalizedKey = self.normalizeToPropertyName(p.shortName).toLowerCase();
          if ( ! normalizedMap[normalizedKey] ) {
            normalizedMap[normalizedKey] = p;
          }
        }

        // Aliases get exact match priority
        p.aliases.forEach(function(a) {
          exactMap[a.toLowerCase()] = p;
          normalizedKey = self.normalizeToPropertyName(a).toLowerCase();
          if ( ! normalizedMap[normalizedKey] ) {
            normalizedMap[normalizedKey] = p;
          }
        });
      });

      // Single parser: try exact match first, then normalized match
      var fieldNameParser = action(
        seq1(0, str(plus(notChars(',\t\n\r'))), sym('end')),
        function(input) {
          input = input.trim();
          if ( ! input ) return foam.parse.ParserWithAction.NO_PARSE;

          // Try exact match first (case-insensitive)
          var prop = exactMap[input.toLowerCase()];
          if ( prop ) return prop;

          // Fall back to normalized match
          var normalized = self.normalizeToPropertyName(input);
          prop = normalizedMap[normalized.toLowerCase()];
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
