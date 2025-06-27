 /**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.net.ipgeo',
  name: 'IPGeolocationService',

  skeleton: true,

  documentation: 'Geolocation support methods',

  javaImports: [
    'foam.dao.DAO',
    'foam.net.IPSupport',
    'foam.net.ipgeo.IPGeolocationInfo'
  ],

  methods: [
    {
      name: 'resolveLocation',
      async: true,
      args: 'Context x',
      type: 'IPGeolocationInfo',
      javaCode: `
        return (IPGeolocationInfo) ((DAO) x.get("ipGeolocationInfoDAO")).find(IPSupport.instance().getRemoteIp(x));
      `
    },
    {
        name: 'resolveLocationString',
        async: true,
        args: 'Context x, String ipStr',
        type: 'IPGeolocationInfo',
        javaCode: `
          return (IPGeolocationInfo) ((DAO) x.get("ipGeolocationInfoDAO")).find(ipStr);
        `
      }
  ]
});
