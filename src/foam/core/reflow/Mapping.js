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
      documentation: 'Standard formats: yyyy-mm-dd, yyyy/mm/dd, yyyymmdd, mm/dd/yyyy, mm-dd-yyyy, mmddyyyy'
    },
    {
      name: 'DDMMYYYY',
      label: 'dd/mm/yyyy',
      documentation: 'Day-Month-Year format (dd/mm/yyyy, dd-mm-yyyy, ddmmyyyy, dd/mm/yy, dd-mm-yy, ddmmyy)'
    },
    {
      name: 'YYYYDDMM',
      label: 'yyyy/dd/mm',
      documentation: 'Year-Day-Month format (yyyy/dd/mm, yyyy-dd-mm, yyyyddmm, yy/dd/mm, yy-dd-mm, yyddmm)'
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
        if ( this.prop && (foam.lang.Date.isInstance(this.prop) || foam.lang.DateTime.isInstance(this.prop)) ) {
          // For date/datetime properties, pass format to fromCSV
          var formatName = this.formatToParserName();
          this.prop.set(obj, this.prop.fromCSV(value, formatName));
        } else {
          this.prop.set(obj, this.prop.fromCSV(value));
        }
      }
    },

    function preprocessDateFormat(value) {
      /**
       * Preprocesses date strings to normalize them to yyyy-mm-dd format.
       *
       * Standard formats already supported by foam.lang.Date.adapt:
       *   - yyyy-mm-dd, yyyy/mm/dd, yyyymmdd (4-digit year first)
       *   - mm/dd/yyyy, mm-dd-yyyy, mmddyyyy (4-digit year last)
       *
       * When dateFormat is DDMMYYYY, converts day-first formats:
       *   - dd/mm/yyyy, dd-mm-yyyy, ddmmyyyy -> yyyy-mm-dd (4-digit year)
       *   - dd/mm/yy, dd-mm-yy, ddmmyy -> yyyy-mm-dd (2-digit year expanded)
       *
       * 2-digit years are expanded using a sliding window (current_year ± 80/19):
       *   - Example for 2025: 45-99 → 1945-1999, 00-44 → 2000-2044
       *   - Example for 2100: 20-99 → 2020-2099, 00-19 → 2100-2119
       */
      if ( ! value || typeof value !== 'string' ) return value;

      var dateStr = value.trim();
      if ( ! dateStr ) return value;

      // Only convert if explicitly set to DDMMYYYY format
      if ( this.dateFormat === this.DateFormat.DDMMYYYY ) {
        return this.convertDayFirstFormat(dateStr);
      }

      // Convert if explicitly set to YYYYDDMM format
      if ( this.dateFormat === this.DateFormat.YYYYDDMM ) {
        return this.convertYearDayMonthFormat(dateStr);
      }

      // Otherwise return as-is for standard format handling
      return value;
    },

    function convertDayFirstFormat(dateStr) {
      /**
       * Converts day-first date formats to yyyy-mm-dd format.
       *
       * Handles delimited formats:
       *   - dd/mm/yyyy or dd-mm-yyyy (with 4-digit year)
       *   - dd/mm/yy or dd-mm-yy (with 2-digit year)
       *
       * Handles compact formats:
       *   - ddmmyyyy (8 digits with 4-digit year)
       *   - ddmmyy (6 digits with 2-digit year)
       *
       * 2-digit years are expanded to 4-digit years using sliding window logic.
       *
       * @param {string} dateStr - Date string to convert
       * @returns {string} Normalized date in yyyy-mm-dd format, or original if cannot parse
       */
      if ( ! dateStr ) return dateStr;

      // Try delimited format with 4-digit year: dd/mm/yyyy or dd-mm-yyyy
      var match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if ( match ) {
        return this.formatDateParts(match[1], match[2], match[3]);
      }

      // Try delimited format with 2-digit year: dd/mm/yy or dd-mm-yy
      match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/);
      if ( match ) {
        var fullYear = this.expandTwoDigitYear(match[3]);
        return this.formatDateParts(match[1], match[2], fullYear);
      }

      // Try compact format with 4-digit year: ddmmyyyy (8 digits)
      match = dateStr.match(/^(\d{2})(\d{2})(\d{4})$/);
      if ( match ) {
        return this.formatDateParts(match[1], match[2], match[3]);
      }

      // Try compact format with 2-digit year: ddmmyy (6 digits)
      match = dateStr.match(/^(\d{2})(\d{2})(\d{2})$/);
      if ( match ) {
        var fullYear = this.expandTwoDigitYear(match[3]);
        return this.formatDateParts(match[1], match[2], fullYear);
      }

      // Couldn't parse, return as-is and let foam.lang.Date.adapt handle it
      return dateStr;
    },

    function expandTwoDigitYear(yy) {
      /**
       * Expands a 2-digit year to a 4-digit year using sliding window logic.
       *
       * Uses a sliding window centered on the current year to determine the century.
       * The window spans from (current_year - 80) to (current_year + 19).
       *
       * Example for year 2025:
       *   - Window: 1945-2044
       *   - Two-digit 45-99 → 1945-1999
       *   - Two-digit 00-44 → 2000-2044
       *
       * Example for year 2100:
       *   - Window: 2020-2119
       *   - Two-digit 20-99 → 2020-2099
       *   - Two-digit 00-19 → 2100-2119
       *
       * This approach automatically adjusts as time passes, making it more
       * robust than fixed pivot years for handling both historical and future dates.
       *
       * @param {string|number} yy - Two-digit year (00-99)
       * @returns {string} Four-digit year as a string
       */
      var year = typeof yy === 'string' ? parseInt(yy, 10) : yy;

      // Validate year is in valid range
      if ( isNaN(year) || year < 0 || year > 99 ) {
        console.warn('Invalid 2-digit year:', yy);
        return yy.toString();
      }

      // Get current year and calculate the sliding window
      var currentYear = new Date().getFullYear();
      var currentCentury = Math.floor(currentYear / 100) * 100;
      var currentTwoDigit = currentYear % 100;

      // Default window: 80 years back, 19 years forward from current year
      var windowStart = currentTwoDigit - 80;

      // Determine which century the 2-digit year belongs to
      var fullYear;
      if ( windowStart < 0 ) {
        // Window spans two centuries
        // Example: current year 2025 (windowStart = -55)
        // Years 45-99 → previous century (1945-1999)
        // Years 00-44 → current century (2000-2044)
        if ( year >= (100 + windowStart) ) {
          fullYear = (currentCentury - 100) + year;
        } else {
          fullYear = currentCentury + year;
        }
      } else {
        // Window within single century or forward
        // Example: current year 2100 (windowStart = 20)
        // Years 20-99 → current century (2120-2199)
        // Years 00-19 → next century (2100-2119)
        if ( year >= windowStart ) {
          fullYear = currentCentury + year;
        } else {
          fullYear = (currentCentury + 100) + year;
        }
      }

      return fullYear.toString();
    },

    function convertYearDayMonthFormat(dateStr) {
      /**
       * Converts year-day-month date formats to yyyy-mm-dd format.
       *
       * Handles delimited formats:
       *   - yyyy/dd/mm or yyyy-dd-mm (with 4-digit year)
       *   - yy/dd/mm or yy-dd-mm (with 2-digit year)
       *
       * Handles compact formats:
       *   - yyyyddmm (8 digits with 4-digit year)
       *   - yyddmm (6 digits with 2-digit year)
       *
       * 2-digit years are expanded to 4-digit years using sliding window logic.
       *
       * @param {string} dateStr - Date string to convert
       * @returns {string} Normalized date in yyyy-mm-dd format, or original if cannot parse
       */
      if ( ! dateStr ) return dateStr;

      // Try delimited format with 4-digit year: yyyy/dd/mm or yyyy-dd-mm
      var match = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
      if ( match ) {
        // Format is yyyy/dd/mm, so match[1] is year, match[2] is day, match[3] is month
        return this.formatDateParts(match[2], match[3], match[1]);
      }

      // Try delimited format with 2-digit year: yy/dd/mm or yy-dd-mm
      match = dateStr.match(/^(\d{2})[-\/](\d{1,2})[-\/](\d{1,2})$/);
      if ( match ) {
        var fullYear = this.expandTwoDigitYear(match[1]);
        return this.formatDateParts(match[2], match[3], fullYear);
      }

      // Try compact format with 4-digit year: yyyyddmm (8 digits)
      match = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
      if ( match ) {
        // Format is yyyyddmm, so match[1] is year, match[2] is day, match[3] is month
        return this.formatDateParts(match[2], match[3], match[1]);
      }

      // Try compact format with 2-digit year: yyddmm (6 digits)
      match = dateStr.match(/^(\d{2})(\d{2})(\d{2})$/);
      if ( match ) {
        var fullYear = this.expandTwoDigitYear(match[1]);
        return this.formatDateParts(match[2], match[3], fullYear);
      }

      // Couldn't parse, return as-is and let foam.lang.Date.adapt handle it
      return dateStr;
    },

    function formatDateParts(day, month, year) {
      /**
       * Formats date parts into yyyy-mm-dd format with proper zero-padding.
       *
       * @param {string|number} day - Day (1-31)
       * @param {string|number} month - Month (1-12)
       * @param {string|number} year - Year (4-digit)
       * @returns {string} Date in yyyy-mm-dd format
       */
      var d = day.toString().padStart(2, '0');
      var m = month.toString().padStart(2, '0');
      var y = year.toString();

      return y + '-' + m + '-' + d;
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
