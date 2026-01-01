/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.reflow',
  name: 'MappingType',

  values: [
    {
      name: 'CONSTANT',
      label: 'Constant',
      documentation: 'Static value that is applied to all rows'
    },
    {
      name: 'FIELD',
      label: 'Field',
      documentation: 'Value comes from a field/column in the input data'
    },
    {
      name: 'DYNAMIC',
      label: 'Dynamic',
      documentation: 'Value computed from JavaScript expression'
    }
  ]
});


foam.ENUM({
  package: 'foam.core.reflow',
  name: 'DateFormat',

  values: [
    {
      name: 'STANDARD',
      label: 'Standard',
      documentation: 'Standard formats: yyyy-mm-dd, yyyy/mm/dd, yyyymmdd, mm/dd/yyyy, mm-dd-yyyy, mmddyyyy, mm/dd/yy, mm-dd-yy, mmddyy, plus ALL month name formats (unambiguous!): 31-JAN-2025, 31JAN2025, 2025-31-JAN, 202531JAN, Jan 02 2025'
    },
    {
      name: 'DDMMYYYY',
      label: 'dd/mm/yyyy',
      documentation: 'Day-Month-Year format for NUMERIC dates: dd/mm/yyyy, dd-mm-yyyy, ddmmyyyy, dd/mm/yy, dd-mm-yy, ddmmyy (month names work automatically in STANDARD)'
    },
    {
      name: 'YYYYDDMM',
      label: 'yyyy/dd/mm',
      documentation: 'Numeric only: yyyy-dd-mm, yyyyddmm, yy-dd-mm, yyddmm'
    }
  ],

  properties: [
    {
      // Add an 'id' property that returns the ordinal for DAO compatibility
      name: 'id',
      getter: function() { return this.ordinal; }
    }
  ],

  methods: [
    function toSummary() {
      return this.label;
    }
  ]
});



foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Mapping',

  requires: [
    'foam.core.reflow.MappingType',
    'foam.core.reflow.DateFormat'
  ],

  imports: [ 'scope?' ],

  properties: [
    {
      class: 'String',
      name: 'id',
      documentation: 'The source field/column name'
    },
    {
      class: 'String',
      name: 'property',
      documentation: 'The target property name'
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.MappingType',
      name: 'type',
      label: '',
      value: 'FIELD',
      documentation: 'The type of mapping: CONSTANT, FIELD, or DYNAMIC'
    },
    {
      class: 'String',
      name: 'constantValue',
      label: '',
      documentation: 'Static value applied to all rows',
      visibility: function(type) {
        return foam.u2.DisplayMode[type === foam.core.reflow.MappingType.CONSTANT ? 'RW' : 'HIDDEN'];
      }
    },
    {
      class: 'String',
      name: 'fieldName',
      label: '',
      documentation: 'Name of the field/column in input data',
      view: function(_, X) {
        return {
          class: 'foam.u2.view.ChoiceView',
          placeholder: 'Select field',
          choices: X.data.fileHeaders ? X.data.fileHeaders.map(h => [h, h]) : []
        };
      },
      visibility: function(type) {
        return foam.u2.DisplayMode[type === foam.core.reflow.MappingType.FIELD ? 'RW' : 'HIDDEN'];
      }
    },
    {
      class: 'String',
      name: 'dynamicExpression',
      label: '',
      documentation: 'JavaScript expression for dynamic computation',
      help: 'JavaScript expression that can access row data fields directly. Examples: firstName + " " + lastName, age > 18 ? "Adult" : "Minor", email.toLowerCase()',
      view: { class: 'foam.u2.tag.TextArea', rows: 2, cols: 40 },
      visibility: function(type) {
        return foam.u2.DisplayMode[type === foam.core.reflow.MappingType.DYNAMIC ? 'RW' : 'HIDDEN'];
      }
    },
    {
      name: 'of',
      hidden: true
    },
    {
      name: 'prop',
      hidden: true,
      transient: true,
      expression: function(of, property) { return of.getAxiomByName(property); }
    },
    {
      name: 'fileHeaders',
      hidden: true,
      transient: true,
      factory: function() { return []; }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.DateFormat',
      name: 'dateFormat',
      label: '',
      value: 'STANDARD',
      help: 'Standard format supports most common date formats (yyyy-mm-dd, mm/dd/yyyy, etc.). If your dates don\'t parse correctly, select a different format option.',
      documentation: 'Date format for this field (only applies to Date/DateTime properties)',
      view: {
        class: 'foam.core.reflow.DateFormatRichChoiceView'
      },
      visibility: function(type, prop) {
        // Only show for Date/DateTime properties that use FIELD or CONSTANT mapping
        if ( type === foam.core.reflow.MappingType.DYNAMIC ) return foam.u2.DisplayMode.HIDDEN;
        if ( ! prop ) return foam.u2.DisplayMode.HIDDEN;
        var isDateProp = foam.lang.Date.isInstance(prop) || foam.lang.DateTime.isInstance(prop);
        return isDateProp ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    }
  ],

  methods: [
    function formatToParserName() {
      /**
       * Maps DateFormat enum to DateParser grammar symbol name.
       * This is used when calling DateUtil parsing methods with format hints.
       *
       * @returns {string} Parser grammar symbol name ('START', 'ddmmyyyy', 'yyyyddmm')
       */
      if ( ! this.dateFormat ) return 'START';

      // Map enum values to parser symbol names
      switch ( this.dateFormat.name ) {
        case 'DDMMYYYY':
          return 'ddmmyyyy';
        case 'YYYYDDMM':
          return 'yyyyddmm';
        case 'STANDARD':
        default:
          return 'START';
      }
    },

    function process(obj, value, rowData) {
      if ( ! this.property ) return;

      var fieldName = this.fieldName;

      switch ( this.type ) {
        case this.MappingType.FIELD:
          if ( rowData && fieldName ) {
            value = rowData[fieldName] !== undefined ? rowData[fieldName] : value;
          }
          break;
        case this.MappingType.CONSTANT:
          value = this.constantValue;
          break;
        case this.MappingType.DYNAMIC:
          if ( this.dynamicExpression && rowData ) {
            try {
              value = this.evaluateExpression(this.dynamicExpression, rowData);
            } catch (x) {
              console.warn('Dynamic expression evaluation failed:', x);
              value = '';
            }
          } else {
            value = this.dynamicExpression || '';
          }
          break;
      }

      if ( foam.String.isInstance(value) ) {
        value = value.trim();
      }

      // Set property value using fromCSV, passing format hint for date fields
      if ( value !== '' && value != null && value !== undefined ) {
        // Check DateTimeUTC BEFORE DateTime since DateTimeUTC extends DateTime
        if ( this.prop && foam.lang.Date.isInstance(this.prop) ) {
          // For date/datetime properties, pass format to fromCSV
          var formatName = this.formatToParserName();
          this.prop.set(obj, this.prop.fromCSV(value, formatName));
        } else {
          this.prop.set(obj, this.prop.fromCSV(value));
        }
      }
    },
    function evaluateExpression(expression, rowData) {
      /**
       * Safely evaluate a JavaScript expression within the context of rowData.
       * Uses the same scoping pattern as ReactiveDetailView.js (lines 56-58).
       *
       * @param {string} expression - The JavaScript expression to evaluate
       * @param {Object} rowData - The row data object containing field values
       * @returns {*} The result of the expression evaluation
       */
      if ( ! expression || ! rowData ) return '';

      // Validate expression before evaluation
      this.validateExpression(expression);

      // Use the same pattern as ReactiveDetailView.js: with scope + eval
      var result;
      try {
        with ( foam.core.reflow.lib ) {
          with ( rowData ) {
            result = eval(expression);
          }
        }
      } catch (x) {
        console.error('Expression evaluation error:', {
          expression: expression,
          rowData: rowData,
          error: x.message
        });
        throw x;
      }

      return result;
    },

    function validateExpression(expression) {
      /**
       * Validate a JavaScript expression for basic safety.
       * This provides basic checks to catch common errors early.
       *
       * @param {string} expression - The expression to validate
       * @throws {Error} If the expression appears unsafe or malformed
       */
      if ( ! expression || typeof expression !== 'string' ) {
        throw new Error('Expression must be a non-empty string');
      }

      // Check for potentially dangerous patterns
      var dangerousPatterns = [
        /\b(eval|Function|setTimeout|setInterval)\b/,
        /\b(document|window|global|process)\b/,
        /\b(require|import|export)\b/,
        /\b(__proto__|prototype)\b/,
        /\b(constructor)\b/
      ];

      dangerousPatterns.forEach(pattern => {
        if ( pattern.test(expression) ) {
          throw new Error('Expression contains potentially unsafe patterns');
        }
      });

      // Basic syntax check - try to parse as function body
      try {
        new Function('', 'return ' + expression);
      } catch (x) {
        throw new Error('Expression has invalid syntax: ' + x.message);
      }
    }
  ]
});
