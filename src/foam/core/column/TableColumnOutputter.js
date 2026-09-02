/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.column',
  name: 'TableColumnOutputter',

  javaImports: [
    'java.util.ArrayList',
    'java.util.List',
    'java.util.StringJoiner',
    'org.apache.commons.lang.ArrayUtils',
    'org.apache.commons.lang3.StringUtils'
  ],

  documentation: 'Class for returning 2d-array ( ie table ) for array of values ',

  properties: [
    {
      name: 'dateFormat',
      factory: function() {
        return [
          d => d ? d.toLocaleDateString('en-us') : '',
          d => d ? d.toLocaleTimeString('en-us') : ''
        ];
      }
    },
    {
      class: 'Boolean',
      name: 'addUnits',
      value: true
    }
  ],

  methods: [
    {
      name: 'returnStringValueForProperty',
      type: 'String',
      documentation: 'Method that converts value to string',
      code: async function(x, prop, val, unitPropName, addUnitPropValueToStr) {
        if ( val == 0 || val ) {
          if ( foam.Array.isInstance(val) ) {
            var stringArr = [];
            for ( var i = 0 ; i < val.length ; i++ ) {
              stringArr.push(await this.valueToString(val[i]));
            }
            return stringArr.join(' ');
          }
          if ( prop.unitPropValueToString && unitPropName ) {
            // 'Add Units' unchecked: bare spreadsheet-parseable number
            if ( ! addUnitPropValueToStr && prop.unitPropValueToPlainString )
              return await prop.unitPropValueToPlainString(x, val, unitPropName);
            return await prop.unitPropValueToString(x, val, unitPropName, ! addUnitPropValueToStr);
          }
          if ( foam.lang.DateTime.isInstance(prop) ) {
            return this.dateTimeToString(val);
          }
          if ( foam.lang.Date.isInstance(prop) ) {
            return this.dateToString(val);
          }
          if ( foam.lang.Time.isInstance(prop) ) {
            return this.timeToString(val);
          }
          return await this.valueToString(val, addUnitPropValueToStr);
        }
        return '';
      }
    },

    async function valueToString(val, opt_addUnits) {
      // JS RefSummary.f() returns a Promise resolving to { id, summary }.
      if ( val && typeof val.then === 'function' ) {
        val = await val;
        if ( val == null ) return '';
      }
      // Export with 'Add Units' unchecked: a reference column (e.g. a CurrencyCode
      // like transactionCurrency) carries a { id, summary } RefSummary map. The
      // summary is a display label ("USD - US Dollar"); the id is the bare,
      // spreadsheet-parseable code ("USD"). Emit the id in plain mode, mirroring
      // how DoubleUnitValue drops its unit. Only when addUnits is explicitly false
      // (opt_addUnits === false) — the flag is absent on other call paths, which
      // keep the summary so existing exports are unchanged.
      if ( opt_addUnits === false && foam.Object.isInstance(val) &&
           val.id !== undefined && val.summary !== undefined ) {
        return val.id == null ? '' : val.id.toString();
      }
      if ( val.toSummary ) {
        if ( val.toSummary() instanceof Promise )
          return await val.toSummary();
        return val.toSummary();
      }
      // (Ref.js) RefSummary returns a plain Map{id, summary} from the server.
      if ( foam.Object.isInstance(val) && val.summary !== undefined ) {
        return val.summary;
      }
      return val.toString();
    },

    function dateToString(d) {
      return this.dateFormat[0](d);
    },

    function timeToString(t) {
      return this.dateFormat[1](t);
    },

    function dateTimeToString(dt) {
      return this.dateFormat[0](dt) + ' ' + this.dateFormat[1](dt);
    },

    {
      name: 'arrayOfValuesToArrayOfStrings',
      code: async function(x, props, values, lengthOfPrimaryPropsRequested, addUnitPropValueToStr) {
        var stringValues = [];
        for ( var value of values ) {
          var stringArrayForValue = [];
          for ( var i = 0 ; i < lengthOfPrimaryPropsRequested ; i++ ) {
            if ( props[i].unitPropValueToString ) {
              var indexOfUnitProp = props.findIndex(p => p.name === props[i].unitPropName);
              if ( indexOfUnitProp !== -1 ) {
                var unitPropValue = value[indexOfUnitProp];
                // Reference-typed unit props (e.g. CurrencyCode) project as RefSummary
                // {id, summary} maps, not code strings; currencyDAO.find needs the id
                if ( unitPropValue && typeof unitPropValue === 'object' ) unitPropValue = unitPropValue.id;
                stringArrayForValue.push(await this.returnStringValueForProperty(x, props[i], value[i], unitPropValue, addUnitPropValueToStr));
                continue;
              }
            }
            stringArrayForValue.push(await this.returnStringValueForProperty(x, props[i], value[i], undefined, addUnitPropValueToStr));
          }
          stringValues.push(stringArrayForValue);
        }
        return stringValues;
      }
    },
    async function objToArrayOfStringValues(x, of, propNames, obj) {
      var columnConfig = x.columnConfigToPropertyConverter;
      var values = [];
      for ( var propName of  propNames ) {
        values.push(await columnConfig.returnValueForPropertyName(x, of, propName, obj));
      }
      return values;
    },
    {
      name: 'objectToTable',
      code: async function(x, of, propNames, obj, lengthOfPrimaryPropsRequested, addUnitPropValueToStr) {
        var values = await this.objToArrayOfStringValues(x, of, propNames, obj);
        return this.returnTable(x, of, propNames, values, lengthOfPrimaryPropsRequested, addUnitPropValueToStr);
      }
    },
    {
      name: 'returnTable',
      code: async function(x, of, propNames, values, lengthOfPrimaryPropsRequested, addUnitPropValueToStr) {
        var columnConfig = x.columnConfigToPropertyConverter;
        var props = columnConfig.returnProperties(of, propNames);
        var table =  [ this.getColumnHeaders(x, of, propNames.slice(0, lengthOfPrimaryPropsRequested)) ];
        var values = await this.arrayOfValuesToArrayOfStrings(x, props, values, lengthOfPrimaryPropsRequested, addUnitPropValueToStr);
        table = table.concat(values);
        return table;
      }
    },
    {
      name: 'getAllPropertyNames',
      type: 'StringArray',
      code: function(cls) {
        var props = cls.getAxiomsByClass(foam.lang.Property);
        var propNames = [];
        for ( var i = 0 ; i < props.length ; i++ ) {
          var p = props[i];
          if ( p.hidden )
            continue;
          propNames.push(p.name);
        }
        return propNames;
      }
    },
    {
      name: 'getColumnHeaders',
      type: 'String',
      code: function(x, of, arrOfPropNames) {
        var columnConfig = x.columnConfigToPropertyConverter;
        var columnHeaders = [];
        for ( var propName of  arrOfPropNames ) {
          columnHeaders.push(columnConfig.returnColumnHeader(of, propName).colPath.join('/'));
        }
        return columnHeaders;
      }
    },
    {
      name: 'returnTableForMetadata',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'metadata',
          type: 'foam.core.export.GoogleSheetsPropertyMetadata[]'
        },
        {
          name: 'arrOfObjectValues',
          javaType: 'java.util.List<Object[]>'
        }
      ],
      javaType: 'java.util.List<java.util.List<Object>>',
      javaCode: `
        java.util.List<java.util.List<Object>> result = new ArrayList<>();

        java.util.List<Object> columnHeaders = new ArrayList<>();

        for ( int i = 0 ; i < metadata.length ; i++ ) {
          columnHeaders.add(metadata[i].getColumnLabel());
        }
        result.add(columnHeaders);

        for ( int i = 0 ; i < arrOfObjectValues.size() ; i++ ) {
          java.util.List<Object> row = new ArrayList<>();
          for ( int j = 0 ; j < metadata.length ; j++ ) {
            row.add(returnStringValueForMetadata(x, metadata[j], arrOfObjectValues.get(i)[metadata[j].getProjectionIndex()], null));
          }
          result.add(row);
        }

        return result;
      `
    },
    {
      name: 'returnStringValueForMetadata',
      type: 'Object',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          name: 'metadata',
          type: 'foam.core.export.GoogleSheetsPropertyMetadata'
        },
        {
          name: 'obj',
          javaType: 'Object'
        },
        {
          name: 'unitPropValue',
          type: 'String'
        }
      ],
      javaCode: `
      if ( obj == null || obj == "" )
        return "";

      switch(metadata.getCellType()) {
        case "STRING":
        case "NUMBER":
        case "BOOLEAN":
          return obj;
        case "CURRENCY":
          return Long.valueOf(obj.toString()) / 100.0 ;
        case "DATE":
          return obj.toString().substring(0, 10);
        case "DATETIME":
          return obj.toString().substring(0, 24);
        case "TIME":
          return obj.toString().substring(0, 8);
        case "ENUM":
          return obj.toString();
        case "ARRAY":
          StringJoiner strJ = new StringJoiner(", ");
          Object[] arr = (Object[])obj;
          for ( int i = 0; i < arr.length; i++ ) {
            if ( arr[i] == null ) {
              strJ.add("");
              continue;
            }
            strJ.add(arr[i].toString());
          }
          return strJ.toString();
        default:
          return ((foam.lang.FObject)obj).toSummary();
      }
      `
    }
  ]
});
