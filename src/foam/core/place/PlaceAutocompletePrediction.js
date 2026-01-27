/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.place',
  name: 'PlaceAutocompletePrediction',

  properties: [
    {
      class: 'String',
      shortName: 'description',
      name: 'description'
    },
    {
      class: 'String',
      shortName: 'place_id',
      name: 'placeId'
    }
  ],

  methods: [
    function toSummary() {
      return this.description;
    }
  ]
});
