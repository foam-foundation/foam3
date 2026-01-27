/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.script',
  name: 'ScriptRunnerDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.lang.*',
    'foam.dao.*',
    'foam.core.er.EventRecord',
    'foam.core.logger.Logger',
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.StdoutLogger',
    'foam.log.LogLevel'
  ],

  javaCode: `
    public ScriptRunnerDAO(DAO delegate) {
      setDelegate(delegate);
    }

    public ScriptRunnerDAO(DAO delegate, String agencyName) {
      setDelegate(delegate);
      setAgencyName(agencyName);
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'agencyName',
      value: 'threadPool'
    }
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
        Script script = (Script) obj;
        if ( script.getStatus() == ScriptStatus.SCHEDULED ) {
          if ( script.canRun(x) ) {
            script.setStatus(ScriptStatus.RUNNING);
            script = (Script) getDelegate().put_(x, script);
            script = runScript(x, (Script) script.fclone());
          } else {
            script.setStatus(ScriptStatus.UNSCHEDULED);
            script = (Script) getDelegate().put_(x, script);
          }
        } else {
          if ( script.getStatus() == ScriptStatus.INTERRUPTED && script.getThreadExecution() != null ) {
            script.getThreadExecution().cancel(true);
          }
          script = (Script) getDelegate().put_(x, script);
        }
        return script;
      `
    },
    {
      name: 'runScript',
      type: 'foam.core.script.Script',
      args: 'Context x, foam.core.script.Script script',
      javaCode: `
        Agency agency = getAgency(x, script);
        if ( agency == null ) {
          script.setStatus(ScriptStatus.ERROR);
          script.setOutput("Agency not found: " + script.getAgencyName() + ", please check script.agencyName or remove it to use " + getAgencyName() + " instead.");
          return (Script) getDelegate().put_(x, script);
        }

        script.setThreadExecution(
          agency.submit(x, new ContextAgent() {
            @Override
            public void execute(X x) {
              x = x.put(Script.class, script);
              Logger logger = (Logger) x.get("logger");
              if ( logger == null ) {
                logger = StdoutLogger.instance();
              }
              logger = new PrefixLogger(new Object[] {
                this.getClass().getSimpleName()
              }, logger);

              try {
                script.setThreadId(Thread.currentThread().getId());
                script.setThreadStartTime(System.currentTimeMillis());
                getDelegate().put_(x, script);

                script.runScript(x);
                script.setStatus(ScriptStatus.UNSCHEDULED);

                // thread interrupted successfully without error, log event record
                if ( Thread.currentThread().isInterrupted() ) {
                  String message = "thread interrupted, time=[" + script.getThreadStartTime() + ", " + System.currentTimeMillis() + ")";
                  ((DAO) x.get("eventRecordDAO")).put(new EventRecord(x, "ScriptRunnerDAO", script.getId(), null, null, message, LogLevel.WARN, null));
                }
              } catch(Throwable t) {
                script.setStatus(ScriptStatus.ERROR);
                logger.error("agency", script.getId(), t);
              } finally {
                // re-put to the top of the dao stack rather than delegate
                // to allow rules to run pre and post execution
                script.clearThreadExecution();
                script.clearThreadId();
                script.clearThreadStartTime();

                // honor script enabled flag if it was updated before runScript() finished
                DAO dao = (DAO) x.get(script.getDaoKey());
                Script current = (Script) dao.find(script.getId());
                if ( current.getLastModified().after(script.getLastModified()) ) {
                  script.setEnabled(current.getEnabled());
                }
                dao.put_(x, script);

                // cleanup thread interrupted flag so it can be reused eg. by threadPool
                Thread.interrupted();
              }
            }
          }, "Run script: " + script.getId())
        );
        return script;
      `
    },
    {
      name: 'getAgency',
      type: 'Agency',
      args: 'Context x, foam.core.script.Script script',
      javaCode: `
        String agencyName = script.getAgencyName();
        if ( foam.util.SafetyUtil.isEmpty(agencyName) ) {
          agencyName = getAgencyName();
        }
        return (Agency) x.get(agencyName);
      `
    }
  ]
});
