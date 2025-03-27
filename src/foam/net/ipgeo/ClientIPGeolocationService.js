 /**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.net.ipgeo',
  name: 'ClientIPGeolocationService',
  extends: 'foam.net.ipgeo.ClientAbstractIPGeolocationService',
  requires: [
    'foam.lang.Latch'
  ],
  properties: [
    {
      name: 'ipLocation',
      class: 'FObjectProperty',
      of: 'foam.net.ipgeo.IPGeolocationInfo'
    },
    {
      name: 'initLatch',
      documentation: 'Latch to denote ip has been loaded and service is ready',
      factory: function() { return this.Latch.create(); }
    },
  ],

  methods: [
    function init() {
      this.initLatch = this.Latch.create();
      this.resolveLocation(null).then(ipLocation => {
        this.ipLocation = ipLocation;
        this.initLatch.resolve();
      });
    },
    // Awaitable convinience method to get the ip location if it is not ready by the time
    // the service is called
    async function getIPLocation() {
      await this.initLatch;
      return this.ipLocation;
    }
  ]
});
