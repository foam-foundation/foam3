/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.config',
  name: 'GlobalConfigType',

  documentation: `Supported types for GlobalConfig values. Each value knows the
    name of the backing *Value property on GlobalConfig that stores its data.`,

  properties: [
    {
      class: 'String',
      name: 'valueField'
    }
  ],

  values: [
    { name: 'STRING',    label: 'String',    valueField: 'stringValue' },
    { name: 'BOOLEAN',   label: 'Boolean',   valueField: 'booleanValue' },
    { name: 'INT',       label: 'Int',       valueField: 'intValue' },
    { name: 'LONG',      label: 'Long',      valueField: 'longValue' },
    { name: 'FLOAT',     label: 'Float',     valueField: 'floatValue' },
    { name: 'DOUBLE',    label: 'Double',    valueField: 'doubleValue' },
    { name: 'DATE',      label: 'Date',      valueField: 'dateValue' },
    { name: 'DATE_TIME', label: 'DateTime',  valueField: 'dateTimeValue' }
  ]
});
