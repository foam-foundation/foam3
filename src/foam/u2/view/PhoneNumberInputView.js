/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.u2.view',
  name: 'PhoneNumberInputView',
  extends: 'foam.u2.View', 
  mixins: ['foam.util.DeFeedback'],

  documentation: 'View for editing PhoneNumber Properties.',

  requires: [
    'foam.u2.PhoneCountryCodeCitationView',
    'foam.core.auth.Country'
  ],

  imports: [
    'countryDAO',
    'ipGeolocationService?'
  ],

  css: `
  ^ {
    display: flex;
    width: 100%;
  }
  
  ^country {
    /* ToDo: Add border-right: none; */
  }
  
  ^phone {
    /* ToDo: Add border-left: none; */
  }
  `,

  properties: [
    {
      class: 'PhoneNumber',
      name: 'data'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.Country', 
      name: 'countryCode',
      required: true,
      view: function(_, X) { 
        return {
          class: 'foam.u2.view.RichChoiceReferenceView',
          rowView: { class: 'foam.u2.PhoneCountryCodeCitationView' },
          fullObject_$: X.data$.dot('countryObject'),
          comparator: null,
          sections: [
            {
              heading: 'Countries',
              dao: X.countryDAO.orderBy(foam.core.auth.Country.NAME)
            }
          ]
        }
      }
    },
    {
      class: 'String',
      name: 'localPhoneNumber',
      view: { class: 'foam.u2.TextField', type: 'tel' }
    },
    {
      class: 'FObjectProperty',
      name: 'countryObject'
    }
  ],

  methods: [
    function render() {
      this.parsePhoneNumber().then(() => {
        this.setCountryCodeFromIP();
      });

      this
        .addClass(this.myClass())
        .startContext({data: this})
          .add(this.COUNTRY_CODE)
          .add(this.LOCAL_PHONE_NUMBER)
        .endContext();
    }
  ],

  listeners: [
    {
      name: 'setCountryCodeFromIP',
      code: async function() {
        if ( this.countryCode || ! this.ipGeolocationService ) return;
        let ip = this.ipGeolocationService.ipLocation;
        if ( ! ip ) {
          ip = await this.ipGeolocationService.getIPLocation();
        }
        if ( ip?.country && ! this.countryCode ) {
          this.countryCode = ip.country;
        }
      }
    },
    {
      name: 'updatePhoneNumber',
      on: ['this.propertyChange.localPhoneNumber', 'this.propertyChange.countryObject'],
      code: function() {
        if ( ! this.localPhoneNumber ) return;
        this.deFeedback(() => {
          this.data = '+' + this.countryObject.phoneCode + '-' + this.localPhoneNumber;
        });
      }
    },
    {
      name: 'parsePhoneNumber',
      on: ['this.propertyChange.data'],
      code: async function() {
        this.deFeedback(async () => {
          if ( ! this.data ) return;
          var parts = this.data.split('-');
          if ( parts.length === 2 ) {
            var countryCode = parts[0].substring(1); // Remove the '+' prefix

            this.countryCode = await this.countryDAO.find(this.EQ(this.Country.PHONE_CODE, countryCode));
            this.localPhoneNumber = parts[1];
          } else if ( parts.length === 1 ) {
            // Support for local phone numbers without a country code
            this.localPhoneNumber = parts[0];
          }
        });
      }
    }
  ]
});