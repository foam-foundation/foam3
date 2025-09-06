/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'GBAddress',
  extends: 'foam.core.auth.Address',

  javaImports: [
    'foam.util.SafetyUtil'
  ],

  messages: [
    { name: 'CITY_CONTAINS_NUMBER', message: 'City can not contain numbers'}
  ],

  properties: [
    {
      name: 'regionId',
      visibility: 'HIDDEN',
      required: false,
      javaValidateObj: null
    },
    {
      name: 'city',
      validationPredicates: [
        {
          query: 'city~/^\\D*$/',
          errorMessage: 'CITY_CONTAINS_NUMBER'
        }
      ]
    }
  ],
  methods: [
    function compareTo(other) {
      if ( other === this ) return 0;
      if ( ! other        ) return 1;

      if ( this.model_ !== other.model_ ) {
        return other.model_ ?
          foam.util.compare(this.model_.id, other.model_.id) :
          1;
      }

      let ps = [this.POSTAL_CODE, this.CITY, this.ADDRESS1];
      for ( var i = 0 ; i < ps.length ; i++ ) {
        var r = ps[i].compare(this, other);
        if ( r ) return r;
      }
      return 0;
    }
  ]
});
