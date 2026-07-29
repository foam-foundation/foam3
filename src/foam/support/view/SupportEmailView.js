/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package:'foam.support.view',
  name:'SupportEmailView',
  extends: 'foam.u2.Controller',
  mixins: ['foam.u2.Router'],

  requires: [
    'foam.u2.dialog.Popup',
    'foam.u2.ListCreateController',
    'foam.u2.table.TableView'
  ],

  imports: [
    'createLabel',
    'ctrl',
    'subject'
  ],

  css:`
    ^ {
      padding: 2px;
    }
    ^ .foam-u2-ActionView-create {
      display: none;
    }
    ^ .foam-u2-ActionView-newEmail {
      width: 135px;
      height: 40px;
      border-radius: 2px;
      background-color: #59a5d5;
      margin-top: 30px;
      margin-right: 600px;
      text-align: center;
      color: #ffffff;
      position: relative;
      margin: auto;
      margin-left:
    }
    ^ .btn-mid {
      width: 100%;
      text-align: center;
      margin-top: 20px;
      margin-bottom: 23px;
    }
    ^ .Rectangle-11-Copy {
      width: 1027px;
      border-radius: 2px;
      background-color: $backgroundDefault;
      margin: auto;
    }
    ^ .title {
      width: 100%;
      height: 20px;
      opacity: 0.6;
      text-align: left;
      color: $textDefault;
      padding-left: 10px;
      padding-right: 10px;
      padding-top: 30px;
    }
    ^ .title1 {
      padding: 2px;
      margin: 28px;
    }
    ^ .align {
      margin-left: 10px;
      margin-right: 10px;
      margin-bottom: 30px;
    }
    ^ .input-container-half {
      width: 960px;
      height: 35px;
      border-radius: 2px;
      background-color: $backgroundDefault;
    }
    ^ .No-support-email-con {
      width: 183px;
      height: 16px;
      text-align: left;
      color: $textDefault;
      margin-left: 389px;
      margin-right: 388px
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'viewTitle',
      factory: function() {
        return this.TITLE;
      }
    },
    {
      class: 'Boolean',
      name: 'emptyDAO',
    }
  ],

  messages:[
    { name:'TITLE', message: 'Support Email' },
    { name:'title', message: 'Support Emails Management' },
    { name:'noSupportEmail', message: 'No support email connected' }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.addCrumb();
      this.onDetach(this.stack?.setTitle(this.viewTitle$, this));
    },

    function render(){
      var self = this;
      this.subject.user.supportEmails.limit(1).select().then(function(a){
        self.emptyDAO = a.array.length == 0;
      });

      this
      .addClass(this.myClass())
      .start().addClass('Rectangle-11-Copy')
        .start().addClass('title1')
          .start()
            .add(this.title).addClass('h200', 'lighter', 'title')
          .end()
          .start().addClass('align').end()
          .start({
            class: 'foam.u2.ListCreateController',
            dao: this.subject.user.supportEmails,
            summaryView: this.EmailSupportTableView.create(),
            showActions: false
          }).hide(this.emptyDAO$).end()
          .start().addClass('input-container-half').show(this.emptyDAO$)
            .start()
              .add(this.noSupportEmail).addClass('p-light', 'No-support-email-con')
            .end()
          .end()
          .start().addClass('p', 'btn-mid')
            .start(this.NEW_EMAIL).end()
          .end()
        .end()
      .end();
    }
  ],

  actions: [
    {
      name: 'newEmail',
      label: 'New Email',
      code: function() {
        this.ctrl.add(this.Popup.create().tag({ class: 'foam.support.modal.NewEmailSupportModal' }));
      }
    }
  ],

  classes: [
    {
      name: 'EmailSupportTableView',
      extends: 'foam.u2.View',

      exports: [ 'as data' ],

      imports: [ 'user' ],

      properties: [
        'selection',
        {
          name: 'data',
          factory: function() {
            return this.subject.user.supportEmails;
          }
        }
      ],

      methods: [
        function render() {
          this
            .start({
              class: 'foam.u2.table.TableView',
              selection$: this.selection$,
              data: this.data,
              columns: [
                'email',
                'connectedTime',
                'status'
              ]
            })
            .addClass(this.myClass('table'))
            .end();
        }
      ]
    }
  ]
});
