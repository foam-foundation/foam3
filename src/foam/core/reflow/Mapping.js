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

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Mapping',

  requires: [
    'foam.core.reflow.MappingType'
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
      name: 'fileHeaders',
      hidden: true,
      transient: true,
      factory: function() { return []; }
    }
  ],

  methods: [
    function process(obj, value, rowData) {
      if ( ! this.property ) return;
      
      switch ( this.type ) {
        case this.MappingType.CONSTANT:
          value = this.constantValue;
          break;
        case this.MappingType.FIELD:
          if ( rowData && this.fieldName ) {
            value = rowData[this.fieldName] !== undefined ? rowData[this.fieldName] : value;
          }
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
      
      if ( foam.String.isInstance(value) && value != null && value !== undefined ) {
        value = value.trim();
      }
      
      if ( value !== '' && value != null && value !== undefined ) {
        var handler = this.of && this.of.getAxiomByName(this.property);
        obj[this.property] = handler.fromCSV(value);
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