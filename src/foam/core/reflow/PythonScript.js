/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PythonScript',
  extends: 'foam.core.reflow.AbstractJobScript',

  documentation: `
    An editable Python script that runs on the server as a
    foam.core.job.PythonJob. PythonJob takes interpreter arguments rather than
    source, so the code is passed as python -c <code>.
  `,

  requires: [ 'foam.core.job.PythonJob' ],

  properties: [
    {
      name: 'code',
      view: function() { return foam.core.reflow.AbstractScript.codeView('PYTHON'); }
    }
  ],

  methods: [
    function createJob() {
      return this.PythonJob.create({ command: [ '-c', this.code ] });
    }
  ]
});
