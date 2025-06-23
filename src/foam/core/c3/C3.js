/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.c3',
  name: 'ApplicationBorder',
  extends: 'foam.u2.Element',

  css: `
    ^ { background: gray; padding: 10px; display: inline-block; }
    ^title { padding: 6px; align-content: center; background: aliceblue; }
    ^footer { padding: 6px; align-content: left; background:$backgroundDefault; }
    ^content { padding: 6px; width: 800px; height: 600px; background:$backgroundDefault; }
  `,

  properties: [
    'title',
    'leftPanel',
    'footer'
  ],

  methods: [
    function ainit() {
      this.write(document);
    },
    function render() {
      this.
        start().
          addClass(this.myClass()).
          start('div', {}, this.title$).addClass(this.myClass('title')).end().
          start().
            style({display: 'flex', 'padding-top':'10px'}).
            start('div', null, this.leftPanel$).
              style({width: '25%', 'padding-right': '10px'}).
              addClass(this.myClass('leftPanel')).
            end().
            start('div', null, this.content$).
              addClass(this.myClass('content')).
            end().
          end().
          tag('hr').
          start('div', {}, this.footer$)
            .addClass(this.myClass('footer'))
          .end().
        end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.c3',
  name: 'ClockClient',

  imports: [ 'applicationBorder' ],

  methods: [
    function ainit() {
      // this.applicationBorder.content.add('Clock');
//      this.applicationBorder.content.add(foam.demos.clock.Clock.create({}, this));
      this.applicationBorder.content.add(foam.core.auth.login.SignIn.create({}, this));
    }
  ]
});


foam.CLASS({
  package: 'foam.core.c3',
  name: 'Header',

  imports: [ 'applicationBorder' ],

  methods: [
    function ainit() {
      this.applicationBorder.title.add('Application Header');
    }
  ]
});


foam.CLASS({
  package: 'foam.core.c3',
  name: 'Menus',
  extends: 'foam.u2.Controller',

  imports: [
    'applicationBorder',
    'menuDAO'
  ],

  properties: [
  ],

  methods: [
    function ainit() {
      this.applicationBorder.leftPanel.add(this);
    },

    function render() {
      var self = this;
      this.select(this.menuDAO, function(m) {
        if ( ! m.label ) return;
        this.start('a').
          on('click', () => self.loadMenu(m)).
          add(m.label).
        end().
        br();
      });
    },

    function loadMenu(m) {
      console.log('**** loadMenu', m);
      this.applicationBorder.content.removeAllChildren();
      this.applicationBorder.content.add(m.label);
//      this.applicationBorder.content.add(m.handler.createView(this, m));
    }
  ]
});


foam.CLASS({
  package: 'foam.core.c3',
  name: 'Footer',

  imports: [ 'applicationBorder', 'sessionID' ],

  methods: [
    function ainit() {
      this.applicationBorder.footer.add('Copyright Blah Blah - Session:', this.sessionID);
    }
  ]
});

foam.CLASS({
  package: 'foam.core.c3',
  name: 'C3',
  extends: 'foam.u2.Controller',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.core.boot.CSpec',
    'foam.core.client.ClientBuilder',
    'foam.core.auth.login.SignIn',

    'foam.core.auth.Group',
    'foam.core.auth.User',
    'foam.core.auth.Subject',
  ],

  imports: [
    'params'
  ],

  exports: [
    'sessionID',
    'as c3',
    'as ctrl',
    'pushMenu',

    'subject',
    'group'
  ],

  properties: [
    {
      name: 'sessionID',
      factory: function() {
        // TODO: Why isn't this moved to ClientBuilder?
        /**
          Note that the property name is 'sessionID' the the HTTP parameter is
          'sessionId', probably due to a historical mistake.
        **/
        return this.params.sessionId || localStorage[this.sessionName] ||
          ( localStorage[this.sessionName] = foam.uuid.randomGUID() );
      }
    },
    {
      name: 'client'
    },
    {
      name: 'extraServices',
      class: 'FObjectArray',
      of: 'foam.core.boot.CSpec',
      factory: function() { return [
        {
          name: 'applicationBorder',
          client: `{ "class": "foam.core.c3.ApplicationBorder" }`
        },
        {
          name: 'header',
          client: `{ "class": "foam.core.c3.Header" }`
        },
        {
          name: 'footer',
          client: `{ "class": "foam.core.c3.Footer" }`
        },
        {
          name: 'clock',
          client: `{ "class": "foam.core.c3.ClockClient" }`
        },
        {
          name: 'menus',
          client: `{ "class": "foam.core.c3.Menus" }`
        }
      ]; }
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.core.auth.Group',
      name: 'group',
      menuKeys: ['admin.groups']
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.core.auth.Subject',
      name: 'subject',
      factory: function() { return this.Subject.create(); }
    },
  ],

  methods: [
    async function ainit() {
      this.extraServices.forEach(s => s.lazyClient = false);

      var cb       = this.ClientBuilder.create({extraServices: this.extraServices});
      var Client   = await cb.promise;
      this.client  = Client.create(null, this);
      globalThis.x = this.client.__subContext__;
      this.br().add('Client Created').br();

//      this.client.EAGER_CLIENTS_.forEach(s => this.startService(s));
      cb.cSpecDAO.where(this.EQ(this.CSpec.LAZY_CLIENT, false)).select(s => this.startService(s));
      this.extraServices.forEach(s => this.startService(this.CSpec.create(s)));
    },

    function startService(s) {
      console.log('service: ', s.name);
      this.add('service: ', s.name).br();
      var s = this.client.__subContext__[s.name];
      s.ainit && s.ainit();
    },

    function render() {
      this.add('C3').br();
      this.ainit();
    },

    function pushMenu(menu, opt_forceReload) {
      console.log('pushMenu', menu);
//      menu && menu.launch && menu.launch(this.__subContext__);
    }
  ]
});
