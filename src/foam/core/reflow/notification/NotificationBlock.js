/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.notification',
  name: 'NotificationBlock',
  extends: 'foam.core.notification.Notification',

  documentation: 'Notification command block for creating and managing system notifications',

  requires: [
    'foam.log.LogLevel'
  ],

  imports: [
    'notificationDAO',
    'localScope', 
    'eval_ as importedEval',
    'out',
    'notify',
    'block'
    ],

  tableColumns: [
    'id',
    'body',
    'notificationType',
    'severity',
    'broadcasted',
    'userId',
    'groupId'
  ],

  searchColumns: [
    'body',
    'notificationType',
    'severity'
  ],

  sections: [
    {
      name: 'content',
      title: 'Notification Content',
      order: 10,
      collapsable: true
    },
    {
      name: 'targeting',
      title: 'Notification Targeting',
      order: 20,
      collapsable: true
    },
    {
      name: 'advanced',
      title: 'Advanced Settings',
      order: 30,
      collapsable: true
    },
    {
      name: 'conditions',
      title: 'Execution Conditions',
      order: 40,
      collapsable: true
    }
  ],

  properties: [
    // Override parent properties with custom views and sections
    {
      name: 'body',
      section: 'content',
      required: true,
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 3,
        placeholder: 'Enter notification message...'
      }
    },
    {
      name: 'toastMessage',
      section: 'content',
      view: {
        class: 'foam.u2.TextField',
        placeholder: 'Enter toast message...'
      }
    },
    {
      name: 'toastSubMessage',
      section: 'content',
      view: {
        class: 'foam.u2.TextField',
        placeholder: 'Enter toast subtitle...'
      }
    },
    {
      name: 'notificationType',
      section: 'content',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [
          'General',
          'Alert',
          'System',
          'Transaction', 
          'Compliance',
          'CollateralControl'
        ]
      }
    },
    {
      name: 'severity',
      section: 'content',
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [
          ['INFO', 'Information'],
          ['WARN', 'Warning'], 
          ['ERROR', 'Error'],
          ['DEBUG', 'Debug']
        ]
      }
    },
    {
      name: 'broadcasted',
      section: 'targeting',
      view: { class: 'foam.u2.CheckBox' }
    },
    {
      name: 'inAppEnabled',
      section: 'targeting',
      view: { class: 'foam.u2.CheckBox' }
    },
    {
      name: 'userId',
      section: 'targeting',
      view: { 
        class: 'foam.u2.view.RichChoiceReferenceView', 
        placeholder: 'Select user...' 
      }
    },
    {
      name: 'groupId',
      section: 'targeting',
      view: { 
        class: 'foam.u2.view.RichChoiceReferenceView', 
        placeholder: 'Select group...' 
      }
    },
    {
      name: 'icon',
      section: 'advanced',
      view: {
        class: 'foam.u2.TextField',
        placeholder: 'notification, warning, error...'
      }
    },
    {
      name: 'template',
      section: 'advanced',
      view: {
        class: 'foam.u2.TextField',
        placeholder: 'Template ID...'
      }
    },
    {
      name: 'emailName',
      section: 'advanced',
      view: { 
        class: 'foam.u2.view.RichChoiceReferenceView', 
        placeholder: 'Select email template...' 
      }
    },
    {
      name: 'expiryDate',
      section: 'advanced'
    },
    // Additional properties
    {
      class: 'String',
      name: 'condition',
      documentation: 'Condition that must be met to create notification (boolean value or expression to evaluate)',
      section: 'conditions',
      reactive: false,
      value: 'true',
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 2,
        placeholder: 'true | false | expression to evaluate...'
      }
    },
    {
      class: 'DateTime',
      name: 'createdAt',
      documentation: 'When this notification block was created',
      visibility: 'RO',
      factory: function() { return new Date(); }
    },
    {
      class: 'String',
      name: 'blockStatus',
      documentation: 'Status of the notification block creation',
      visibility: 'RO',
      value: 'Draft'
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Custom initialization
    },

    async function onLoad() {
      // Initialize any needed data
      return Promise.resolve();
    },

    function evaluateCondition() {
      try {
        if (!this.condition || this.condition.trim() === '') {
          return true; // Default to true if no condition
        }

        var conditionStr = this.condition.trim();
        
        // Check if it's a simple boolean
        if (conditionStr === 'true') return true;
        if (conditionStr === 'false') return false;
        
        // Evaluate as expression with foam.core.reflow.lib and localScope context
        with (foam.core.reflow.lib) {
          with (this.localScope) {
            return eval(conditionStr);
          }
        }
      } catch (e) {
        console.error('Error evaluating condition:', e);
        this.status = 'Condition Error: ' + (e.message || e);
        return false;
      }
    },

    function validateNotification() {
      var errors = [];
      
      if (!this.body || this.body.trim().length === 0) {
        errors.push('Notification body is required');
      }
      
      if (!this.broadcasted && !this.userId && !this.groupId) {
        errors.push('Must specify either a user, group, or broadcast to all');
      }
      
      return errors;
    },

    async function createNotification() {
      try {
        // Check condition first
        if (!this.evaluateCondition()) {
          this.blockStatus = 'Condition not met - notification not created';
          this.notify && this.notify('Condition not met, notification was not created', '', this.LogLevel.INFO, true);
          return;
        }

        // Validate before creating
        var validationErrors = this.validateNotification();
        if (validationErrors.length > 0) {
          this.blockStatus = 'Validation Failed: ' + validationErrors.join(', ');
          this.notify && this.notify('Validation failed: ' + validationErrors.join(', '), '', this.LogLevel.ERROR, true);
          return;
        }

        // Save this notification object to DAO
        await this.notificationDAO.put(this);
        
        this.blockStatus = 'Notification Created Successfully';
        this.notify && this.notify('Notification created successfully', '', this.LogLevel.INFO, true);
        
        return this;
      } catch (e) {
        console.error('Error creating notification:', e);
        this.blockStatus = 'Error: ' + (e.message || e);
        this.notify && this.notify('Failed to create notification: ' + (e.message || e), '', this.LogLevel.ERROR, true);
        throw e;
      }
    }
  ],

  actions: [
    {
      name: 'execute',
      label: 'Create Notification',
      documentation: 'Create and send the notification',
      buttonStyle: 'PRIMARY',
      isEnabled: function(body) {
        return body && body.trim().length > 0;
      },
      code: async function() {
        await this.createNotification();
      }
    },
    {
      name: 'clear',
      label: 'Clear Block',
      documentation: 'Clear notification block fields',
      buttonStyle: 'SECONDARY',
      code: function() {
        // Clear inherited properties
        this.body = '';
        this.toastMessage = '';
        this.toastSubMessage = '';
        this.notificationType = 'General';
        this.severity = this.LogLevel.INFO;
        this.broadcasted = false;
        this.userId = null;
        this.groupId = null;
        this.icon = '';
        this.template = '';
        this.emailName = null;
        // Clear custom properties
        this.condition = 'true';
        this.blockStatus = 'Draft';
      }
    },
    {
      name: 'testCondition',
      label: 'Test Condition',
      documentation: 'Test the execution condition',
      buttonStyle: 'TERTIARY',
      code: function() {
        var result = this.evaluateCondition();
        this.notify && this.notify(
          `Condition "${this.condition}" evaluates to: ${result}`,
          '',
          this.LogLevel.INFO,
          true
        );
      }
    }
  ]
});