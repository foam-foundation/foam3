/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'SessionClientDAO',
  extends: 'foam.dao.ProxyDAO',

  flags: ['web'],

  documentation: `Support for calling DAO web services with explicit session id.
use:
c = foam.dao.SessionClientDAO.create({
  serviceName: 'languageDAO',
  sessionId: 'E7A01D59-E35C-47E1-A5A6-9EA81D5BCDAD'
}, x);

a = await c.select();
console.log('a', a && a.array);
// or
c.select().then(function(a1) {
  console.log('a1', a1 && a1.array);
});
`,

  // NOTE: Do not export, will invalidate the browser's current session
  // exports: [
  //   'sessionId as sessionID'
  // ],

  requires: [
    'foam.box.SessionClientBox',
    'foam.box.HTTPBox',
    'foam.box.HTTPAuthorizationType',
    'foam.dao.ClientDAO'
  ],

  properties: [
    {
      name: 'serviceName',
      class: 'String'
    },
    {
      documentation: 'Session token',
      name: 'sessionId',
      class: 'String',
      factory: function() { return this.jsSessionID || localStorage.defaultSession; }
    }
  ],

  methods: [
    {
      name: 'init',
      code: function() {
        this.SUPER();

        // Create explicit sub context rather than an 'export'.
        // 'export' will invalidate the browser's current session.
        var x = this.__subContext__.createSubContext({
          sessionID: this.sessionId
        });

        var box = this.HTTPBox.create({
          authorizationType: this.HTTPAuthorizationType.BEARER,
          url: 'service/'+this.serviceName
        }, x);

        this.delegate = this.ClientDAO.create({
          name: this.serviceName,
          of: this.__subContext__[this.serviceName].of,
          delegate: box
        }, x);
      }
    }
  ]
});
