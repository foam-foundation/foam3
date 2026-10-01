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
    'subject'
  ],

  css: `
    ^ {
      height: 100%;
      width: 100%;
    }
  `,

  messages: [
    {
      name: 'MORNING_TITLE',
      messageMap: {
        en: 'Good morning',
        fr: 'Bonjour'
      }
    },
    {
      name: 'AFTERNOON_TITLE',
      messageMap: {
        en: 'Good afternoon',
        fr: 'Bonjour'
      }
    },
    {
      name: 'EVENING_TITLE',
      messageMap: {
        en: 'Good evening',
        fr: 'Bonsoir'
      }
    },
    {
      name: 'GREETING_WITH_FIRST_NAME',
      messageMap: {
        en: '${title}, ${firstName}',
        fr: '${title}, ${firstName}'
      },
      template: true
    }
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
      this.auth.getCurrentSubject(null).then(v => {
        this.subject = v;
      });
      this.addClass(this.myClass(), 'h200')
        .start()
          .add(this.slot(function(subject$realUser, title) {
            var firstName = this.subject.realUser.firstName;
            return firstName ? this.GREETING_WITH_FIRST_NAME({ title: title, firstName: firstName }) : title;
          }))
        .end();
    }
  ]
});
