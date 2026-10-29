/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ShellScript',
  extends: 'foam.core.reflow.AbstractJobScript',

  documentation: 'An editable shell script that runs on the server as a foam.core.job.ShellJob.',

  requires: [ 'foam.core.job.ShellJob' ],

  properties: [
    {
      name: 'code',
      view: function() { return foam.core.reflow.AbstractScript.codeView('SH'); }
    }
  ],

  methods: [
    function createJob() {
      return this.ShellJob.create({ script: this.code });
    }
  ]
});
