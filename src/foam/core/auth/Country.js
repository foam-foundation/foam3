/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'Country',

  documentation: 'The base model for country information.',

  ids: [ 'code' ],
  order: 'name',

  properties: [
    {
      class: 'String',
      name: 'code',
      documentation: `[ISO 3166](https://www.iso.org/iso-3166-country-codes.html)
        -1 alpha-2 Country codes.`
    },
    {
      class: 'String',
      name: 'isoNumeric',
      shortName: 'isoNum',
      label: 'ISO Numeric Code',
      documentation: `[ISO 3166](https://www.iso.org/iso-3166-country-codes.html)
        -1 numeric country codes.`
    },
    {
      class: 'String',
      name: 'iso31661Code',
      shortName: 'iso',
      label: 'ISO Code',
      documentation: `[ISO 3166](https://www.iso.org/iso-3166-country-codes.html)
        -1 alpha-3 country codes.`
    },
    {
      class: 'String',
      name: 'name',
      documentation: 'The name of the country.'
    },
    {
      class: 'String',
      name: 'longName',
      documentation: 'The full name of the country.'
    },
    {
      class: 'String',
      name: 'nativeName',
      shortName: 'native',
      factory: function() {
        return this.name
      }
    },
    {
      class: 'StringArray',
      name: 'alternativeNames',
      shortName: 'alt',
      documentation: `A list of known alternative country names.`
    },
    {
      class: 'String',
      name: 'geographicRegion',
      documentation: "The country's region"
    },
    {
      class: 'String',
      name: 'phoneCode',
      documentation: 'The country\'s phone code.'
    },
    {
      class: 'String',
      name: 'emoji',
      documentation: 'The country\'s flag emoji.'
    }
  ],

  methods: [
    {
      name: 'toString',
      type: 'String',
      code: function() {
        return 'Country: ' + this.code + ', ' + this.name;
      },
      javaCode: `
        return "{ code:" + this.getCode() + ", name:" + this.getName() + " }";
      `
    },
    function toSummary() {
      return this.emoji + ' ' + this.name;
    }
  ]
});
