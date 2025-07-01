/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.lang',
  name: 'Holder',
  documentation: 'Marker interface for all Holder classes.'
});


foam.CLASS({
  package: 'foam.lang',
  name: 'IntHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      class: 'Int',
      name: 'value'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'FloatHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      class: 'Float',
      name: 'value'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'StringHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      name: 'value',
      class: 'String'
    }
  ],

  methods: [
    {
      name: 'toString',
      code: function() {
        return this.value;
      },
      javaCode: `
        return getValue();
      `
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'BooleanHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      name: 'value',
      class: 'Boolean'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'DateTimeHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      name: 'value',
      class: 'DateTime'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'DateHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      name: 'value',
      class: 'Date'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'RequiredBooleanHolder',
  extends: 'foam.lang.BooleanHolder',

  implements: [ 'foam.lang.Holder' ],

  messages: [
    { name: 'WRONG_VALUE', message: 'Wrong value' }
  ],

  properties: [
    {
      name: 'value',
      class: 'Boolean',
      validationPredicates: [
        {
          query: 'value==true',
          errorMessage: 'WRONG_VALUE'
        }
      ]
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'MapHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      name: 'value',
      class: 'Map'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'RawMapHolder',

  implements: [ 'foam.lang.Holder' ],

  documentation: 'Map items are stored as raw json objects without being parsed to fobjects.',

  properties: [
    {
      name: 'value',
      class: 'Map',
      fromJSON: function fromJSON(value) {
        return value;
      },
      javaJSONParser: 'foam.lib.json.RawMapParser.instance()'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'StringArrayHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      class: 'StringArray',
      name: 'value'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'IntegerArrayHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    {
      class: 'IntegerArray',
      name: 'value'
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'AnyHolder',

  implements: [ 'foam.lang.Holder' ],

  properties: [
    'value'
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'VoidHolder',
  documentation: `
    Holder model to be used when there is no value required.
    For ex, use when a capability needs to display a view but doesn't require data
  `
});
