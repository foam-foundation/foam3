/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.u2',
  name: 'TextFormatter',

  properties: [
    {
      name: 'formatter',
      class: 'Object'
    }
  ],

  methods: [
    {
      name: 'getPlaceholder',
      args: 'String formattedData',
      documentation: `
        Calculate a placeholder text for the FormattedTextField
        If formattedData is provided, calculate a dynamic placeholder based on existing data
        Otherwise, return the default placeholder text
      `
    },
    {
      name: 'getMaxLength',
      documentation: `
        Returns the max-length of the FormattedTextField based on allowable input length plus formatting
      `
    },
    {
      name: 'getUnformatted',
      args: 'String formattedData',
      documentation: `
        Returns the unformatted version of a formatted String
      `
    },
    {
      name: 'onDelete',
      args: 'String data, Int start, Int end',
      documentation: `
        Configure properties for delete, computes and returns a new selection range to
        delete from
      `
    },
    {
      name: 'formatData',
      args: 'String data, String old, Int startingPos, Int endPos, Boolean isDelete',
      documentation: `
        On data input, re-format the data and return an Array containing
        the new formatted data and the position which the cursor should fall on
        after the input
      `
    },
    {
      name: 'reset',
      documentation: `
        Optional method to Reset state variables on initialization, data change, and formatData calls
      `
    },
    {
      name: 'buildJavaGetFormatted',
      args: 'String cls, String prop',
      documentation: `
        Builds a java method to return a formatted string using this formatter.
        Takes an argument o denoting the source object of the property.
      `
    },
    {
      name: 'buildJavaRemoveFormatting',
      documentation: `
        Builds java code to remove formatting from a string 'val'
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'SuffixFormatter',
  implements: [ 'foam.u2.TextFormatter' ],

  documentation: `
    Formats a string of word characters by using a string formatter
    that will be appended to the data.
    E.g., formatter = '.zip' formats a string as 'string_val.zip'
  `,

  properties: [
    {
      class: 'String',
      name: 'placeholderText',
      value: 'name'
    },
    {
      class: 'Int',
      name: 'maxLength',
      value: 10
    }
  ],

  methods: [
    function getPlaceholder(formattedData) {
      if ( ! formattedData ) return this.placeholderText + this.formatter;
      return formattedData;
    },

    function getUnformatted(formattedData) {
      return formattedData.endsWith(this.formatter) ?
        formattedData.substring(0, formattedData.length - this.formatter.length) :
        formattedData;
    },

    function getMaxLength() {
      return this.maxLength + this.formatter.length;
    },

    function formatData(data, old, startingPos, endPos, isDelete) {
      // handle inserting data over the formatter portion
      if ( ! isDelete && old && ! data.endsWith(this.formatter) ) {
        var oldVal = old;
        while ( old && data && data.length > startingPos && data.slice(-1) === old.slice(-1) ) {
          data = data.slice(0, -1);
          old = old.slice(0, -1);
        }
        // inserted data over a selected range in the formatter portion
        if ( data.startsWith(this.getUnformatted(oldVal)) )
          return [oldVal, old.length];
      } else {
        data = this.getUnformatted(data);
      }

      var suf = data.slice(startingPos);
      var pre = data.slice(0, startingPos).replace(/\W/g, '').slice(0, this.maxLength - suf.length);
      if ( ! ( pre || suf ) ) return ['', 0];

      return [pre + suf + this.formatter, pre.length];
    },

    function onDelete(data, start, end) {
      // handle trying to delete from the formatter portion
      if ( data.endsWith(this.formatter) ) {
        if ( end > data.length - this.formatter.length ) end = data.length;
        if ( start > data.length - this.formatter.length ) start = data.length - this.formatter.length;
      }
      return [start, end];
    },

    function buildJavaGetFormatted(cls, prop) {
      return `
        if ( ! ((${cls}) o).${prop}IsSet_ ) return "";
        String ret = ((${cls}) o).${prop}_;
        ret = ret.trim().replaceAll("[^\\\\\w]", "");
        if ( foam.util.SafetyUtil.isEmpty(ret) ) return "";
        return ret + "${this.formatter}";
      `
    },

    function buildJavaRemoveFormatting() {
      if ( ! this.formatter ) return '';
      return `
        if ( ! foam.util.SafetyUtil.isEmpty(val) && val.endsWith("${this.formatter}") )
          val = val.substring(0, val.length() - ${this.formatter.length});
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'NumericCodeFormatter',

  implements: [ 'foam.u2.TextFormatter' ],

  documentation: `
    Formats a numeric string with delimiters using an array formatter
    containing digits representing number of numeric characters and strings
    representing the delimiters.
    E.g. formatter: [ 3, '.', 3, '.', 3 ] formats a numeric string as '###.###.###'
  `,

  properties: [
    'includeTrailingDelimiter'
  ],

  methods: [
    function getPlaceholder(formattedData, placeholder) {
      if ( ! placeholder ) placeholder = this.formatter.join('').replace(/\d+/g, function(match) { return '#'.repeat(match); });
      if ( ! formattedData )
        return placeholder;
      return (formattedData || '') + placeholder.substring(formattedData && formattedData.length || 0);
    },

    function getMaxLength() {
      return this.getPlaceholder().length;
    },

    function onDelete(input, start, end) {
      this.includeTrailingDelimiter = false;
      // if start of selection is a delimiter, remove the entire delimiter
      if ( isNaN(input[start]) ) {
        while ( start > 0 && isNaN(input[start - 1]) ) start--;
      } else {
        // if removing a digit from the end keep trailing delimiter
        if ( input.substring(end).replace(/\D/g,'') == '' ) this.includeTrailingDelimiter = true
      }
      return [start, end];
    },

    function reset() {
      this.includeTrailingDelimiter = true;
    },

    function formatData(data, old, startingPos, endPos, isDelete) {
      var unformattedData = data.replace(/\D/g,'');

      // if not typing from the end of the string, do not add trailing delimiters
      if ( endPos < data.length ) this.includeTrailingDelimiter = false;
      // keep track of number of digits before selection start and use is as a initial value for final position of the cursor
      var digitsBeforeSelectionStart = pos = data.substring(0, startingPos).replace(/\D/g, '').length;

      var temp = '';
      var index = 0;
      for ( const format of this.formatter ) {
        if ( typeof format === 'number' || ! isNaN(format) ) {
          temp += unformattedData.substring(index, index += format);
          if ( index > unformattedData.length || ( index == unformattedData.length && ! this.includeTrailingDelimiter ) ) break;
        } else if ( typeof format === 'string' ) {
          temp += format;
          // if a delimiter has been inserted at an index before pos, increment pos
          if ( index <= digitsBeforeSelectionStart ) pos += format.length;
          // on delete, if index is 0, i.e., string begins with delimiter, increment startingPos
          if ( isDelete && startingPos == 0 && index == 0 ) startingPos += format.length;
        }
      }
      return [temp, isDelete ? startingPos : pos];
    },

    function getUnformatted(formattedData) {
      return formattedData.replace(/\D/g,'');
    },

    function buildJavaGetFormatted(cls, prop) {
      var str = `
        if ( ! ((${cls}) o).${prop}IsSet_ ) return "";
        StringBuilder ret = new StringBuilder(((${cls}) o).${prop}_);
      `;
      var index = 0;
      this.formatter.forEach(c => {
        if ( !isNaN(c) ) index += c;
        else {
          str += `
            if ( ret.length() < ${index} ) return ret.toString();
            ret.insert(${index}, "${c}");
          `
          index++;
        }
      });
      return str += `return ret.length() > ${index} ? ret.toString().substring(0, ${index}) : ret.toString();`
    },

    function buildJavaRemoveFormatting() {
      return `val.replaceAll("[^\\\\\d]", "");`;
    }
  ]
});
