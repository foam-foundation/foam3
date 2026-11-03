/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'JShellScript',
  extends: 'foam.core.reflow.AbstractJobScript',

  documentation: `
    An editable JShell script that runs on the server as a
    foam.core.job.ScriptJob, with the same x and print() as a JShell script
    in the scriptDAO.
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
      return this.ScriptJob.create({ language: 'JSHELL', code: this.code });
    }
  ]
});
