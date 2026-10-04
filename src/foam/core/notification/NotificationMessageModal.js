/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationMessageModal',
  extends: 'foam.u2.View',

  documentation: 'View for displaying notification message',

  axioms: [
    foam.pattern.Faceted.create()
  ],

  css: `
    << {
      max-width: 60vw;
      max-height: 80vh;
      min-width: 30vw;
      overflow: auto;
    }
    <<message {
      white-space: pre-line;
    }
    <<container {
      width: 100%;
    }
    << > <<container + <<container {
      margin-top: 16px;
    }
  `,

  requires: [
    'foam.u2.layout.Rows',
    'foam.u2.layout.Grid',
    'foam.u2.ModalHeader'
  ],

  messages: [
    { name: 'CREATED_MSG', message: 'Created' },
    { name: 'MESSAGE_MSG', message: 'Message' }
  ],

  properties: [
    'data',
    {
      name: 'created',
      expression: function(data$created) {
        return data$created.toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' });
      }
    },
    {
      name: 'description',
      expression: function(data$body, data$toastMessage, data$toastSubMessage) {
        return data$body ||
          ( data$toastMessage +
            ( data$toastSubMessage ? "<br>"+data$toastSubMessage : "" ) );
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();

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
