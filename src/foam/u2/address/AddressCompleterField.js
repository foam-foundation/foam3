/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/


foam.CLASS({
  package: 'foam.u2.address',
  name: 'AddressCompleterField',
  extends: 'foam.u2.view.SuggestedTextField',
  documentation: `
    Suggested Text Field that uses google places API to find nearest match for given address query
    Service called by AddressAutocompleter
  `,

  requires: ['foam.u2.address.AddressAutocompleter'],
  properties: [
    {
      name: 'autocompleter',
      factory: function() {
        return this.AddressAutocompleter.create({ loading$: this.loading$, error$: this.error$ });
      }
    },
    {
      name: 'placeholder',
      value: 'Start typing address'
    },
    {
      name: 'suggestionsLimit',
      value: 0
    }
  ],

  listeners: [
    {
      name: 'onUpdate',
      isFramed: true,
      code: function() {
        this.filteredValues = this.autocompleter.filtered;
        if ( ! this.filteredValues.length ) this.error = this.NO_SUGGESTIONS_MSG;
      }
    },
    function loaded() {
      if ( this.error == this.autocompleter.NO_SERVICE ) return;
      this.onDetach(this.autocompleter.filtered$.sub(this.onUpdate));
    }
  ]
});
