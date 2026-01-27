/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.google.api.sheets.views.wizardModal',
  name: 'WizardModal',
  extends: 'foam.u2.View',
  documentation: 'A multi-step modal. Perfect for small flows that require multiple steps to complete. Would recommend WizardView for larger flows.',

  requires: [
    'foam.u2.stack.Stack',
    'foam.u2.stack.StackBlock',
    'foam.u2.stack.StackView'
  ],

  exports: [
    'as wizard',
    'subStack',
    'pushToId',
    'viewData',
    'onComplete'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.u2.stack.Stack',
      name: 'subStack',
      factory: function() {
        return this.Stack.create();
      }
    },
    {
      name: 'views',
      postSet: function(_, n) {
        if ( ! this.startAt ) {
          // If no start point has been set, use start point defined in views
          for ( var id in n ) {
            if ( n[id].startPoint ) {
              this.startAt = id;
              break;
            }
          }
        }
        this.pushToId(this.startAt);
      }
    },
    {
      name: 'viewData',
      factory: function() {
        return {};
      }
    },
    {
      class: 'String',
      name: 'startAt',
      documentation: `
        Purpose of 'startAt' is to pass in the ID of the view you wish to start your WizardModal at.
        If you are manipulating data as well, please pass it on into 'viewData', or 'data' depending
        on how you plan on using/developing your WizardModal
      `
    },

    // A method to be called when modal is complete. Dependant on developer to execute
    'onComplete'
  ],

  methods: [
    function render() {
      if ( ! this.views ) {
        console.error('No views to render WizardModal');
        return;
      }
      this.start({ class: 'foam.u2.stack.StackView', data: this.subStack, showActions: false })
        .style({ 'width': 'auto', 'height': 'auto' })
      .end();
    },

    function pushToId(id) {
      // Set the data to be the data exported from the wizard, not the stack.
      this.views[id].data$ = this.data$;

      this.subStack.push(this.StackBlock.create({
        view: this.views[id].view,
        id: id
      }));
    }
  ]
});
