/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'BeanShellScript',
  extends: 'foam.core.reflow.AbstractJobScript',

  documentation: `
    An editable BeanShell script that runs on the server as a
    foam.core.job.ScriptJob, with the same x, print(), sudo() and runScript()
    as a script in the scriptDAO.
  `,

  requires: [ 'foam.core.job.ScriptJob' ],

  properties: [
    {
      name: 'code',
      view: function() { return foam.core.reflow.AbstractScript.codeView('JAVA'); }
    }
  ],

  methods: [
    function createJob() {
      return this.ScriptJob.create({ language: 'BEANSHELL', code: this.code });
    }
  ]
});
