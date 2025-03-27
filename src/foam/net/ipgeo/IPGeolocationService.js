 /**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.net.ipgeo',
  name: 'AbstractIPGeolocationService',

  client: true,
  proxy: true,
  skeleton: true,

  methods: [
    {
      name: 'resolveLocation',
      args: 'Context x',
      async: true,
      type: 'foam.net.ipgeo.IPGeolocationInfo'
    }
  ]
});

foam.CLASS({
  package: 'foam.net.ipgeo',
  name: 'IPGeolocationService',
  implements: [
    'foam.net.ipgeo.AbstractIPGeolocationService'
  ],

  documentation: 'Geolocation support methods',

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.net.IPSupport',
    'foam.net.ipgeo.IPGeolocationInfo'
  ],

  methods: [
    {
      name: 'resolveLocation',
      args: 'X x',
      type: 'IPGeolocationInfo',
      javaCode: `
        return (IPGeolocationInfo) ((DAO) x.get("ipGeolocationInfoDAO")).find(IPSupport.instance().getRemoteIp(x));
      `
    }
  ]
});
