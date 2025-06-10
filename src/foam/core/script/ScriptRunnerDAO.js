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
    'foam.core.logger.Logger',
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.StdoutLogger'
  ],

  javaCode: `
    public ScriptRunnerDAO(DAO delegate) {
      setDelegate(delegate);
    }
  `,

  methods: [
    {
      name: 'put_',
      javaCode: `
        Script script = (Script) obj;
        if ( script.getStatus() == ScriptStatus.SCHEDULED ) {
          if ( script.canRun(x) ) {
            script.setStatus(ScriptStatus.RUNNING);
            script = (Script) getDelegate().put_(x, script);
            runScript(x, (Script) script.fclone());
          } else {
            script.setStatus(ScriptStatus.UNSCHEDULED);
            script = (Script) getDelegate().put_(x, script);
          }
        } else {
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
          ((Agency) x.get("threadPool")).submit(x, new ContextAgent() {
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
                DAO dao = (DAO) ScriptRunnerDAO.this.cmd_(x, DAO.LAST_CMD);
                if ( dao != null ) {
                  script.setThreadId(Thread.currentThread().threadId());
                  dao.put_(x, script);
                }

                script.runScript(x);
                script.setStatus(ScriptStatus.UNSCHEDULED);
              } catch(Throwable t) {
                script.setStatus(ScriptStatus.ERROR);
                logger.error("agency", script.getId(), t);
              } finally {
                // re-put to the top of the dao stack rather than delegate
                // to allow rules to run pre and post execution
                script.clearThreadId();
                ((DAO) x.get(script.getDaoKey())).put_(x, script);
              }
            }
          }, "Run script: " + script.getId());
        return script;
      `
    }
  ]
});
