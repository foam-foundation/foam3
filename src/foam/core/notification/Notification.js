/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'Notification',

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.medusa.Clusterable',
    'foam.core.auth.ServiceProviderAware'
  ],

  documentation: 'Notification model responsible for system and integrated messaging notifications.',

  javaImports: [
    'foam.lang.XLocator',
    'foam.dao.DAO',
    'static foam.mlang.MLang.EQ',
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.Subject',
    'foam.core.auth.User'
  ],

  import: [
    'resendNotificationService',
    'notify'
  ],

  requires: [
    'foam.log.LogLevel'
  ],

  tableColumns: [
    'id',
    'body',
    'notificationType',
    'broadcasted',
    'userId.id',
    'groupId.id'
  ],

  sections: [
    {
      name: 'default_',
      order: 1
    },
    {
      name: 'systemInformation',
      help: 'Properties that are used internally by the system.',
      title: 'System Information',
      order: 2,
      permissionRequired: true
    },
  ],

  axioms: [
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Unread',
      predicateFactory: function(e) {
        return e.AND(
          e.EQ(foam.core.notification.Notification.READ, false),
        );
      }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Read',
      predicateFactory: function(e) {
        return e.AND(
          e.EQ(foam.core.notification.Notification.READ, true),
        );
      }
    }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'read',
      documentation: 'Determines if notification has been read.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Long',
      name: 'id',
      createVisibility: 'RW',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'hostname',
      createVisibility: 'HIDDEN',
      updteVisibility: 'RO',
      javaFactory: 'return System.getProperty("hostname", "localhost");'
    },
    {
      class: 'String',
      name: 'template',
      documentation: `This is the 'id' property used to find a template.`,
    },
    {
      class: 'String',
      name: 'notificationType',
      label: 'Notification type',
      documentation: 'Type of notification.',
      value: 'General'
    },
    {
      class: 'DateTime',
      name: 'created',
      documentation: 'Creation date.',
      factory: function() { return new Date(); }
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdBy',
      documentation: 'User that created the Notification.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdByAgent',
      documentation: 'Agent user that created the Notification.',
      readPermissionRequired: true,
      writePermissionRequired: true,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
    },
    {
      class: 'Date',
      name: 'expiryDate',
      documentation: 'Expiration date of notification.',
      factory: function() {
        // 90 days since creation date
        return new Date(Date.now() + (90 * 24 * 60 * 60 * 1000));
      }
    },
    {
      class: 'String',
      name: 'body',
      documentation: 'Notification body'
    },
    {
      class: 'String',
      name: 'toastMessage',
      documentation: 'Toast notification message'
    },
    {
      class: 'String',
      name: 'toastSubMessage',
      documentation: 'Toast notification description'
    },
    {
      class: 'Enum',
      name: 'toastState',
      of: 'foam.core.notification.ToastState',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
    },
    {
      class: 'Enum',
      name: 'severity',
      of: 'foam.log.LogLevel',
      documentation: 'Severity of notification being displayed (eg. INFO, WARNING, ERROR)',
      value: 'INFO'
    },
    {
      class: 'Boolean',
      name: 'transient'
    },
    {
      class: 'String',
      name: 'icon'
    },
    {
      class: 'Boolean',
      name: 'broadcasted',
      documentation: 'Determines if notification is sent to all users in a group or system.'
    },
    {
      class: 'Boolean',
      name: 'inAppEnabled',
      documentation: 'Determines if notification is displayed in the application.',
      value: true
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'userId',
      documentation: 'User notification will be sent to.',
      view: { class: 'foam.u2.view.RichChoiceReferenceView', placeholder: 'select user' }
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.Group',
      name: 'groupId',
      documentation: 'Group notification will be sent to.',
      view: { class: 'foam.u2.view.RichChoiceReferenceView', placeholder: 'select group' },
      menuKeys: ['admin.groups']
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'predicate',
      documentation: 'When set, this predicate is used to filter users the notification is sent to.',
      factory: function() {
        return foam.mlang.predicate.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    },
    {
      class: 'Map',
      name: 'emailArgs',
      visibility: 'HIDDEN',
      documentation: 'Arguments for email template.',
      javaFactory: 'return new java.util.HashMap<String, Object>();'
    },
    {
      class: 'Map',
      name: 'extra',
      documentation: `Arguments for abstract extra properties that can be added to the notification
      and consumed by various notificaition settings.`,
    },
    {
      name: 'emailName',
      class: 'Reference',
      of: 'foam.core.notification.email.EmailTemplate',
      targetDAOKey: 'emailTemplateDAO',
      label: 'Email Template',
      documentation: 'Email template name.',
      menuKeys: [
        'emailtemplates',
        'notification.emailtemplates'
      ]
    },
    {
      class: 'Boolean',
      name: 'clusterable',
      value: true,
      includeInDigest: false
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid',
      includeInDigest: true,
      tableWidth: 120,
      section: 'systemInformation',
      writePermissionRequired: true,
      documentation: `
        Need to override getter to return "" because its trying to
        return null which breaks tests
      `,
      javaGetter: `
        if ( ! spidIsSet_ ) {
          return "";
        }
        return spid_;
      `
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.alarming.Alarm',
      name: 'alarm',
      storageTransient: true,
      visibility: 'HIDDEN'
    }
  ],

  messages: [
    { name: 'SEND_SUCCESS', message: 'Notification successfully resent' },
    { name: 'SEND_FAILED',  message: 'Notification could not be resent' }
  ],

  methods: [
    {
      name: 'checkOwnership',
      args: [
        { name: 'x', type: 'Context' }
      ],
      type: 'Boolean',
      javaCode: `
        User user = ((Subject) x.get("subject")).getRealUser();
        return user != null && getUserId() == user.getId();
      `
    },
    {
      name: 'authorizeOnCreate',
      javaCode: `
      AuthService auth = (AuthService) x.get("auth");
      if ( ! checkOwnership(x) && ! auth.check(x, createPermission("create", true)) && ! getTransient() ) {
        throw new AuthorizationException("You don't have permission to create this notification.");
      }
      `
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: `
      AuthService auth = (AuthService) x.get("auth");
      if ( ! checkOwnership(x) && ! auth.check(x, createPermission("update", false)) && ! getTransient() ) throw new AuthorizationException("You don't have permission to update notifications you do not own.");
      `
    },
    {
      name: 'authorizeOnDelete',
      javaCode: `
      AuthService auth = (AuthService) x.get("auth");
      if ( ! checkOwnership(x) && ! auth.check(x, "*") ) throw new AuthorizationException("You don't have permission to delete notifications you do not own.");
      `
    },
    {
      name: 'authorizeOnRead',
      javaCode: `
      AuthService auth = (AuthService) x.get("auth");
      if ( ! checkOwnership(x) && ! auth.check(x, createPermission("read", false)) ) throw new AuthorizationException("You don't have permission to read notifications you do not own.");
      `
    },
    {
      name: 'createPermission',
      args: [
        { name: 'operation', type: 'String' },
        { name: 'skipId', type: 'Boolean' }
      ],
      type: 'String',
      javaCode: `
        return skipId ? "notification." + operation : "notification." + operation + "." + getId();
      `
    }
  ],

  actions: [
    {
      name: 'resendNotification',
      label: 'Resend Notification',
      availablePermissions:['notification.notify'],
      isAvailable: function() {
        return this.id;
      },
      code: function(X) {
        var self = this;
        X.resendNotificationService.resend(X, this.userId, this).then(function() {
          X.notify(self.SEND_SUCCESS, '', self.LogLevel.INFO, true);
        }).catch(function(e) {
          X.notify(self.SEND_FAILED, '', self.LogLevel.ERROR, true);
        });
      }
    }
  ]
});
