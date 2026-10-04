/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'Language',
  documentation: 'Language codes.',

  implements: [
    'foam.core.auth.EnabledAware'
  ],

  ids: [
    'code',
    'variant'
  ],

  properties: [
    {
      class: 'String',
      name: 'code'
    },
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'nativeName',
      factory: function() {
        return this.name;
      }
    },
    {
      class: 'Boolean',
      name: 'enabled',
      value: true
    },
    {
      class: 'String',
      name: 'variant',
      value: ''
    }
  ],

  methods: [
    {
      name: 'toSummary',
      code: function() { return this.toString(); }
    },
    {
      name: 'toString',
      code: function() {
        return this.variant === '' ? this.code : this.code + '-' + this.variant;
      },
      javaCode: `
        return "".equals(getVariant()) ? getCode() : getCode() + "-" + getVariant();
      `
    }
  ]
});
