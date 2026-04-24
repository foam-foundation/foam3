/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.config',
  name: 'GlobalConfig',

  documentation: `A journal-backed key/value store for global configuration.
    Each entry stores its value in a type-specific backing property
    (stringValue, booleanValue, intValue, ...). setValue/getValue route to the
    correct backing based on the current type; the read-only 'value' property
    exposes the same routing reactively for UI and programmatic reads.`,

  ids: [ 'name' ],

  requires: [
    'foam.core.config.GlobalConfigType'
  ],

  javaImports: [
    'foam.core.config.GlobalConfigType'
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      required: true
    },
    {
      class: 'Enum',
      of: 'foam.core.config.GlobalConfigType',
      name: 'type',
      value: 'STRING',
      postSet: function(old, nu) {
        var values = this.GlobalConfigType.VALUES;
        for ( var i = 0 ; i < values.length ; i++ ) {
          if ( values[i] !== nu ) this.clearProperty(values[i].valueField);
        }
      },
      javaPostSet: `
        for ( GlobalConfigType t : GlobalConfigType.values() ) {
          if ( t != val ) clearProperty(t.getValueField());
        }
      `
    },
    { class: 'String',   name: 'stringValue',   hidden: true },
    { class: 'Boolean',  name: 'booleanValue',  hidden: true },
    { class: 'Int',      name: 'intValue',      hidden: true },
    { class: 'Long',     name: 'longValue',     hidden: true },
    { class: 'Float',    name: 'floatValue',    hidden: true },
    { class: 'Double',   name: 'doubleValue',   hidden: true },
    { class: 'Date',     name: 'dateValue',     hidden: true },
    { class: 'DateTime', name: 'dateTimeValue', hidden: true },
    {
      name: 'value',
      transient: true,
      storageTransient: true,
      view: { class: 'foam.core.config.GlobalConfigValueView' },
      expression: function(type, stringValue, booleanValue, intValue, longValue, floatValue, doubleValue, dateValue, dateTimeValue) {
        if ( ! type ) return undefined;
        return this[type.valueField];
      }
    }
  ],

  methods: [
    {
      name: 'setValue',
      args: 'Object val',
      code: function(val) {
        if ( ! this.type ) return;
        this[this.type.valueField] = val;
      },
      javaCode: `
        if ( getType() == null ) return;
        String field = getType().getValueField();
        if ( field == null ) return;
        switch ( field ) {
          case "stringValue":
            setStringValue(val == null ? "" : val.toString());
            break;
          case "booleanValue":
            setBooleanValue(val instanceof Boolean
              ? ((Boolean) val).booleanValue()
              : Boolean.parseBoolean(String.valueOf(val)));
            break;
          case "intValue":
            setIntValue(val instanceof Number
              ? ((Number) val).intValue()
              : Integer.parseInt(String.valueOf(val)));
            break;
          case "longValue":
            setLongValue(val instanceof Number
              ? ((Number) val).longValue()
              : Long.parseLong(String.valueOf(val)));
            break;
          case "floatValue":
            setFloatValue(val instanceof Number
              ? ((Number) val).floatValue()
              : Float.parseFloat(String.valueOf(val)));
            break;
          case "doubleValue":
            setDoubleValue(val instanceof Number
              ? ((Number) val).doubleValue()
              : Double.parseDouble(String.valueOf(val)));
            break;
          case "dateValue":
            setDateValue((java.util.Date) val);
            break;
          case "dateTimeValue":
            setDateTimeValue((java.util.Date) val);
            break;
        }
      `
    },
    {
      name: 'getValue',
      type: 'Object',
      code: function() {
        if ( ! this.type ) return undefined;
        return this[this.type.valueField];
      },
      javaCode: `
        if ( getType() == null ) return null;
        String field = getType().getValueField();
        if ( field == null ) return null;
        switch ( field ) {
          case "stringValue":   return getStringValue();
          case "booleanValue":  return getBooleanValue();
          case "intValue":      return getIntValue();
          case "longValue":     return getLongValue();
          case "floatValue":    return getFloatValue();
          case "doubleValue":   return getDoubleValue();
          case "dateValue":     return getDateValue();
          case "dateTimeValue": return getDateTimeValue();
        }
        return null;
      `
    }
  ]
});
