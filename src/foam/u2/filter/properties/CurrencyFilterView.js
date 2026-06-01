/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.filter.properties',
  name: 'CurrencyFilterView',
  extends: 'foam.u2.filter.properties.StringFilterView',

  documentation: `
    Filter view tuned for ISO 4217 currency-code columns.

    Differs from StringFilterView in two ways:
      - allows up to 300 distinct values so the full alphabet of active
        and historical ISO codes is reachable without a "limit reached" warning;
      - normalises the search input to upper case before STARTS_WITH so a
        user typing 'u' matches stored values like 'USD'.
  `,

  messages: [
    { name: 'LABEL_PLACEHOLDER', message: 'Search currency' }
  ],

  properties: [
    {
      class: 'Int',
      name: 'limit',
      value: 300
    }
  ],

  methods: [
    function searchPredicate() {
      if ( ! this.search || this.search.trim().length === 0 ) return this.TRUE;
      return this.STARTS_WITH(this.property, this.search.trim().toUpperCase());
    }
  ]
});
