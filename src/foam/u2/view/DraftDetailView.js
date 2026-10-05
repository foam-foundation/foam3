/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'DraftDetailView',
  extends: 'foam.u2.View',

  topics: [
    'cancelUpdate',
    'dataUpdate'
  ],

  imports: [
    'onCancel?',
    'onSave?'
  ],

  documentation: `
    A detail view that holds off on updating the given object until the user clicks save.
    TODO: Nested property change events. Without this, this view does not know if nested
    properties have changed so modifying a property on an FObjectProperty won't change the
    action's state.
  `,

  css: `
    <<actionBar {
      align-items: center;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      width: 100%;
    }
    <<actionBar > * {
      justify-self: flex-end;
    }
    << {
      display: flex;
      gap: 8px;
      flex-direction: column;
    }
  `,

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'view',
      value: { class: 'foam.u2.DetailView' }
    },
    {
      class: 'FObjectProperty',
      name: 'workingData'
    }
  ],

  actions: [
    {
      name: 'save',
      isEnabled: function(workingData$errors_) {
        return ! workingData$errors_;
      },
      isAvailable: function(controllerMode) {
        return controllerMode != foam.u2.ControllerMode.VIEW;
      },
      code: function() {
        this.data = this.workingData;
        this.onSave && this.onSave(this.data);
      }
    },
    {
      name: 'cancel',
      code: function() {
        this.onCancel && this.onCancel(this.data);
      }
    }
  ],

  reactions: [
    ['', 'propertyChange.data', 'updateWorkingData'],
  ],

  listeners: [
    {
      name: 'updateWorkingData',
      isFramed: true,
      code: function() {
        this.workingData = this.data && this.data.clone();
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.updateWorkingData();
      this
        .addClass(this.myClass())
        .tag(this.view, { data$: this.workingData$ })
        .startContext({ data: this })
          .start()
            .addClass(this.myClass('actionBar'))
            .tag(this.SAVE, { buttonStyle: 'PRIMARY' })
            .tag(this.CANCEL, { buttonStyle: 'TERTIARY' })
          .end()
        .endContext();
    }
  ]
});
