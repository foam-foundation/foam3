/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.script',
  name: 'Script',

  documentation: `
Normally scripts are managed by an admin.  If an application requires
finer grained control the model is Authorizable, so particular groups
can have read and run access to particular scripts.

NOTE:  'code' has it owns writePermission.  Granting read.id and run will
allow an operations group to see and execute scripts but not edit the code.

Example groupPermissionJunction setup:

p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"menu.read.admin"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"service.scriptDAO"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"menu.read.admin.scripts"})
// Access to see, possibly run all scripts
// p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"script.read.*"})
// Access to see, possibly run a single script
// p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"script.read.ExampleScriptId"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"script.action.run"})
// p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"script.action.inspect"})
// p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"script.action.interrupt"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"service.scriptParameterDAO"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"scriptparameter.create"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"scriptparameter.read.*"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"scriptparameter.update.*"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"menu.read.admin.scriptparameters"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"service.scriptEventDAO"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"scriptevent.read.*"})
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"menu.read.admin.scriptevents"})
  `,

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.EnabledAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware',
    'foam.core.medusa.Clusterable'
  ],

  requires: [
    'foam.core.script.Language',
    'foam.core.script.ScriptStatus',
    'foam.core.notification.Notification',
    'foam.core.notification.ScriptRunNotification',
    'foam.core.notification.ToastState'
  ],

  imports: [
    'notificationDAO',
    'sessionID',
    'setTimeout',
    'scriptDAO',
    'scriptEventDAO',
    'subject',
    'window'
  ],

  exports: [
    'as script'
  ],

  javaImports: [
    'foam.lang.*',
    'foam.dao.*',
    'foam.log.LogLevel',
    'static foam.mlang.MLang.*',
    'foam.core.auth.*',
    'foam.core.er.EventRecord',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',

    'java.io.BufferedReader',
    'java.io.ByteArrayOutputStream',
    'java.io.PrintStream',
    'java.io.StringReader',
    'java.util.ArrayList',
    'java.util.Date',
    'java.util.List',
    'java.util.Map',

    'bsh.EvalError',
    'bsh.Interpreter',
    'jdk.jshell.JShell'
  ],

  tableColumns: [
    'id',
    'description',
    'lastDuration',
    'lastRun',
    'status'
  ],

  searchColumns: [
    'id',
    'description'
  ],

  constants: [
    {
      name: 'MAX_OUTPUT_CHARS',
      type: 'Integer',
      value: 20000
    },
    {
      name: 'MAX_NOTIFICATION_OUTPUT_CHARS',
      type: 'Integer',
      value: 200
    },
    {
      javaType: 'X[]',
      name: 'X_HOLDER',
      javaValue: 'new X[1]'
    }
  ],

  sections: [
    {
      name: 'scriptEvents',
      title: 'Events',
      order: 2
    },
    {
      name: '_defaultSection',
      title: 'Info',
      order: 1
    }
  ],

  messages: [
    { name: 'EXECUTION_DISABLED', message: 'execution disabled' },
    { name: 'EXECUTION_INVOKED', message: 'execution invoked' },
    { name: 'EXECUTION_FAILED', message: 'execution failed' },
    { name: 'EXECUTION_COMPLETED', message: 'execution completed' },
    { name: 'EXECUTION_INTERRUPTED', message: 'execution interrupted' },
    { name: 'ENABLED_YES', message: 'Y' },
    { name: 'ENABLED_NO', message: 'N' },
    { name: 'PRIORITY_LOW', message: 'Low' },
    { name: 'PRIORITY_MEDIUM', message: 'Medium' },
    { name: 'PRIORITY_HIGH', message: 'High' }
  ],

  properties: [
    {
      class: 'String',
      name: 'id',
      includeInDigest: true,
      tableWidth: 300
    },
    {
      class: 'Boolean',
      name: 'enabled',
      includeInDigest: true,
      documentation: 'Enables script.',
      projectionSafe: false,
      tableCellFormatter: function(value, obj) {
        this.start()
          .style({ color: value ? /*%APPROVAL3*/ 'green' : /*%GREY2%*/ 'grey' })
          .add(value ? obj.ENABLED_YES : obj && obj.ENABLED_NO || 'N')
        .end();
      },
      tableWidth: 90,
      value: true
    },
    {
      class: 'String',
      name: 'description',
      includeInDigest: false,
      documentation: 'Description of the script.',
      width: 100,
      tableWidth: 300
    },
    {
      class: 'Int',
      name: 'priority',
      value: 5,
      javaValue: 5,
      includeInDigest: false,
      view: function(_, X ) {
        return {
          class: 'foam.u2.view.ChoiceView',
          choices: [
            [4, X.data.PRIORITY_LOW],
            [5, X.data.PRIORITY_MEDIUM],
            [6, X.data.PRIORITY_HIGH]
          ]
        };
      }
    },
    {
      documentation: 'A non-clusterable script can run on all instances, and any run info will be stored locally',
      name: 'clusterable',
      class: 'Boolean',
      value: true,
      includeInDigest: false,
    },
    {
      documentation: 'Generate notification on script completion',
      name: 'notify',
      class: 'Boolean',
      value: false
    },
    {
      class: 'DateTime',
      name: 'lastRun',
      documentation: 'Date and time the script ran last.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      tableWidth: 140,
      storageTransient: true,
      storageOptional: true
    },
    {
      class: 'Duration',
      name: 'lastDuration',
      documentation: 'Date and time the script took to complete.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      tableWidth: 125,
      storageTransient: true,
      storageOptional: true
    },
    {
      class: 'Enum',
      of: 'foam.core.script.Language',
      name: 'language',
      value: 'BEANSHELL'
    },
    // TODO: port and remove
    {
      documentation: 'Legacy support for JS scripts created before JShell',
      class: 'Boolean',
      name: 'server',
      value: true,
      transient: true,
      visibility: 'HIDDEN',
      javaSetter: `
        if ( val ) {
          setLanguage(foam.core.script.Language.BEANSHELL);
        } else {
          setLanguage(foam.core.script.Language.JS);
        }
      `,
    },
    {
      class: 'foam.lang.Enum',
      of: 'foam.core.script.ScriptStatus',
      name: 'status',
      documentation: 'Status of script.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RW',
      value: 'UNSCHEDULED',
      tableWidth: 120,
      storageTransient: true,
      storageOptional: true,
      clusterTransient: true
    },
    {
      class: 'String',
      name: 'agencyName',
      documentation: 'Agency name eg. threadPool, to be used to run the script. Default not set to use agencyName of the ScriptRunnerDAO.'
    },
    {
      class: 'Code',
      name: 'code',
      includeInDigest: true,
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'output',
      includeInDigest: false,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      view: {
        class: 'foam.u2.view.ModeAltView',
        readView: { class: 'foam.u2.view.PreView' }
      },
      preSet: function(_, newVal) {
        // for client side scripts
        if ( newVal.length > this.MAX_OUTPUT_CHARS ) {
          newVal = newVal.substring(0, this.MAX_OUTPUT_CHARS) + '...';
        }
        return newVal;
      },
      javaSetter: `
      // for server side scripts
      if (val.length() > MAX_OUTPUT_CHARS) {
        val = val.substring(0, MAX_OUTPUT_CHARS) + "...";
      }
      output_ = val;
      outputIsSet_ = true;
      `,
      storageTransient: true
    },
    {
      class: 'String',
      name: 'notes',
      includeInDigest: false,
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 144 }
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'lastModifiedBy',
      includeInDigest: true,
      documentation: 'User who last modified script',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'lastModifiedByAgent',
      includeInDigest: true,
      documentation: 'Agent acting user who last modified script',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'DateTime',
      name: 'lastModified',
      includeInDigest: false,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'daoKey',
      value: 'scriptDAO',
      transient: true,
      visibility: 'HIDDEN',
      documentation: 'Name of dao to store script itself. To set from inheritor just change property value. Used by client for polling.'
    },
    {
      class: 'String',
      name: 'eventDaoKey',
      value: 'scriptEventDAO',
      transient: true,
      visibility: 'HIDDEN',
      documentation: 'Name of dao to store script run/event report. To set from inheritor just change property value',
      tableWidth: 120
    },
    {
      class: 'Long',
      name: 'threadId',
      storageTransient: true,
      visibility: 'HIDDEN',
      documentation: 'Id of thread on which the script is running'
    },
    {
      class: 'Object',
      name: 'threadExecution',
      javaType: 'java.util.concurrent.Future<?>',
      transient: true,
      visibility: 'HIDDEN',
      documentation: 'Object representing thread execution of the script. Used in ScriptRunnerDAO for halting the script on threadTimeout.',
      javaCloneProperty: 'set(dest, get(source));'
    },
    {
      class: 'Long',
      name: 'threadStartTime',
      transient: true,
      visibility: 'HIDDEN',
      documentation: 'Start time of thread execution of the running script'
    }
  ],

  methods: [
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        return this.id;
      },
      javaCode: `
        return getId();
      `
    },
    {
      name: 'createInterpreter',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'ps', type: 'PrintStream' }
      ],
      javaType: 'Object',
      synchronized: true,
      javaCode: `
        Language l = getLanguage();
        ScriptParameter sp = null;
        try {
          sp = (ScriptParameter) ((DAO) x.get("scriptParameterDAO"))
            .find(AND(
              EQ(ScriptParameter.ENABLED, true),
              EQ(ScriptParameter.NAME, getId())
            ));
        } catch (Throwable t) {
          Loggers.logger(x, this).warning("Failed retrieving ScriptParameter", t);
        }
        if ( l == foam.core.script.Language.JSHELL ) {
          JShell jShell = new JShellExecutor().createJShell(ps);
          Script.X_HOLDER[0] = x.put("out",  ps)
            .put("currentScript", this)
            .put("scriptParameter", sp);
// p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"example-group",targetId:"script.read.*"})
          jShell.eval("import foam.lang.X;");
          jShell.eval("X x = foam.core.script.Script.X_HOLDER[0];");
          jShell.eval("void print(Object o) { ((java.io.PrintStream) x.get(\\\"out\\\")).println(String.valueOf(o));  }");
          return jShell;
        } else if ( l == foam.core.script.Language.BEANSHELL ) {
          Interpreter shell = new Interpreter();
          try {
            shell.set("currentScript", this);
            shell.set("scriptParameter", sp);
            shell.set("x", x.put("out", ps));
            shell.eval("runScript(String name) { script = x.get("+getDaoKey()+").find(name); if ( script != null ) eval(script.code); }");
            shell.eval("foam.lang.X sudo(String user) { foam.util.Auth.sudo(x, (String) user); }");
            shell.eval("foam.lang.X sudo(Object id) { foam.util.Auth.sudo(x, id); }");
          } catch (EvalError e) {
            Logger logger = (Logger) x.get("logger");
            logger.error(this.getClass().getSimpleName(), "createInterpreter", getId(), e);
          }
          return shell;
        } else {
          throw new RuntimeException("Script language not supported");
        }
      `
    },
    {
      name: 'canRun',
      args: 'Context x',
      type: 'Boolean',
      javaCode: 'return true;'
    },
    {
      name: 'runScript',
      code: function() {
        var log = () => {
          this.output += Array.from(arguments).join('') + '\n';
        };
        try {
          with ({ log: log, print: log, x: this.__subContext__ })
            return Promise.resolve(eval('(async () => {' + this.code + '})()'));
        } catch (err) {
          this.output += err;
          return Promise.reject(err);
        }
      },
      args: 'Context x',
      javaCode: `
        RuntimeException      thrown = null;
        Language              l      = getLanguage();
        ByteArrayOutputStream baos   = new ByteArrayOutputStream();
        PrintStream           ps     = new PrintStream(baos);
        PM                    pm     = new PM(this.getClass(), getId());

        try {
          Thread.currentThread().setPriority(getPriority());
          setLastRun(new Date());
          if ( ! ( this instanceof foam.core.cron.Cron ) ) {
            er(x, null, LogLevel.INFO, null);
          }
          if ( l == foam.core.script.Language.BEANSHELL ) {
            Interpreter shell = (Interpreter) createInterpreter(x, ps);
            setOutput("");
            shell.setOut(ps);
            shell.eval(getCode());
          } else if ( l == foam.core.script.Language.JSHELL ) {
            JShell jShell = (JShell) createInterpreter(x,ps);
            new JShellExecutor().execute(x, jShell, getCode(), true);
          } else {
            throw new RuntimeException("Script language not supported");
          }
          pm.log(x);
       } catch (Throwable t) {
          var wasInterrupted = t instanceof InterruptedException;
          var cause = t;
          while ( ! wasInterrupted && cause != null ) {
            cause = cause.getCause();
            wasInterrupted = cause instanceof InterruptedException;
          }

          thrown = new RuntimeException(wasInterrupted ? cause : t);
          pm.error(x, t);
          ps.println();
          t.printStackTrace(ps);
          er(x, t.getMessage(), LogLevel.ERROR, t);
          throw thrown;
        } finally {
          setLastDuration(pm.getTime());
          ps.flush();
          setOutput(baos.toString());

          Thread.currentThread().setPriority(Thread.NORM_PRIORITY);

          ScriptEvent event = new ScriptEvent(x);
          event.setLastRun(this.getLastRun());
          event.setLastDuration(this.getLastDuration());
          event.setOutput(this.getOutput());
          if ( thrown != null ) event.setLastStatus(ScriptStatus.ERROR);
          event.setScriptType(this.getClass().getSimpleName());
          event.setOwner(this.getId());
          event.setScriptId(this.getId());
          event.setHostname(System.getProperty("hostname", "localhost"));
          event.setClusterable(this.getClusterable());
          ((DAO) x.get(getEventDaoKey())).put(event);
        }
    `
    },
    {
      name: 'er',
      args: 'X x, String message, LogLevel severity, Throwable t',
      javaCode: `
      ((DAO) x.get("eventRecordDAO")).put(new EventRecord(x, this, getId(), null, null, message, severity, t));
      `
    },
    {
      name: 'poll',
      code: function() {
        var delay = Math.min(4000, Math.max(40, this.lastDuration));
        var self  = this;
        function check() {
          var dao = self.__context__[self.daoKey];
          dao.cmd(foam.dao.DAO.PURGE_CMD); // In case DAO is decorated with a TTLCachingDAO (which it is)
          dao.find(self.id).then(function(script) {
            // console.log('***************** POLL', script.status, delay);
            if ( script.status === self.ScriptStatus.UNSCHEDULED || script.status === self.ScriptStatus.ERROR ) {
              self.copyFrom(script);

              if ( self.notify ) {
p({class:"foam.core.auth.GroupPermissionJunction",sourceId:"nbp-fraud-ops",targetId:"scriptparameter.create"})
                // create notification
                var notification = self.ScriptRunNotification.create({
                  userId: self.subject && self.subject.realUser ?
                    self.subject.realUser.id : self.user.id,
                  scriptId: script.id,
                  notificationType: 'Script Execution',
                  body: `Status: ${script.status}
                    Script Output: ${script.length > self.MAX_NOTIFICATION_OUTPUT_CHARS ?
                      script.output.substring(0, self.MAX_NOTIFICATION_OUTPUT_CHARS) + '...' :
                      script.output }
                    LastDuration: ${script.lastDuration}`
                });
                self.notificationDAO.put(notification);
              }
              var notification = self.Notification.create();
              notification.userId = self.subject && self.subject.realUser ?
                self.subject.realUser.id : self.user.id;
              notification.severity = foam.log.LogLevel.INFO;
              if ( script.status === self.ScriptStatus.UNSCHEDULED ) {
                notification.toastMessage = self.cls_.name + ' ' + self.EXECUTION_COMPLETED;
              } else {
                notification.toastMessage = self.cls_.name + ' ' + self.EXECUTION_FAILED;
                notification.severity = foam.log.LogLevel.WARN;
              }
              notification.toastState = self.ToastState.REQUESTED;
              notification.transient = true;
              self.__subContext__.myNotificationDAO.put(notification);
            } else {
              delay = Math.min(4000, delay * 1.5);
              self.setTimeout(check, delay);
            }
          });
        }

        self.setTimeout(check, delay);
      }
    },
    {
      name: 'authorizeOnCreate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "script.create") ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnRead',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "script.read." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "script.update." + getId()) &&
               // Allow read.id + run to update as the run action
               // simply changes the state.
             ! ( auth.check(x, "script.read." + getId()) &&
                 auth.check(x, "script.action.run") ) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      args: 'Context x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "script.remove." + getId()) ) {
          throw new AuthorizationException();
        }
      `
    }
  ],

  actions: [
    {
      name: 'run',
      tableWidth: 90,
      availablePermissions: ['script.action.run'],
      confirmationRequired: function() {
        return true;
      },
      isAvailable: function(enabled, status) {
        return enabled
         &&
          ( status == this.ScriptStatus.UNSCHEDULED ||
            status == this.ScriptStatus.ERROR );
      },
      code: function() {
        var self = this;
        this.output = '';
        this.status = this.ScriptStatus.SCHEDULED;
        if ( this.language == this.Language.BEANSHELL || this.language == this.Language.JSHELL ) {
          var notification = self.Notification.create();
          notification.userId = self.subject && self.subject.realUser ?
            self.subject.realUser.id : self.user.id;
          notification.toastMessage = self.cls_.name + ' ' + self.EXECUTION_INVOKED;
          notification.toastState = self.ToastState.REQUESTED;
          notification.severity = foam.log.LogLevel.INFO;
          notification.transient = true;
          self.__subContext__.myNotificationDAO.put(notification);
          this.__context__[this.daoKey].put(this).then(function(script) {
            self.copyFrom(script);
            if ( script.status === self.ScriptStatus.SCHEDULED || script.status === self.ScriptStatus.RUNNING ) {
              self.poll();
            }
          }).catch(function(e) {
            var notification = self.Notification.create();
            notification.userId = self.subject && self.subject.realUser ?
              self.subject.realUser.id : self.user.id;
            notification.toastMessage = self.cls_.name + ' ' + self.EXECUTION_FAILED;
            notification.toastSubMessage = e.message || e;
            notification.toastState = self.ToastState.REQUESTED;
            notification.severity = foam.log.LogLevel.WARN;
            notification.transient = true;
            self.__subContext__.myNotificationDAO.put(notification);
          });
        } else {
          var notification = this.Notification.create();
          notification.userId = this.subject && this.subject.realUser ?
            this.subject.realUser.id : this.subject.user.id;
          notification.toastMessage = this.cls_.name + ' ' + this.EXECUTION_INVOKED;
          notification.toastState = this.ToastState.REQUESTED;
          notification.severity = foam.log.LogLevel.INFO;
          notification.transient = true;
          this.__subContext__.myNotificationDAO.put(notification);

          this.status = this.ScriptStatus.RUNNING;
          this.runScript().then(
            () => {
              this.status = this.ScriptStatus.UNSCHEDULED;
              this.__context__[this.daoKey].put(this);
              var notification = this.Notification.create();
              notification.userId = this.subject && this.subject.realUser ?
                this.subject.realUser.id : this.subject.user.id;
              notification.toastMessage = this.cls_.name + ' ' + this.EXECUTION_COMPLETED;
              notification.toastState = this.ToastState.REQUESTED;
              notification.severity = foam.log.LogLevel.INFO;
              notification.transient = true;
              this.__subContext__.myNotificationDAO.put(notification);
           },
            (e) => {
              var notification = this.Notification.create();
              notification.userId = this.subject && this.subject.realUser ?
                this.subject.realUser.id : this.subject.user.id;
              notification.toastMessage = this.cls_.name + ' ' + this.EXECUTION_FAILED;
              notification.toastSubMessage = e.message || e;
              notification.toastState = this.ToastState.REQUESTED;
              notification.severity = foam.log.LogLevel.WARN;
              notification.transient = true;
              this.__subContext__.myNotificationDAO.put(notification);

              this.output += '\n' + e.stack;
              console.log(e);
              this.status = this.ScriptStatus.ERROR;
              this.__context__[this.daoKey].put(this);
            }
          );
        }
      }
    },
    {
      name: 'inspect',
      availablePermissions: ['script.action.inspect'],
      isAvailable: function(status, threadId) {
        return status == this.ScriptStatus.RUNNING && threadId;
      },
      code: function() {
        var url = this.window.location.origin + '/service/threads?id=' + this.threadId + '&sessionId=' + this.sessionID;
        this.window.open(url, '_blank');
      }
    },
    {
      name: 'interrupt',
      availablePermissions: ['script.action.interrupt'],
      confirmationRequired: function() {
        return true;
      },
      isAvailable: function(status, threadId) {
        return status == this.ScriptStatus.RUNNING && threadId;
      },
      code: async function() {
        var self = this;

        this.status = this.ScriptStatus.INTERRUPTED;
        return this.__context__[this.daoKey].put(this).then(function(script) {
          var notification = self.Notification.create({});
          notification.userId = self.subject && self.subject.realUser ?
            self.subject.realUser.id : self.user.id;

          notification.toastMessage = `"${self.id}" ${self.EXECUTION_INTERRUPTED}`;
          notification.severity = foam.log.LogLevel.WARN;
          notification.toastState = self.ToastState.REQUESTED;
          notification.transient = true;
          self.__subContext__.myNotificationDAO.put(notification);
        });
      }
    }
  ]
});
