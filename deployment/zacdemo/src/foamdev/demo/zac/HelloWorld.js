/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foamdev.demo.zac',
  name: 'HelloWorld',
  extends: 'foam.u2.Element',

  documentation: 'Simple demonstration ZAC service.',

  requires: [
    'foam.core.menu.VerticalMenu'
  ],

  imports: [
    'auth',
    'subject',
    'ctrl'
  ],


  methods: [
    function init() {
      this.SUPER();

      try {
        if ( foam.core.zac.Client.isInstance(this.ctrl) ) {
          this.ctrl.add(this);
        }
      } catch (x) {}
    },

    function render() {
      this.SUPER();

//      await this.auth.authorizeAnonymous();
   // No need to log in as anon, since it is done automatically
   // var user = await this.auth.login(null, 'anon', '');
   // this.subject.user = this.subject.realUser = user;
      // this.add(this.VerticalMenu.create());
      this.add('Hello World!');
    }
  ]
});
