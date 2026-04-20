/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'User',
  plural: 'Users',

  implements: [
    'foam.mlang.Expressions',
    'foam.core.auth.Authorizable',
    'foam.core.auth.CreatedAware',
    'foam.core.auth.EnabledAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.ServiceProviderAware',
    'foam.core.auth.LifecycleAware'
  ],

  requires: [
    'foam.core.auth.Address',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.PriorPassword',
    'foam.core.auth.UserLifecycleTicket',
    'foam.core.ticket.Ticket'
  ],

  imports: [
    'auth?',
    'notify?',
    'resetPasswordToken',
    'routeTo?',
    'ticketDAO?'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.dao.ArraySink',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'foam.core.auth.Group',
    'foam.core.auth.LifecycleAware',
    'foam.core.auth.LifecycleState',
    'foam.core.notification.NotificationSetting',
    'foam.core.session.Session',
    'foam.core.theme.Theme',
    'foam.util.SafetyUtil',
    'java.util.Arrays',
    'java.util.HashMap',
    'java.util.HashSet',
    'java.util.List',
    'foam.core.logger.Loggers',
    'java.util.regex.Pattern'
  ],

  documentation: `The User represents a person or entity with the ability
    to use a username and password to log into and use the system as well
    as act on behalf of a business, if permissions are granted. It holds
    personal information and permits certain actions.  In this documentation,
    the term 'real user' refers exclusively to an individual person.
  `,

  tableColumns: [
    'id',
    'type',
    'lifecycleState',
    'userName',
    'group.id',
    'email'
  ],

  searchColumns: [
    'id',
    'type',
    'spid',
    'group',
    'lifecycleState',
    'userName',
    'firstName',
    'preferredName',
    'lastName',
    'email'
  ],

  constants: [
    {
      name: 'SYSTEM_USER_ID',
      value: 1,
      type: 'Long'
    },
    {
      name: 'NAME_MATCHER',
      type: 'Regex',
      javaValue: `Pattern.compile("^[\\\\p{L}\\\\s-.']+$", Pattern.UNICODE_CASE)`
    },
    {
      name: 'USER_NAME_MATCHER',
      type: 'Regex',
      value: /^[\w-]*$/,
      javaValue: `Pattern.compile("^[\\\\w-+@.]*$")`
    }
  ],

  messages: [
    { name: 'USERNAME_REQUIRED',    message: 'Username required' },
    { name: 'INVALID_FIRST_NAME',   message: 'Invalid characters in first name: ' },
    { name: 'INVALID_MIDDLE_NAME',  message: 'Invalid characters in middle name: ' },
    { name: 'INVALID_LAST_NAME',    message: 'Invalid characters in last name: ' },
    { name: 'INVALID_MATCHER',      message: "[^\\p{Letter}\\s\\-.']" },
    { name: 'INVALID_USERNAME',     message: "Username can only contain alphanumeric characters, '-', and '_'" },
    { name: 'RESET_PASSWORD_SENT',  message: "Password reset request sent." },
    { name: 'RESET_PASSWORD_FAILED',message: "Issue resetting your password. Please try again." },
  ],

  sections: [
    {
      name: 'userInformation',
      title: 'User Information',
      order: 1
    },
    {
      name: 'businessInformation',
      title: 'Business Information',
      order: 2,
      permissionRequired: true
    },
    {
      name: 'ownerInformation',
      title: 'Ownership',
      permissionRequired: true
    },
    {
      name: 'operationsInformation',
      title: 'Operations',
      permissionRequired: true
    },
    {
      name: 'complianceInformation',
      title: 'Compliance',
      permissionRequired: true
    },
    {
      name: 'accountInformation',
      title: 'Accounts',
      permissionRequired: true
    },
    {
      name: 'contactInformation',
      title: 'Contacts',
      permissionRequired: true
    },
    {
      name: 'systemInformation',
      help: 'Properties that are used internally by the system.',
      title: 'System Information',
      permissionRequired: true
    },
    {
      name: 'deprecatedInformation',
      title: 'Deprecated',
      permissionRequired: true
    }
  ],

  // TODO: The following properties don't have to be defined here anymore once
  // https://github.com/foam-framework/foam2/issues/1529 is fixed:
  //   1. enabled
  //   2. created
  //   3. firstName
  //   4. middleName
  //   5. lastName
  //   6. legalName
  //   7. lastModified
  properties: [
    {
      class: 'Long',
      name: 'id',
      documentation: 'The ID for the User.',
      tableWidth: 100,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      section: 'userInformation',
      order: 10,
      gridColumns: 6,
      includeInDigest: true,
      sheetsOutput: true
    },
    {
      class: 'String',
      name: 'userName',
      label: 'Username',
      includeInDigest: true,
      containsPII: false,
      documentation: 'The username of the User.',
      section: 'userInformation',
      validationPredicates: [
        {
          query: 'type!="User"||userName!=""',
          errorMessage: 'USERNAME_REQUIRED'
        }
      ],
      order: 20,
      gridColumns: 6,
      columnPermissionRequired: true,
      trim: true
    },
    {
      class: 'Boolean',
      name: 'loginEnabled',
      documentation: `Determines whether the User can login to the platform.
      A user that tries to login with this false -- gets account disabled error msg.`,
      writePermissionRequired: true,
      includeInDigest: false,
      value: true,
      section: 'userInformation',
      order: 30,
      gridColumns: 6
    },
    {
      class: 'DateTime',
      name: 'lastLogin',
      includeInDigest: false,
      documentation: 'The date and time of last login by User.',
      section: 'userInformation',
      order: 40,
      gridColumns: 6,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      columnPermissionRequired: true
    },
    {
      class: 'DateTime',
      name: 'passwordExpiry',
      includeInDigest: false,
      documentation: `The date and time that the current password of the User
        will expire.`,
      section: 'userInformation',
      order: 50,
      gridColumns: 6
    },
    {
      class: 'DateTime',
      name: 'passwordLastModified',
      includeInDigest: false,
      documentation: 'The date and time that the password was last modified.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      section: 'userInformation',
      order: 60,
      gridColumns: 6
    },
    {
      class: 'String',
      name: 'firstName',
      shortName: 'fn',
      documentation: 'The first name of the User.',
      section: 'userInformation',
      order: 70,
      gridColumns: { columns: 4, smColumns: 12, xsColumns: 12 },
      includeInDigest: true,
      containsPII: true,
      trim: true,
      tableWidth: 160,
      validateObj: function(firstName) {
        var invalidMatcher = new RegExp(foam.core.auth.User.INVALID_MATCHER, 'ug');
        var invalidMatch = firstName.match(invalidMatcher);
        if ( invalidMatch ) {
          var invalidChars = [...new Set(invalidMatch.join(''))].join(', ');
          return foam.core.auth.User.INVALID_FIRST_NAME + invalidChars;
        }
      },
      javaValidateObj: `
        foam.core.app.AppConfig appConfig = (foam.core.app.AppConfig) x.get("appConfig");
        String name = (String) obj.getProperty("firstName");
        if ( name.length() == 0 || appConfig.getMode() == foam.core.app.Mode.TEST ) return;

        if ( ! foam.core.auth.User.NAME_MATCHER.matcher(name).matches() )
          throw new IllegalStateException(foam.core.auth.User.INVALID_FIRST_NAME + name);
      `
    },
    {
      class: 'String',
      name: 'preferredName',
      shortName: 'pn',
      documentation: 'An alternative first name: informal, nickname, call-me name',
      section: 'userInformation',
      order: 70,
      gridColumns: { columns: 4, smColumns: 12, xsColumns: 12 },
      includeInDigest: false,
      containsPII: true,
      trim: true,
      tableWidth: 160,
    },
    {
      class: 'String',
      name: 'middleName',
      documentation: 'The middle name of the User.',
      section: 'userInformation',
      order: 80,
      gridColumns: { columns: 4, smColumns: 12, xsColumns: 12 },
      includeInDigest: true,
      containsPII: true,
      columnPermissionRequired: true,
      trim: true,
      validateObj: function(middleName) {
        if ( ! middleName.trim() ) return;

        var invalidMatcher = new RegExp(foam.core.auth.User.INVALID_MATCHER, 'ug');
        var invalidMatch = middleName.match(invalidMatcher);
        if ( invalidMatch ) {
          var invalidChars = [...new Set(invalidMatch.join(''))].join(', ');
          return foam.core.auth.User.INVALID_MIDDLE_NAME + invalidChars;
        }
      },
      javaValidateObj: `
        foam.core.app.AppConfig appConfig = (foam.core.app.AppConfig) x.get("appConfig");
        String name = (String) obj.getProperty("middleName");
        if ( name.length() == 0 || appConfig.getMode() == foam.core.app.Mode.TEST ) return;

        if ( ! foam.core.auth.User.NAME_MATCHER.matcher(name).matches() )
          throw new IllegalStateException(foam.core.auth.User.INVALID_MIDDLE_NAME + name);
      `
    },
    {
      class: 'String',
      name: 'lastName',
      shortName: 'ln',
      documentation: 'The last name of the User.',
      section: 'userInformation',
      order: 90,
      gridColumns: { columns: 4, smColumns: 12, xsColumns: 12 },
      includeInDigest: true,
      containsPII: true,
      trim: true,
      tableWidth: 160,
      validateObj: function(lastName) {
        var invalidMatcher = new RegExp(foam.core.auth.User.INVALID_MATCHER, 'ug');
        var invalidMatch = lastName.match(invalidMatcher);
        if ( invalidMatch ) {
          var invalidChars = [...new Set(invalidMatch.join(''))].join(', ');
          return foam.core.auth.User.INVALID_LAST_NAME + invalidChars;
        }
      },
      javaValidateObj: `
        foam.core.app.AppConfig appConfig = (foam.core.app.AppConfig) x.get("appConfig");
        String name = (String) obj.getProperty("lastName");
        if ( name.length() == 0 || appConfig.getMode() == foam.core.app.Mode.TEST ) return;

        if ( ! foam.core.auth.User.NAME_MATCHER.matcher(name).matches() )
          throw new IllegalStateException(foam.core.auth.User.INVALID_LAST_NAME + name);
      `
    },
    {
      class: 'String',
      name: 'legalName',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      section: 'userInformation',
      order: 100,
      gridColumns: 6,
      includeInDigest: false,
      containsPII: false,
      columnPermissionRequired: true,
      trim: true,
      transient: true,
      expression: function(firstName, middleName, lastName, businessName) {
        if ( ! firstName && ! lastName ) return businessName;
        return [firstName, middleName, lastName].filter(name => name).join(' ');
      },
      javaGetter: `
        String firstName = getFirstName();
        String middleName = getMiddleName();
        String lastName = getLastName();

        // Many table columns use user.legalName which is empty for businesses.
        if ( SafetyUtil.isEmpty(firstName) &&
             SafetyUtil.isEmpty(lastName) &&
             ! SafetyUtil.isEmpty(getBusinessName()) ) {
          return getBusinessName();
        }

        StringBuilder sb = new StringBuilder();

        if ( ! SafetyUtil.isEmpty(firstName) ) sb.append(firstName);
        if ( ! SafetyUtil.isEmpty(middleName) ) {
          if ( sb.length() > 0 ) sb.append(' ');
          sb.append(middleName);
        }
        if ( ! SafetyUtil.isEmpty(lastName) ) {
          if( sb.length() > 0 ) sb.append(' ');
          sb.append(lastName);
        }

        return sb.toString();
      `
    },
    {
      class: 'Date',
      name: 'birthday',
      includeInDigest: false,
      containsPII: true,
      documentation: 'The date of birth of the individual person, or real user.',
      section: 'userInformation',
      order: 120,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'Reference',
      name: 'language',
      includeInDigest: false,
      containsPII: false,
      documentation: 'The default language preferred by the User.',
      of: 'foam.core.auth.Language',
      createVisibility: 'HIDDEN',
      section: 'userInformation',
      order: 130,
      gridColumns: 6,
      factory: function() {
        return foam.core.auth.LanguageId.create({code: 'en'});
      },
      javaFactory: `
        return new foam.core.auth.LanguageId.Builder(null).setCode("en").build();
      `,
      columnPermissionRequired: true
    },
    {
      class: 'String',
      name: 'timeZone',
      includeInDigest: false,
      documentation: 'The preferred time zone of the User.',
      width: 5,
      createVisibility: 'HIDDEN',
      section: 'userInformation',
      order: 140,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'EMail',
      name: 'email',
      label: {
        'en' :'Email Address',
        'fr' :'Adresse Email'
      },
      includeInDigest: true,
      containsPII: true,
      documentation: 'The email address of the User.',
      displayWidth: 80,
      width: 100,
      javaSetter:
      `email_ = val.toLowerCase();
       emailIsSet_ = true;`,
      section: 'userInformation',
      order: 150,
      gridColumns: 6
    },
    {
      class: 'Boolean',
      name: 'emailVerified',
      includeInDigest: false,
      documentation: 'Determines whether the email address of the User is valid.',
      section: 'userInformation',
      order: 160,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'Website',
      name: 'website',
      includeInDigest: false,
      documentation: 'A URL link to the website of the User.',
      displayWidth: 80,
      width: 2048,
      createVisibility: 'HIDDEN',
      section: 'userInformation',
      order: 170,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.auth.Address',
      name: 'address',
      documentation: 'Returns the postal address from the Address model.',
      includeInDigest: false,
      containsPII: true,
      factory: function() {
        return this.Address.create();
      },
      section: 'userInformation',
      order: 180
    },
    {
      class: 'PhoneNumber',
      name: 'phoneNumber',
      includeInDigest: false,
      containsPII: true,
      documentation: 'Personal phone number.',
      section: 'userInformation',
      order: 190,
      gridColumns: 6,
      javaPreSet: `
        if ( !foam.util.SafetyUtil.isEmpty(val) ) {
          val = val.replaceAll(" ", "");
          val = val.replaceAll("[()]", "");
        }
      `
    },
    {
      class: 'Boolean',
      name: 'phoneNumberVerified',
      includeInDigest: false,
      writePermissionRequired: true,
      section: 'userInformation',
      order: 200,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'PhoneNumber',
      name: 'mobileNumber',
      includeInDigest: false,
      documentation: 'Returns the mobile phone number of the User from the Phone model.',
      createVisibility: 'HIDDEN',
      section: 'userInformation',
      order: 210,
      gridColumns: 6,
      javaPreSet: `
        if ( !foam.util.SafetyUtil.isEmpty(val) ) {
          val = val.replaceAll(" ", "");
          val = val.replaceAll("[-()]", "");
        }
      `,
      columnPermissionRequired: true
    },
    {
      class: 'Boolean',
      name: 'mobileNumberVerified',
      includeInDigest: false,
      writePermissionRequired: true,
      section: 'userInformation',
      order: 220,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'foam.core.fs.FileProperty',
      name: 'profilePicture',
      includeInDigest: false,
      containsPII: true,
      documentation: `The profile picture of the individual user, initially
        defaulting to a placeholder picture.`,
      view: {
        class: 'foam.core.auth.ProfilePictureView',
        placeholderImage: '/images/ic-placeholder.png'
      },
      section: 'userInformation',
      order: 230,
      gridColumns: 6
    },
    {
      class: 'String',
      name: 'note',
      documentation: 'A field for a note that can be added and appended to the User.',
      displayWidth: 70,
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 100 },
      section: 'userInformation',
      order: 240,
      columnPermissionRequired: true
    },
    {
      class: 'DateTime',
      name: 'created',
      includeInDigest: true,
      documentation: 'The date and time of when the User was created in the system.',
      readPermissionRequired: true,
      order: 250
    },
    {
      class: 'DateTime',
      name: 'lastModified',
      includeInDigest: true,
      documentation: 'The date and time the User was last modified.',
      readPermissionRequired: true,
      order: 260
    },
    {
      class: 'String',
      name: 'organization',
      includeInDigest: false,
      containsPII: false,
      documentation: 'The organization/business associated with the User.',
      displayWidth: 80,
      width: 100,
      tableWidth: 160,
      section: 'businessInformation',
      order: 10,
      gridColumns: 6
    },
    {
      class: 'String',
      name: 'businessName',
      includeInDigest: false,
      documentation: 'The name of the business associated with the User.',
      width: 50,
      section: 'businessInformation',
      order: 15,
      gridColumns: 6,
      tableWidth: 170,
      columnPermissionRequired: true
    },
    {
      class: 'String',
      name: 'department',
      includeInDigest: false,
      containsPII: false,
      documentation: `The department associated with the organization/business
        of the User.`,
      width: 50,
      createVisibility: 'HIDDEN',
      section: 'businessInformation',
      order: 20,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'String',
      name: 'jobTitle',
      includeInDigest: false,
      containsPII: false,
      documentation: 'The job title of the individual person, or real user.',
      section: 'businessInformation',
      order: 30,
      gridColumns: 6,
      tableCellFormatter: function(val) {
        this.translate(`${val}.label`, val);
      }
    },
    {
      class: 'StringArray',
      name: 'disabledTopics',
      includeInDigest: false,
      documentation: 'Disables types for notifications.',
      createVisibility: 'HIDDEN',
      section: 'operationsInformation',
      order: 80,
      gridColumns: 6,
      javaPostSet: `
        clearDisabledTopicSet();
      `,
      columnPermissionRequired: true
    },
    {
      class: 'foam.lang.Enum',
      of: 'foam.core.auth.LifecycleState',
      name: 'lifecycleState',
      includeInDigest: true,
      section: 'systemInformation',
      order: 40,
      gridColumns: 6,
      value: foam.core.auth.LifecycleState.ACTIVE,
      writePermissionRequired: false,
      documentation: 'Recommend using state change actions'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid',
      includeInDigest: true,
      tableWidth: 120,
      section: 'systemInformation',
      order: 50,
      gridColumns: 6,
      writePermissionRequired:true,
      tableCellFormatter: {class: 'foam.u2.view.ReferenceToSummaryCellFormatter' },
      documentation: `
        Need to override getter to return "" because its trying to
        return null (probably as a result of moving order of files
        in core), which breaks tests
      `,
      javaGetter: `
        if ( ! spidIsSet_ ) {
          return "";
        }
        return spid_;
      `,
      columnPermissionRequired: true
    },
    {
      // deprecated; use lifecycleState instead
      class: 'Boolean',
      name: 'enabled',
      documentation: 'Determines whether the User is permitted certain actions.',
      hidden: true,
      transient: true,
      javaGetter: `
        return getLifecycleState() == foam.core.auth.LifecycleState.ACTIVE;
      `
    },
    {
      class: 'String',
      name: 'type',
      visibility: 'RO',
      storageTransient: true,
      documentation: 'The type of the User.',
      tableWidth: 75,
      getter: function() {
        return this.cls_.name;
      },
      javaGetter: `
        return getClass().getSimpleName();
      `,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      section: 'systemInformation',
      order: 100,
      gridColumns: 6
    },
    {
      class: 'Password',
      name: 'desiredPassword',
      label: 'Password',
      documentation: `The password that the individual person, or real user,
        chooses to be used as a password but may or may not pass as valid.`,
      displayWidth: 30,
      width: 100,
      storageTransient: true,
      createVisibility: 'RW',
      updateVisibility: 'RW',
      readVisibility: 'HIDDEN',
      section: 'systemInformation',
      order: 110,
      gridColumns: 6,
      columnPermissionRequired: true
    },
    {
      class: 'Password',
      name: 'password',
      includeInDigest: true,
      documentation: 'The password that is currently active with the User.',
      hidden: true,
      networkTransient: true,
      columnPermissionRequired: true
    },
    {
      class: 'Password',
      name: 'previousPassword',
      includeInDigest: false,
      documentation: 'The password that was previously active with the User.',
      hidden: true,
      networkTransient: true,
      section: 'systemInformation',
      order: 120
    },
    {
      name: 'passwordHistory',
      class: 'FObjectArray',
      of: 'foam.core.auth.PriorPassword',
      includeInDigest: false,
      javaFactory: `
        foam.core.auth.PriorPassword[] priorPasswords = new foam.core.auth.PriorPassword[1];
        priorPasswords[0] = new foam.core.auth.PriorPassword();
        priorPasswords[0].setPassword(this.getPassword());
        priorPasswords[0].setTimeStamp(new java.util.Date());
        return priorPasswords;
      `,
      hidden: true,
      networkTransient: true,
      createVisibility: 'HIDDEN',
      section: 'systemInformation',
      order: 130,
      updateVisibility: 'RO',
      javaCompare: 'return 0;'
    },
    {
      class: 'Object',
      /** @private */
      name: 'disabledTopicSet',
      javaType: 'java.util.HashSet',
      hidden: true,
      transient: true,
      factory: function() { return {}; },
      javaFactory: `
        HashSet<String> set = new HashSet<>();
        for ( String s : getDisabledTopics() ) {
          set.add(s);
        }
        return set;
      `
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.userfeedback.UserFeedback',
      name: 'userFeedback',
      storageTransient: true,
      visibility: 'HIDDEN',
      externalTransient: true,
      columnPermissionRequired: true
    },
    {
      class: 'String',
      name: 'trackingId',
      columnPermissionRequired: true,
      documentation: 'Unique id optionally used to track a user.'
    },
    {
      class: 'String',
      name: 'ticketMenu',
      documentation: 'Menu id for UserLifecycleTicket creation. Meant to be refined by applications',
      value: 'admin.tickets',
      hidden: true,
      transient: true
    }
  ],

  methods: [
    {
      name: 'toSummary',
      type: 'String',
      code: function toSummary() {
        if ( this.preferredName ) return this.firstName + ' (' + this.preferredName + ') ' + this.lastName;
        if ( this.legalName ) return this.legalName;
        return this.userName;
      },
      javaCode: `
        if ( ! SafetyUtil.isEmpty(this.getPreferredName()) )
          return this.getFirstName() + " (" + this.getPreferredName() + ") " + this.getLastName();
        if ( ! SafetyUtil.isEmpty(this.getLegalName()) ) return this.getLegalName();
        return this.getUserName();
      `
    },
    {
      name: 'authorizeOnCreate',
      args: [
        { name: 'x', type: 'Context' }
      ],
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");

        // Prevent privilege escalation by only allowing a user's group to be
        // set to one that the user doing the put has permission to update.
        if ( ! auth.check(x, "group.update." + this.getGroup()) ) {
          throw new AuthorizationException("You do not have permission to set that user's group to '" + this.getGroup() + "'.");
        }
      `
    },
    {
      name: 'authorizeOnRead',
      args: [
        { name: 'x', type: 'Context' }
      ],
      javaThrows: ['AuthorizationException'],
      javaCode: `
        Subject subject = (Subject) x.get("subject");
        User user = subject.getUser();
        User agent = subject.getRealUser();
        AuthService auth = (AuthService) x.get("auth");
        boolean findSelf =
          ( user != null &&
            SafetyUtil.equals(this.getId(), user.getId()) ) ||
          ( agent != null &&
            SafetyUtil.equals(agent.getId(), this.getId()) );

        if ( ! findSelf &&
             ! auth.check(x, "user.read." + this.getId()) &&
             ! auth.check(x, "user.readByGroup." + this.getGroup())
        ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      args: 'Context x, foam.lang.FObject oldObj',
      javaThrows: [ 'AuthorizationException' ],
      javaCode: `
        Subject     subject      = (Subject)     x.get("subject");
        AuthService auth         = (AuthService) x.get("auth");
        User        oldUser      = (User)        oldObj;
        User        user         = subject.getUser();
        User        agent        = subject.getRealUser();

        if ( auth.isAnonymous(x) ) {
          throw new AuthorizationException("You do not have permission to update this user.");
        }

        boolean     updatingSelf =
          ( user  != null && SafetyUtil.equals(this.getId(), user.getId()) ) ||
          ( agent != null && SafetyUtil.equals(this.getId(), agent.getId()) );

        if ( ! updatingSelf && ! auth.check(x, "user.update." + this.getId()) ) {
          throw new AuthorizationException("You do not have permission to update this user.");
        }

        // Prevent privilege escalation by only allowing a user's group to be
        // changed under appropriate conditions.
        if ( ! SafetyUtil.equals(oldUser.getGroup(), this.getGroup()) ) {
          if ( updatingSelf ) {
            throw new AuthorizationException("You cannot change your own group.");
          }
          if ( ! auth.check(x, "user.update." + this.getId()) ) {
            throw new AuthorizationException("You do not have permission to change that user's group.");
          }
          if ( ! auth.check(x, "group.update." + oldUser.getGroup()) || ! auth.check(x, "group.update." + this.getGroup()) ) {
            throw new AuthorizationException("You do not have permission to change that user's group to '" + this.getGroup() + "'.");
          }
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      args: 'Context x',
      javaThrows: [ 'AuthorizationException' ],
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        AuthService auth = (AuthService) x.get("auth");

        if (
          user == null ||
          ! SafetyUtil.equals(this.getId(), user.getId()) &&
          ! auth.check(x, "user.remove." + this.getId())
        ) {
          throw new RuntimeException("You do not have permission to delete that user.");
        }
      `
    },
    {
      name: 'doNotify',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'notification', type: 'foam.core.notification.Notification' }
      ],
      javaCode: `
        HashMap<String, NotificationSetting> settingsMap = new HashMap<String, NotificationSetting>();

        settingsMap = getImpliedNotificationSettings(x);
        for ( NotificationSetting setting : settingsMap.values() ) {
          setting.doNotify(x, this, notification);
        }
      `
    },
    {
      name: 'getImpliedNotificationSettings',
      args: 'Context x',
      type: 'java.util.HashMap',
      code: async function(x, filterDisabled = true) {
        // filterDisabled used by NotificationSettingView to show
        // user their settings.

        x = x || this.__subContext__;
        let map = {};
        // System defaults
        (await x.notificationSettingDefaultsDAO.where(
          this.AND(
            this.EQ(foam.core.notification.NotificationSetting.SPID, '*'),
            this.EQ(foam.core.notification.NotificationSetting.ENABLED, true)
          ))
         .select())?.array?.map(a => {
           map[a.model_.label] = a;
        });

        // Spid defaults
        (await x.notificationSettingDefaultsDAO
         .where(this.EQ(foam.core.notification.NotificationSetting.SPID, x.theme.spid))
         .select())?.array?.map(a => {
           if ( ! a.enabled &&
                filterDisabled ) {
             delete map[a.model_.label];
           } else {
             map[a.model_.label] = a;
           }
         });

        // Wipe ids and spids for any defaults
        Object.keys(map).forEach(key => {
          map[key].id = undefined;
          map[key].spid = undefined;
        });

        // User Preference
        (await this.notificationSettings
         .select())?.array?.map(a => {
           if ( ! a.enabled &&
                filterDisabled ) {
             delete map[a.model_.label];
           } else {
             map[a.model_.label] = a;
           }
        });
        return map;
      },
      javaCode: `
        HashMap<String, NotificationSetting> settingsMap = new HashMap<String, NotificationSetting>();

        // Defaults for system
        List<NotificationSetting> settingDefaults = ((ArraySink) ((DAO) x.get("notificationSettingDefaultsDAO")).inX(x)
          .where(
            AND(
              EQ(foam.core.notification.NotificationSetting.SPID, "*"),
              EQ(foam.core.notification.NotificationSetting.ENABLED, true)
            ))
          .select(new ArraySink()))
          .getArray();
        for ( NotificationSetting setting : settingDefaults ) {
          settingsMap.put(setting.getClassInfo().getId(), setting);
        }

        // Spid defaults
        if ( ! SafetyUtil.isEmpty(getSpid()) ) {
          StringBuilder spid = new StringBuilder();
          for ( String s : getSpid().split("\\\\.") ) {
            if ( spid.length() > 0 ) spid.append('.');
            spid.append(s);

            settingDefaults = ((ArraySink) ((DAO) x.get("notificationSettingDefaultsDAO")).inX(x)
              .where(EQ(foam.core.notification.NotificationSetting.SPID, spid.toString()))
              .select(new ArraySink()))
              .getArray();
            for ( NotificationSetting setting : settingDefaults ) {
              if ( setting.getEnabled() || setting.getClass() == NotificationSetting.class ) {
                settingsMap.put(setting.getClassInfo().getId(), setting);
              } else {
                // use disabled to opt-out
                settingsMap.remove(setting.getClassInfo().getId());
              }
            }
          }
        }

        // User explicit settings
        List<NotificationSetting> settings = ((ArraySink) getNotificationSettings(x)
          .select(new ArraySink())).getArray();
        for ( NotificationSetting setting : settings ) {
          if ( setting.getEnabled() || setting.getClass() == NotificationSetting.class ) {
            settingsMap.put(setting.getClassInfo().getId(), setting);
          } else {
            // use disabled to opt-out
            settingsMap.remove(setting.getClassInfo().getId());
          }
        }

        return settingsMap;
      `
    },
    {
      name: 'validateAuth',
      documentation: `Check that the user can be signed in`,
      args: [
        { name: 'x', type: 'Context' }
      ],
      javaCode: `
        // check if user enabled
        if ( getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) {
          throw new AuthenticationException("User disabled");
        }

        boolean anonymous = ((AuthService)x.get("auth")).isUserAnonymous(x, getId());

        // check if user login enabled
        if ( ! getLoginEnabled() &&
             ! anonymous ) {
          throw new AccessDeniedException();
        }

        Group group = null;
        try {
          group = (Group) ((DAO) foam.lang.XLocator.get().get("groupDAO")).find(getGroup());
        } catch (Throwable e) {
          foam.core.logger.StdoutLogger.instance().error(e);
          throw new AuthenticationException("Group not found");
        }
        if ( group != null &&
             ! anonymous &&
             group.getEmailRequired() && ! getEmailVerified() ) {
          throw new UnverifiedEmailException();
        }
      `
    }
  ],

  actions: [
    {
      name: 'deleteUser',
      label: 'Delete',
      toolTip:'Open ticket to delete a user and all associated entities',
      availablePermissions: ['user.action.delete'],
      isAvailable: async function(id, type, spid, lifecycleState) {
        // NOTE: testing spid as hack so action only available from detail view
        return id && type == 'User' && spid &&
          lifecycleState != this.LifecycleState.DELETED;
      },
      code: function(X) {
        var self = this;
        var ticket = this.ticketDAO.find(
          this.AND(
            this.EQ(this.Ticket.TYPE, this.UserLifecycleTicket.name),
            this.EQ(this.Ticket.CREATED_FOR, this.id),
            this.EQ(this.Ticket.SPID, this.spid),
            this.OR(
              this.EQ(this.UserLifecycleTicket.REQUESTED_LIFECYCLE_STATE, this.LifecycleState.DELETED),
              this.EQ(this.UserLifecycleTicket.REQUESTED_LIFECYCLE_STATE, this.LifecycleState.DISABLED)
            )
          )
        ).then(t => {
          if ( t ) {
            if ( t.status == "CLOSED" ) {
              t.comment = "Re-open. "+t.title;
              t.status = "OPEN";
            }
            t.requestedLifecycleState = this.LifecycleState.DELETED;
            self.ticketDAO.put(t).then(function(t) {
              self?.routeTo(self.ticketMenu+"/"+t.id + "?mode=EDIT");
            });
          } else {
            var ticket = self.UserLifecycleTicket.create({
              title: 'Delete user',
              createdFor: self.id,
              spid: self.spid,
              requestedLifecycleState: self.LifecycleState.DELETED
            });
            self.ticketDAO.put(ticket).then(function(t) {
              self?.routeTo(self.ticketMenu+"/"+t.id + "?mode=EDIT");
            });
          }
        }, e => {
          self?.notify(e, '', this.LogLevel.ERROR);
        });
      }
    },
    {
      name: 'disableUser',
      label: 'Disable',
      toolTip: 'Open ticket to disable a user and all associated entities',
      availablePermissions: ['user.action.disable'],
      isAvailable: async function(id, type, spid, lifecycleState) {
        // NOTE: testing spid as hack so action only available from detail view
        return id && type == 'User' && spid &&
          ( lifecycleState != this.LifecycleState.DISABLED &&
            lifecycleState != this.LifecycleState.DELETED );
      },
      code: function(X) {
        var self = this;
        var ticket = this.ticketDAO.find(
          this.AND(
            this.EQ(this.Ticket.TYPE, this.UserLifecycleTicket.name),
            this.EQ(this.Ticket.CREATED_FOR, this.id),
            this.EQ(this.Ticket.SPID, this.spid),
            this.OR(
              this.EQ(this.UserLifecycleTicket.REQUESTED_LIFECYCLE_STATE, this.LifecycleState.DELETED),
              this.EQ(this.UserLifecycleTicket.REQUESTED_LIFECYCLE_STATE, this.LifecycleState.DISABLED)
            )
          )
        ).then(t => {
          if ( t ) {
            t.requestedLifecycleState = this.LifecycleState.DISABLED;
            if ( t.status == "CLOSED" ) {
              t.comment = "Re-open. "+t.title;
              t.status = "OPEN";
            }
            self.ticketDAO.put(t).then(function(t) {
              self?.routeTo(self.ticketMenu+"/"+t.id + "?mode=EDIT");
            });
          } else {
            var ticket = self.UserLifecycleTicket.create({
              title: 'Disable user',
              createdFor: self.id,
              spid: self.spid,
              requestedLifecycleState: self.LifecycleState.DISABLED
            });
            self.ticketDAO.put(ticket).then(function(t) {
              self?.routeTo(self.ticketMenu+"/"+t.id + "?mode=EDIT");
            });
          }
        }, e => {
          self?.notify(e, '', this.LogLevel.ERROR);
        });
      }
    },
    {
      name: 'activateUser',
      label: 'Activate',
      toolTip: 'Open a ticket to activate a new user or re-activate a previously disabled or deleted user',
      availablePermissions: ['user.action.activate'],
      isAvailable: async function(id, type, spid, lifecycleState) {
        // NOTE: testing spid as hack so action only available from detail view
        return id && type == 'User' && spid &&
          ( lifecycleState == this.LifecycleState.DISABLED ||
            lifecycleState == this.LifecycleState.DELETED ||
            lifecycleState == this.LifecycleState.PENDING );
      },
      code: function(X) {
        var self = this;
        // find existing ticket
        var ticket = this.ticketDAO.find(
          this.AND(
            this.EQ(this.Ticket.TYPE, this.UserLifecycleTicket.name),
            this.EQ(this.Ticket.CREATED_FOR, this.id),
            this.EQ(this.Ticket.SPID, this.spid)
          )
        ).then(t => {
          if ( t ) {
            if ( t.status == "CLOSED" ) {
              t.comment = "Re-open. "+t.title;
              t.status = "OPEN";
            }
            if ( t.requestedLifecycleState == this.LifecycleState.DELETED ||
                 t.requestedLifecycleState == this.LifecycleState.DISABLED ) {
              t.revertRelationships = t.includeRelationships && t.updated && t.updated.length > 0;
              t.includeRelationships = t.revertRelationships;
              t.requestedLifecycleState = self.LifecycleState.ACTIVE;
              t.title = "Re-activate user";
            }
            self.ticketDAO.put(t).then(function(t) {
              self?.routeTo(self.ticketMenu+"/"+t.id + "?mode=EDIT");
            });
          } else {
            var ticket = self.UserLifecycleTicket.create({
              title: 'Activate user',
              createdFor: self.id,
              spid: self.spid,
              requestedLifecycleState: self.LifecycleState.ACTIVE,
              includeRelationships: false,
              revertRelationships: false
            });
            self.ticketDAO.put(ticket).then(function(t) {
              self?.routeTo(self.ticketMenu+"/"+t.id + "?mode=EDIT");
            });
          }
        }, e => {
          self?.notify(e, '', this.LogLevel.ERROR);
        });
      }
    },
    {
      name: 'resetPassword',
      label: 'Reset Password',
      toolTip: 'Send a password reset email to this user',
      availablePermissions: ['user.action.resetPassword'],
      isAvailable: async function(id, type, spid, lifecycleState) {
        return id && type == 'User' && spid &&
          ( lifecycleState != this.LifecycleState.DISABLED &&
            lifecycleState != this.LifecycleState.DELETED );
      },
      confirmationRequired: () => true,
      code: function () {
        var self = this;
        this.resetPasswordToken.generateToken(null, this).then(() => {
          self?.notify(self.RESET_PASSWORD_SENT, '', self.LogLevel.INFO, true);
        }, e => {
          const errorMsg = e?.message || self.RESET_PASSWORD_FAILED;
          self?.notify(errorMsg, '', self.LogLevel.ERROR, true);
        });
      }
    }
  ]
});


foam.RELATIONSHIP({
  cardinality: '1:*',
  sourceModel: 'foam.core.auth.Group',
  targetModel: 'foam.core.auth.User',
  forwardName: 'users',
  inverseName: 'group',
  sourceProperty: {
    hidden: true
  },
  targetProperty: {
    hidden: false,
    required: true,
    section: 'systemInformation',
    order: 30,
    gridColumns: 6,
    columnPermissionRequired: true
  }
});


foam.RELATIONSHIP({
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.fs.File',
  forwardName: 'files',
  inverseName: 'owner',
  sourceProperty: {
    transient: true,
    section: 'systemInformation',
    columnPermissionRequired: true
  }
});

// Relationship used in the agent auth service. Determines permission list when acting as a entity.
foam.RELATIONSHIP({
  cardinality: '*:*',
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.auth.User',
  forwardName: 'entities',
  inverseName: 'agents',
  junctionDAOKey: 'agentJunctionDAO',
  junctionModelPlural: 'User Proxy Management',
  sourceProperty: {
    createVisibility: 'HIDDEN',
    label: 'Businesses',
    section: 'businessInformation',
    order: 50,
    columnPermissionRequired: true
  },
  targetProperty: {
    createVisibility: 'HIDDEN',
    label: 'Agents of Business',
    section: 'businessInformation',
    order: 40,
    columnPermissionRequired: true
  }
});

foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserUserJunctionGroupAndStatusRefinement',
  refines: 'foam.core.auth.UserUserJunction',

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.auth.Group',
      name: 'group',
      menuKeys: ['admin.groups']
    },
    {
      class: 'Enum',
      of: 'foam.core.auth.AgentJunctionStatus',
      name: 'status',
      documentation: 'Describes the active state between agent and entity.',
      readPermissionRequired: false,
      writePermissionRequired: true,
      value: 'ACTIVE'
    }
  ]
});

foam.RELATIONSHIP({
  sourceModel: 'foam.core.theme.Theme',
  targetModel: 'foam.core.auth.User',
  cardinality: '1:*',
  forwardName: 'users',
  inverseName: 'theme',
  sourceProperty: {
    hidden: true,
    visibility: 'HIDDEN',
  },
  targetProperty: {
    section: 'systemInformation',
    order: 60,
    gridColumns: 6,
    columnPermissionRequired: true
  }
});
