/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'UserGreetingView',
  extends: 'foam.u2.View',

  imports: [
    'auth',
    'ctrl',
    'subject'
  ],

  css: `
    ^ {
      height: 100%;
      width: 100%;
    }
  `,

  messages: [
    { name: 'MORNING_TITLE',   message: 'Good morning' },
    { name: 'AFTERNOON_TITLE', message: 'Good afternoon' },
    { name: 'EVENING_TITLE',   message: 'Good evening' }
  ],

  properties: [
    {
      name: 'title',
      factory: function() {
        let hours = new Date().getHours();
        if ( hours >= 5 && hours < 12 ) {
          return this.MORNING_TITLE;
        }
        if ( hours >= 12 && hours < 17 ) {
          return this.AFTERNOON_TITLE;
        }
        return this.EVENING_TITLE;
      }
    }
  ],

  methods: [
    async function render() {
      this.subject = await ctrl.__subContext__.auth.getCurrentSubject(null);
      this.addClass(this.myClass(), 'h200')
        .start()
          .add(this.slot(function(subject$realUser, title) {
            return title + (this.subject.realUser.firstName ? ', ' + this.subject.realUser.firstName : '') ;
          }))
        .end();
    }
  ]
});
