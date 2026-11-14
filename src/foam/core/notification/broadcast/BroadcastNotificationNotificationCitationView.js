/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.notification.broadcast',
  name: 'BroadcastNotificationNotificationCitationView',
  extends: 'foam.core.notification.NotificationCitationView',

  methods: [
    function render() {
      this
      .addClass(this.myClass())
      .start().addClass(this.myClass('created'))
        .add(this.created$)
      .end()
      .start().addClass('p', this.myClass('description'))
        .add(this.description$)
      .end();
    }
  ]
});


foam.CLASS({
  package: 'foam.core.notification.broadcast',
  name: 'BroadcastNotificationNotificationMessageModal',
  extends: 'foam.core.notification.NotificationMessageModal',

  methods: [
    function render() {
      this
      .addClass(this.myClass())
      .start(this.Rows)
        .addClass(this.myClass('container'))
        .start().addClass('p-bold').add(this.CREATED_MSG).end()
        .start().add(this.created$).end()
      .end()
      .start(this.Rows)
        .addClass(this.myClass('container'))
        .start().addClass('p-bold').add(this.MESSAGE_MSG).end()
        .start().addClass(this.myClass('message')).add(this.description$).end()
      .end();
    }
  ]
});
