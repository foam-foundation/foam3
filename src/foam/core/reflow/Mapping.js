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

  properties: [
    {
      class: 'String',
      name: 'parserSymbol',
      documentation: 'The DateParser grammar symbol name for this format'
    },
    {
      class: 'String',
      name: 'help'
    },
    {
      // Add an 'id' property that returns the ordinal for DAO compatibility
      name: 'id',
      getter: function() { return this.ordinal; }
    }
  ],

  values: [
    {
      name: 'STANDARD',
      label: 'Standard',
      parserSymbol: 'START',
      help: 'yyyy-mm-dd, mm/dd/yyyy, 31-JAN-2025, Jan 02 2025'
    },
    {
      name: 'DDMMYYYY',
      label: 'dd/mm/yyyy',
      parserSymbol: 'ddmmyyyy',
      help: 'dd/mm/yyyy, dd-mm-yyyy, ddmmyyyy, dd/mm/yy, dd-mm-yy, ddmmyy'
    },
    {
      name: 'YYYYDDMM',
      label: 'yyyy/dd/mm',
      parserSymbol: 'yyyyddmm',
      help: 'yyyy-dd-mm, yyyyddmm'
    },
    {
      name: 'JULIANDATE',
      label: 'Julian Date',
      parserSymbol: 'juliandate',
      help: 'YYDDD or YDDD (e.g. 25216 = Aug 4, 2025)'
    },
    {
      name: 'YYMMDD',
      label: 'yy/mm/dd',
      parserSymbol: 'yymmdd',
      help: 'yymmdd, yy-mm-dd (e.g. 250325 = Mar 25, 2025)'
    }
  ],

  methods: [
    function toSummary() {
      return this.label;
    }
  ]
});


foam.ENUM({
  package: 'foam.core.reflow',
  name: 'NumberFormat',

  properties: [
    {
      class: 'String',
      name: 'parserSymbol',
      documentation: 'The number parser grammar symbol name for this format'
    },
    {
      class: 'String',
      name: 'help'
    },
    {
      name: 'id',
      getter: function() { return this.ordinal; }
    }
  ],

  values: [
    {
      name: 'US_UK',
      label: 'US/UK (1,000.00)',
      parserSymbol: 'START',
      help: '1,234.56'
    },
    {
      name: 'EUROPEAN',
      label: 'European (1.000,00)',
      parserSymbol: 'european',
      help: '1.234,56'
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
    'foam.core.reflow.DateFormat',
    'foam.parse.SimpleJavaScriptParser',
    'foam.parse.auto.SmartView',
    'foam.core.reflow.NumberFormat'
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
      onKey: true,
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
      documentation: 'FScript expression for dynamic computation - supports field access, operators, and functions',
      help: 'FScript expression examples: firstName + " " + lastName, age > 18, email.toLowerCase(), YEARS(birthDate) > 21',
      onKey: true,
      view: function(_, X) {
        // Use the parser from the instance property
        if ( ! X.data.expressionParser_ ) {
          // Fallback to regular TextField if no parser available (no headers)
          return { class: 'foam.u2.TextField' };
        }

        return {
          class: 'foam.parse.auto.SmartView',
          parser: X.data.expressionParser_
        };
      },
      visibility: function(type) {
        return foam.u2.DisplayMode[type === foam.core.reflow.MappingType.DYNAMIC ? 'RW' : 'HIDDEN'];
      }
    },
    {
      name: 'of',
      hidden: true
    },
    {
      name: 'expressionParser_',
      hidden: true,
      transient: true,
      expression: function(fileHeaders) {
        if ( ! fileHeaders || fileHeaders.length === 0 ) return null;

        var headerMap   = {};
        var constantMap = {};
        var props       = [];

        for ( var i = 0 ; i < fileHeaders.length ; i++ ) {
          var original   = fileHeaders[i];
          var normalized = this.normalizeHeader(original);
          normalized     = this.resolveConstantCollision(normalized, constantMap);

          headerMap[normalized] = original;
          props.push({ class: 'String', name: normalized, label: original });
        }

        var propKey   = props.map(p => p.name).sort().join('_');
        var modelName = 'DynamicExpressionModel_' + Math.abs(foam.String.hashCode(propKey));
        var fullName  = 'foam.core.reflow.temp.' + modelName;
        var TempModel = foam.maybeLookup(fullName);

        if ( ! TempModel ) {
          foam.CLASS({
            package: 'foam.core.reflow.temp',
            name: modelName,
            properties: props
          });
          TempModel = foam.lookup(fullName);
        }

        return this.SimpleJavaScriptParser.create({
          of: TempModel,
          headerMap: headerMap
        });
      }
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
    },
    {
      name: 'sampleData',
      hidden: true,
      transient: true,
      factory: function() { return {}; },
      documentation: 'First row of data for computing sample values'
    },
    {
      class: 'String',
      name: 'sampleValue',
      label: 'Sample',
      documentation: 'Sample value computed based on mapping type and configuration',
      visibility: 'RO',
      expression: function(type, constantValue, fieldName, dynamicExpression, sampleData) {
        // Return sample based on mapping type
        switch ( type ) {
          case foam.core.reflow.MappingType.CONSTANT:
            // For CONSTANT: show the constant value
            return constantValue || '';

          case foam.core.reflow.MappingType.FIELD:
            // For FIELD: show value from sampleData
            if ( fieldName && sampleData && sampleData[fieldName] !== undefined ) {
              return sampleData[fieldName];
            }
            return '';

          case foam.core.reflow.MappingType.DYNAMIC:
            // For DYNAMIC: evaluate expression with sampleData
            if ( dynamicExpression && sampleData && Object.keys(sampleData).length > 0 ) {
              try {
                return this.evaluateExpression(dynamicExpression, sampleData);
              } catch (x) {
                return '⚠ Error: ' + x.message;
              }
            }
            return '';

          default:
            return '';
        }
      }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.NumberFormat',
      name: 'numberFormat',
      label: '',
      value: 'US_UK',
      help: 'US/UK Style uses period for decimal (1,000.00). European uses comma for decimal (1.000,00).',
      documentation: 'Number format for this field (only applies to numeric properties)',
      view: {
        class: 'foam.core.reflow.NumberFormatRichChoiceView'
      },
      visibility: function(type, prop) {
        // Only show for numeric properties that use FIELD or CONSTANT mapping
        if ( type === foam.core.reflow.MappingType.DYNAMIC ) return foam.u2.DisplayMode.HIDDEN;
        if ( ! prop ) return foam.u2.DisplayMode.HIDDEN;
        var isNumericProp = foam.lang.Int.isInstance(prop) ||
                            foam.lang.Long.isInstance(prop) ||
                            foam.lang.Float.isInstance(prop) ||
                            foam.lang.Double.isInstance(prop);
        return isNumericProp ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    }
  ],

  methods: [
    function normalizeHeader(header) {
      /** Normalize a header string to a valid property name. */
      return header.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]+/, '');
    },

    function resolveConstantCollision(normalized, constantMap) {
      /**
       * Resolve FOAM constant name collisions by appending a numeric suffix.
       * Returns the resolved property name.
       */
      var constantName = foam.String.constantize(normalized);

      if ( ! constantMap[constantName] || constantMap[constantName] === normalized ) {
        constantMap[constantName] = normalized;
        return normalized;
      }

      // Collision detected - append suffix to make unique
      var suffix = 2;
      var newNormalized = normalized + '_' + suffix;
      while ( constantMap[foam.String.constantize(newNormalized)] ) {
        suffix++;
        newNormalized = normalized + '_' + suffix;
      }
      constantMap[foam.String.constantize(newNormalized)] = newNormalized;
      return newNormalized;
    },

    function formatToParserName() {
      /**
       * Maps DateFormat enum to DateParser grammar symbol name.
       * This is used when calling DateUtil parsing methods with format hints.
       *
       * @returns {string} Parser grammar symbol name ('START', 'ddmmyyyy', 'yyyyddmm', 'juliandate', 'yymmdd')
       */
      if ( ! this.dateFormat ) return 'START';
      return this.dateFormat.parserSymbol || 'START';
    },

    function process(obj, value, rowData) {
      /**
       * Process a mapping and set the value on the target object.
       *
       * Returns an object with info about what happened:
       * - sourceWasEmpty: true if the source value was empty/null/undefined
       * - valueWasSet: true if a value was actually set on the object
       * - property: the property name
       *
       * This info is used by UploadSink to track empty source fields for
       * accurate required field validation.
       */
      if ( ! this.property ) return { sourceWasEmpty: false, valueWasSet: false, property: null };

      var fieldName = this.fieldName;
      var sourceWasEmpty = false;

      switch ( this.type ) {
        case this.MappingType.FIELD:
          if ( rowData && fieldName ) {
            var sourceValue = rowData[fieldName];
            // Track if source was empty BEFORE any transformation
            sourceWasEmpty = this.isEmptyValue(sourceValue);
            value = sourceValue !== undefined ? sourceValue : value;
          } else {
            sourceWasEmpty = true;
          }
          break;
        case this.MappingType.CONSTANT:
          value = this.constantValue;
          // Check if constant value is empty (user left the field blank)
          sourceWasEmpty = this.isEmptyValue(value);
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
          // Check if dynamic result is empty
          sourceWasEmpty = this.isEmptyValue(value);
          break;
      }

      if ( foam.String.isInstance(value) ) {
        value = value.trim();
      }

      var valueWasSet = false;

      // Set property value using fromCSV, passing format hint for date/number fields
      if ( value !== '' && value != null && value !== undefined ) {
        if ( this.prop ) {
          if ( foam.lang.Date.isInstance(this.prop) || foam.lang.DateTime.isInstance(this.prop) ) {
            // For date/datetime properties, pass format to fromCSV
            var dateFormatName = this.formatToParserName();
            this.prop.set(obj, this.prop.fromCSV(value, dateFormatName));
            return;
          } else if ( foam.lang.Int.isInstance(this.prop) ||
                      foam.lang.Long.isInstance(this.prop) ||
                      foam.lang.Float.isInstance(this.prop) ||
                      foam.lang.Double.isInstance(this.prop) ) {
            // For numeric properties, pass format to fromCSV
            var numberFormatName = this.numberFormatToParserName();
            this.prop.set(obj, this.prop.fromCSV(value, numberFormatName));
            return;
          }
        }
        this.prop.set(obj, this.prop.fromCSV(value));
        valueWasSet = true;
      }
      return {
        sourceWasEmpty: sourceWasEmpty,
        valueWasSet: valueWasSet,
        property: this.property
      };
    },
    function isEmptyValue(value) {
      /**
       * Check if a source value should be considered "empty" for required field validation.
       *
       * Empty means: null, undefined, or empty string (after trim).
       * NOT empty: 0, false, "0", " 0 " (has content after trim).
       *
       * This distinction is important for required field validation:
       * - Empty source → field has no user-provided data → fail required validation
       * - Non-empty source (even "0") → user provided data → pass required validation
       */
      if ( value === null || value === undefined ) return true;
      if ( foam.String.isInstance(value) && value.trim() === '' ) return true;
      return false;
    },
    function numberFormatToParserName() {
      /**
       * Maps NumberFormat enum to NumberParser grammar symbol name.
       * This is used when calling fromCSV with format hints.
       *
       * @returns {string} Parser grammar symbol name ('START' or 'european')
       */
      if ( ! this.numberFormat ) return 'START';
      return this.numberFormat.parserSymbol || 'START';
    },

    function evaluateExpression(expression, rowData) {
      /**
       * Safely evaluate a simple JavaScript expression with field access.
       * Uses a with statement to provide field access while keeping it simple.
       *
       * @param {string} expression - The JavaScript expression to evaluate
       * @param {Object} rowData - The row data object containing field values
       * @returns {*} The result of the expression evaluation
       */
      if ( ! expression || ! rowData ) return '';

      try {
        // Normalize rowData keys to valid JavaScript identifiers
        var normalizedData = {};
        for ( var key in rowData ) {
          var normalizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]+/, '');
          normalizedData[normalizedKey] = rowData[key];
        }

        // Simple evaluation with normalized rowData in scope
        // This allows expressions like: Account_Type + " " + Status
        var result;
        with ( normalizedData ) {
          result = eval(expression);
        }
        return result;

      } catch (x) {
        console.error('Expression evaluation error:', {
          expression: expression,
          rowData: rowData,
          normalizedData: normalizedData,
          error: x.message
        });
        throw x;
      }
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
