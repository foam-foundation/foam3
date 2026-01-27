/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
*/
foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'NotificationMenuItem',
  extends: 'foam.u2.View',

  documentation: `Notification bell icon displaying number of unread notifications
      along with redirect to notification view when clicked.`,

  requires: [
    'foam.core.auth.Group',
    'foam.core.menu.Menu',
    'foam.core.notification.Notification'
  ],

  imports: [
    'currentMenu',
    'menuDAO',
    'myNotificationDAO',
    'routeTo',
    'setTimeout',
    'subject'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  css: `
    ^ {
      display: flex;
      align-items: normal;
      position: relative;
    }
    ^bell {
      align-items: center;
      border: 1px solid transparent;
      border-radius: $buttonRadius;
      box-sizing: border-box;
      display: inline-flex;
      gap: 8px;
      justify-content: center;
      margin: 0;
      outline: none;
      text-align: center;
    }
    ^ .dot {
      align-items: center;
      background: $destructive400;
      border-radius: 50%;
      color: $textOnInverse;
      display: flex;
      height: 15px;
      justify-content: center;
      position: absolute;
      right: 0px;
      top: 0px;
      text-align: center;
      width: 15px;
    }
    ^svgIcon {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }
    ^svgIcon svg {
      aspect-ratio: 1;
      width: 1.15em;
      fill: $textTertiary;
    }
  `,

  properties: [
    {
      class: 'Int',
      name: 'countUnread'
    },
    {
      class: 'Boolean',
      name: 'showCountUnread',
      expression: function(countUnread) { return countUnread > 0 }
    },
    {
      class: 'Boolean',
      name: 'showText'
    },
    {
      class: 'String',
      name: 'formattedCount',
      expression: function(countUnread) {
        return countUnread > 9 ? '9+' : countUnread;
      }
    }
  ],

  constants: [
    { name: 'BELL_IMAGE', value: 'images/bell.png' },
    { name: 'MENU_ID',    value: 'notifications' },
    { name: 'INITIAL_DELAY', value: 10000 }
  ],

  messages: [
    { name: 'INVALID_MENU', message: `No menu in menuDAO with id: "notifications"` },
    { name: 'NOTIF', message: 'Notifications' }
  ],

  methods: [
    function render() {
      this.onDetach(this.myNotificationDAO.on.sub(this.onDAOUpdate));
      this.onDetach(this.subject.user$.dot('id').sub(this.onDAOUpdate));

      var self = this;
      this.setTimeout(function() {
        self.onDAOUpdate();
      }, this.INITIAL_DELAY);

      this.addClass()
        .addClass('icon-container')
        .startContext({ data: this })
        .start()
          .start({ class: 'foam.u2.tag.Image', glyph: 'bell', role: 'presentation' })
            .addClass(this.myClass('SVGIcon'))
          .end()
          .callIf(this.showText, function() {
            this.add(self.formattedCount$.map(v => `${self.NOTIF} (${v})`));
          })
          .addClass(this.myClass('bell'))
        .end()
        .endContext()
        .start()
          .addClass('p-xxs', 'dot')
          .add(this.countUnread$.map(v => v > 9 ? '9+' : v ))
          .show(this.slot(function(showCountUnread, showText) { return showCountUnread && ! showText; }))
        .end()
      .end();
    }
  ],

  listeners: [
    {
      name: 'onDAOUpdate',
      isFramed: true,
      code: function() {
        if ( ! this.subject.user ) return;

        this.myNotificationDAO.where(
          this.AND(
            this.EQ(this.Notification.READ, false),
            this.EQ(this.Notification.TRANSIENT, false),
            this.NOT(this.IN(
              this.Notification.NOTIFICATION_TYPE,
              this.subject.user.disabledTopics))
          )
        ).select(this.COUNT()).then((count) => {
          this.countUnread = count.value;
        });
      }
    }
  ],

  actions: [
    {
      name: 'notifications',
      code: function() {
        this.routeTo(this.MENU_ID);
      }
    }
  ]
});
