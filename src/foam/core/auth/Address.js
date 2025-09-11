/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'Address',

  documentation: 'The base model for the postal address.',

  axioms: [ foam.pattern.Faceted.create({ ofProperty: 'countryId' }) ],

  implements: [
    {
      path: 'foam.mlang.Expressions',
      flags: ['js'],
    }
  ],

  requires: [
    'foam.core.auth.Region'
  ],

  imports: [
    'translationService'
  ],

  javaImports: [
    'foam.util.SafetyUtil'
  ],

  messages: [
    { name: 'CITY_REQUIRED', message: 'Required' },
    { name: 'COUNTRY_REQUIRED', message: 'Required' },
    { name: 'INVALID_COUNTRY', message: 'Invalid country' },
    { name: 'REGION_REQUIRED', message: 'Required' },
    { name: 'INVALID_REGION', message: 'Invalid region. Please provide valid ISO-3166-2 region.' },
    { name: 'INVALID_ADDRESS_1_REQUIRED', message: 'Required' },
    { name: 'INVALID_POSTAL_CODE', message: 'Required' },
    { name: 'POSTAL_CODE_REQUIRE', message: 'Required' },
    { name: 'STREET_NAME_REQUIRED', message: 'Required' },
    { name: 'STREET_NUMBER_REQUIRED', message: 'Required' }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'structured',
      value: true,
      documentation: `Determines whether the address is shown in the following structure:
        Street Number, Street Name, Suite Number. For an unstructured address field,
        use address1 and/or address2.
      `,
      hidden: true
    },
    {
      class: 'String',
      name: 'address1',
      label: 'Address',
      width: 70,
      displayWidth: 50,
      gridColumns: 6,
      documentation: 'An unstructured field for the main postal address.',
      validationPredicates: [
        {
          args: ['structured', 'address1'],
          query: 'structured==true||address1.len>=1',
          errorMessage: 'INVALID_ADDRESS_1_REQUIRED'
        }
      ],
      expression: function(streetNumber, streetName) {
        return [streetNumber, streetName].filter(Boolean).join(' ');
      }
    },
    {
      class: 'String',
      name: 'address2',
      label: 'Address Line 2 (Apt, suite, etc.)',
      width: 70,
      displayWidth: 50,
      gridColumns: 6,
      documentation: 'An unstructured field for the sub postal address.',
      expression: function(suite) {
        return suite || '';
      }
    },
    {
      class: 'Reference',
      targetDAOKey: 'countryDAO',
      name: 'countryId',
      label: 'Country',
      shortName: 'country',
      of: 'foam.core.auth.Country',
      documentation: `A foreign key into the CountryDAO which represents the country.`,
      required: true,
      gridColumns: 6,
      tableWidth: 135,
      validateObj: function(countryId) {
        if ( typeof countryId !== 'string' || countryId.length === 0 ) {
          return this.COUNTRY_REQUIRED;
        }
      },
      javaValidateObj: `
        var address = (Address) obj;
        if ( SafetyUtil.isEmpty(address.getCountryId()) ) {
          throw new IllegalStateException(COUNTRY_REQUIRED);
        }

        if ( address.findCountryId(x) == null ) {
          throw new IllegalStateException(INVALID_COUNTRY);
        }
      `,
      postSet: function(oldValue, newValue) {
        if ( oldValue !== newValue && ! this.regionId.startsWith(newValue) ) {
          this.regionId = undefined;
        }
      },
      view: function(_, X) {
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'Countries',
              dao: X.countryDAO
            }
          ]
        };
      }
    },
    {
      class: 'Reference',
      targetDAOKey: 'regionDAO',
      name: 'regionId',
      label: 'Region',
      of: 'foam.core.auth.Region',
      documentation: `A foreign key into the RegionDAO which represents
        the region of the country.`,
      gridColumns: { columns: 4, xsColumns: 6, xxsColumns: 6 },
      view: function(_, X) {
        var choices = X.data.slot(function(countryId) {
          return X.regionDAO.where(X.data.EQ(X.data.Region.COUNTRY_ID, countryId || ""));
        });
        return foam.u2.view.ChoiceView.create({
          objToChoice: function(region) {
            return [region.id, region.name];
          },
          dao$: choices
        }, X);
      },
      required: true,
      javaValidateObj: `
        var address = (Address) obj;
        if ( SafetyUtil.isEmpty(address.getCountryId()) ) {
          return;
        }

        if ( SafetyUtil.isEmpty(address.getRegionId()) ) {
          throw new IllegalStateException(REGION_REQUIRED);
        }

        var region = address.findRegionId(x);
        if ( region == null || ! region.getCountryId().equals(address.getCountryId()) ) {
          throw new IllegalStateException(INVALID_REGION);
        }
      `,
      validateObj: function(regionId, countryId) {
        // If the country hasn't been selected yet, don't show this error.
        if ( countryId == null ) return;
      }
    },
    {
      class: 'String',
      name: 'suite',
      documentation: 'The structured field for the suite number of the postal address.',
      gridColumns: { columns: 3, xsColumns: 6, xxsColumns: 6 },
      width: 16
    },
    {
      // TODO: Remove structured, street number, and street name. This should be a view concern
      // and not baked into the model.
      class: 'String',
      name: 'streetNumber',
      label: 'Street #',
      width: 16,
      documentation: 'The structured field for the street number of the postal address.',
      gridColumns: { columns: 3, xsColumns: 6, xxsColumns: 6 },
      validationPredicates: [
        {
          args: ['structured', 'streetNumber'],
          query: 'structured==false||streetNumber.len>=1',
          errorMessage: 'STREET_NUMBER_REQUIRED'
        }
      ]
    },
    {
      class: 'String',
      name: 'streetName',
      label: 'Street Name',
      width: 70,
      documentation: 'The structured field for the street name of the postal address.',
      gridColumns: 6,
      validationPredicates: [
        {
          args: ['structured', 'streetName'],
          query: 'structured==false||streetName~/^\s*.+\s*$/',
          errorMessage: 'STREET_NAME_REQUIRED'
        }
      ]
    },
    {
      class: 'String',
      name: 'city',
      documentation: 'The city of the postal address.',
      required: true,
      gridColumns: { columns: 4, xsColumns: 6, xxsColumns: 6 }
    },
    {
      class: 'String',
      name: 'postalCode',
      documentation: 'The postal code of the postal address.',
      preSet: function(oldValue, newValue) {
        return newValue.toUpperCase();
      },
      gridColumns: { columns: 4, xsColumns: 6, xxsColumns: 6 },
      validationPredicates: [
        // Requirement for PK is postalCode is optional
        // real country distictions to come with NP-8818-facade Address
        {
          args: ['postalCode'],
          query: 'postalCode.len>0||countryId=="PK"',
          errorMessage: 'POSTAL_CODE_REQUIRE'
        },
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="CA"||postalCode==""||postalCode~/^[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z][ -]?\\d[ABCEGHJ-NPRSTV-Z]\\d$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="US"||postalCode~/^\\d{5}(?:[-\\s]\\d{4})?$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Austria
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="AT"||postalCode~/^\\d{4}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Belgium
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="BE"||postalCode~/^(?:(?:[1-9])(?:\\d{3}))$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Brazil
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="BR"||postalCode~/^\\d{5}-?\\d{3}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // China
        // Note: The postal services in Macau or Hong Kong Special Administrative Regions remain separate from
        // Mainland China, with no postal code system currently used
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="CN"||postalCode~/^\\d{6}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Cyprus
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="CY"||postalCode~/^\\d{4}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Estonia
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="EE"||postalCode~/^\\d{5}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Finland
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="FI"||postalCode~/^\\d{5}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // France
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="FR"||postalCode~/^(?:[0-8]\\d|9[0-8])\\d{3}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Germany
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="DE"||postalCode~/^\\d{5}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Great Britain
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="GB"||postalCode~/^(GIR[ ]?0AA|((AB|AL|B|BA|BB|BD|BH|BL|BN|BR|BS|BT|CA|CB|CF|CH|CM|CO|CR|CT|CV|CW|DA|DD|DE|DG|DH|DL|DN|DT|DY|E|EC|EH|EN|EX|FK|FY|G|GL|GY|GU|HA|HD|HG|HP|HR|HS|HU|HX|IG|IM|IP|IV|JE|KA|KT|KW|KY|L|LA|LD|LE|LL|LN|LS|LU|M|ME|MK|ML|N|NE|NG|NN|NP|NR|NW|OL|OX|PA|PE|PH|PL|PO|PR|RG|RH|RM|S|SA|SE|SG|SK|SL|SM|SN|SO|SP|SR|SS|ST|SW|SY|TA|TD|TF|TN|TQ|TR|TS|TW|UB|W|WA|WC|WD|WF|WN|WR|WS|WV|YO|ZE)(\\d[\\dA-Z]?[ ]?\\d[ABD-HJLN-UW-Z]{2}))|BFPO[ ]?\\d{1,4})$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Greece
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="GR"||postalCode~/^\\d{3}\\s{0,1}\\d{2}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Ireland
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="IE"||postalCode~/[A-Za-z]\\d{2}\\s?[A-Za-z\\d]{4}/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // India
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="IN"||postalCode~/^\\d{6}(?:[-\\s]\\d{4})?$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Italy
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="IT"||postalCode~/^\\d{5}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Isreal
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="IL"||postalCode~/^\\d{7}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Latvia
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="LV"||postalCode~/^(LV-)?\\d{4}$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Lithuania
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="LT"||postalCode~/^(LT-)?\\d{5}$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Luxembourg
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="LU"||postalCode~/^\\d{4}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Malta
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="MT"||postalCode~/^[A-Z]{3}\\s?\\d{4}$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // the Netherlands
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="NL"||postalCode~/^(?:NL-)?(?:[1-9]\\d{3} ?(?:[A-EGHJ-NPRTVWXZ][A-EGHJ-NPRSTVWXZ]|S[BCEGHJ-NPRTVWXZ]))$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Portugal: "NNNN-NNN", "NNNN NNN"
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="PT"||postalCode~/^\\d{4}[- ]{0,1}\\d{3}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Slovakia
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="SK"||postalCode~/^(SK-)?\\d{3}\\s?\\d{2}$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Slovenia
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="SI"||postalCode~/^(SI-)?\\d{4}$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Spain
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="ES"||postalCode~/^(?:0[1-9]|[1-4]\\d|5[0-2])\\d{3}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Sweden
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="SE"||postalCode~/^(s-|S-){0,1}[0-9]{3}\\s?[0-9]{2}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Jamaica
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="JM"||postalCode~/^(JM)[a-zA-Z]{3}\\d{2}$/i',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Lebanon
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="LB"||postalCode~/^(\\d{4}|\\d{8})$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Mexico
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="MX"||postalCode~/^\\d{5}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Malaysia
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="MY"||postalCode~/^\\d{5}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Trinidad and Tobago
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="TT"||postalCode~/^\\d{6}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // South Africa
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="ZA"||postalCode~/^\\d{4}$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        },
        // Pakistan
        {
          args: ['postalCode', 'countryId'],
          query: 'countryId!="PK"||postalCode~/^(\\s*|\\d{5})$/',
          errorMessage: 'INVALID_POSTAL_CODE',
          jsErr: function(X) {
            let postalCodeError = X.translationService.getTranslation(foam.locale, `${X.countryId.toLowerCase()}.foam.core.auth.Address.POSTAL_CODE.error`);
            if ( ! postalCodeError ) {
              postalCodeError = X.translationService.getTranslation(foam.locale, '*.foam.core.auth.Address.POSTAL_CODE.error');
            }
            return postalCodeError ? postalCodeError : X.INVALID_POSTAL_CODE;
          }
        }
      ],
      javaSetter: `
        if ( val != null ) {
          postalCode_ = val.toUpperCase();
          postalCodeIsSet_ = true;
        }
      `
    },
    {
      class: 'String',
      name: 'postalCodeLabel',
      expression: function(countryId) {
        let translatedPostalCodeLabel = this.translationService.getTranslation(foam.locale, `${countryId.toLowerCase()}.postalCode.label`);
        return translatedPostalCodeLabel ? translatedPostalCodeLabel : this.translationService.getTranslation(foam.locale, 'postalCode.label', 'Postal Code');
      },
      hidden: true
    },
    {
      class: 'Double',
      name: 'latitude',
      documentation: 'The latitude of the postal address location.',
      hidden: true
    },
    {
      class: 'Double',
      name: 'longitude',
      documentation: 'The longitude of the postal address location.',
      hidden: true
    },
    {
      class: 'Enum',
      name: 'propertyType',
      of: 'foam.core.auth.PropertyType',
      documentation: 'Defines property type of address.'
    },
    {
      class: 'String',
      name: 'summary',
      label: 'Address',
      transient: true,
      factory: function() {
        return this.toSummary();
      }
    }
  ],

  methods: [
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        return [this.getShortAddress(), this.city, this.regionId, this.countryId, this.postalCode]
          .filter(s => s)
          .join(', ');
      },
      javaCode: `
        StringBuilder sb = new StringBuilder();
        sb.append(getShortAddress());
        sb.append(", ");
        sb.append(this.getCity());
        sb.append(", ");
        sb.append(getRegionId());
        sb.append(", ");
        sb.append(getCountryId());
        sb.append(", ");
        sb.append(getPostalCode());
        String rtn = sb.toString();
        return rtn.equals(", , , , ") ? "" : rtn;
      `
    },
    {
      name: 'getShortAddress',
      type: 'String',
      code: function() {
        var rtn = '';
        if ( this.structured ) {
          rtn += this.suite;
          rtn += (this.suite ? '-' : '');
          rtn += this.streetNumber;
          rtn += ' ';
          rtn += this.streetName;
        } else {
          rtn += this.address1;
          rtn += ' ';
          rtn += this.address2;
        }
        return rtn.trim();
      },
      javaCode: `
      StringBuilder sb = new StringBuilder();
      if ( getStructured() ) {
        if ( getSuite() != null && ! getSuite().equals("") ) {
          sb.append(getSuite());
          sb.append("-");
        }
        sb.append(getStreetNumber());
        sb.append(" ");
        sb.append(getStreetName());
      } else {
        sb.append(getAddress1());
        sb.append(" ");
        sb.append(getAddress2());
      }
      return sb.toString().trim();
      `
    },
    {
      name: 'getAddress',
      type: 'String',
      code: function() {
        return this.getShortAddress();
      },
      javaCode: `
      return getShortAddress();
     `
    },
    {
      name: 'retrieveRegionCode',
      type: 'String',
      args: [ { name: 'x', type: 'Context' } ],
      javaCode: `
        String regionCode = "";
        Region region = findRegionId(x);
        if ( region != null ) {
          regionCode = region.getIsoCode();
        }

        return ! SafetyUtil.isEmpty(regionCode) ?
          regionCode :
          getRegionId();
      `
    }
  ]
});
