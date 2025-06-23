/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Access with:
// http://localhost:8080/foam3/src/foam/core/zac/index.html (embedded)
// http://localhost:8080/src/foam/core/zac/index.html       (stand alone)

/*
group in foam.box.SessionReplyBox
loginSuccess in foam.box.SessionReplyBox
requestLogin in foam.box.SessionReplyBox
sessionTimer in foam.box.SessionReplyBox
crunchController in foam.core.crunch.box.CrunchClientReplyBox
group in foam.box.SessionReplyBox
pushMenu in foam.core.boot.CSpec
*/

foam.CLASS({
  package: 'foam.core.zac',
  name: 'MissingStuff',

  exports: [
    'group', 'loginSuccess', 'requestLogin', 'sessionTimer', 'crunchController'
  ],

  properties: [
    { name: 'group',            value: '' /*getter: function() { debugger; } */},
    { name: 'sessionTimer',     getter: function() { debugger; } },
    { name: 'crunchController', getter: function() { debugger; } },
    { class: 'Boolean', name: 'loginSuccess' }
  ],

  methods: [
    function requestLogin() {
    }
  ]
});


foam.CLASS({
  package: 'foam.core.zac',
  name: 'Client',
  extends: 'foam.u2.Element',

  documentation: 'Zero-Admin Client',

  requires: [
    'foam.core.auth.Subject',
    'foam.core.client.ClientBuilder',
    'foam.u2.stack.Stack'
  ],

  implements: [
    'foam.core.zac.MissingStuff'
  ],

  imports: [
    'window'
  ],

  exports: [
    'stack',
    'as ctrl',
    'sessionID',
    'subject',
    'currentMenu',
    'pushMenu'
  ],

  properties: [
    {
      class: 'String',
      name: 'currentMenu',
      postSet: function(o, n) {
        console.log('***** CURRENT MENU:', n);
      }
    },
    {
      name: 'stack',
      factory: function() { return this.Stack.create(); }
    },
    {
      class: 'String',
      name: 'sessionName',
      value: 'defaultSession'
    },
    {
      name: 'sessionID',
      factory: function() {
        var urlSession = '';

        try {
          urlSession = this.window.location.search.substring(1).split('&')
           .find(element => element.startsWith("sessionId")).split('=')[1];
        } catch {
        }

        return urlSession !== "" ? urlSession : localStorage[this.sessionName] ||
          ( localStorage[this.sessionName] = foam.uuid.randomGUID() );
      }
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.core.auth.Subject',
      name: 'subject',
      factory: function() { return this.Subject.create(); }
    },
    {
      class: 'String',
      name: 'bootServices',
      documentation: 'List of services to load on startup'
    },
    {
      name: 'client',
      postSet: function(o, n) { globalThis.x = n; }
    }
 ],

  methods: [
    async function render() {
      this.SUPER();

      this.tag({
        class: 'foam.u2.stack.DesktopStackView',
        data: this.stack,
        showActions: false
      });

      this.client = await this.ClientBuilder.create({authenticate: false}, this).promise;

      if ( ! globalThis.client ) {
        globalThis.client = this.client;
        globalThis.x = this.client.__subContext__;
      }

      this.bootServices.split(',').forEach(s => { this.client.__subContext__[s]; });
    },
    function pushMenu(menu) {
      menu && menu.launch && menu.launch(this.__subContext__);
    }
  ]
});
