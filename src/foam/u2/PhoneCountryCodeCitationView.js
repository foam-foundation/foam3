/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'PhoneCountryCodeCitationView',
  extends: 'foam.u2.CitationView',

  properties: [
    {
      class: 'Boolean',
      name: 'showFullName',
      value: true
    }
  ],
   
   methods: [
    function getSummary(data) {
      return data.emoji + ' ' + (this.showFullName ? (data.name + ' ') : '') + '+' + data.phoneCode;
    }
  ]
});
