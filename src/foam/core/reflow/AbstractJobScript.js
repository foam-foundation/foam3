/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractJobScript',
  extends: 'foam.core.reflow.AbstractScript',

  documentation: `
    A script block whose code runs on the server as a foam.core.job.Job.
    Subclasses supply createJob(), which wraps the code in the right kind of
    Job. The output shown here is refreshed on every poll while the job runs,
    so a long-running script shows its progress line by line.
  `,

  requires: [ 'foam.core.job.JobStatus' ],

  imports: [ 'jobDAO' ],

  properties: [
    {
      class: 'Boolean',
      name: 'running',
      documentation: 'True while a Job is in flight, so run cannot start a second one.',
      transient: true,
      hidden: true
    }
  ],

  methods: [
    function createJob() {
      throw new Error(this.cls_.id + ' does not implement createJob()');
    },

    async function run_() {
      this.running = true;
      this.output  = '';
      try {
        var job = await foam.core.job.Jobs.poll(
          this.__subContext__,
          this.createJob(),
          j => this.output = j.output);

        this.output = job.output;
        if ( job.status === this.JobStatus.FAILED )
          this.output += '\n' + job.exception;

        // poll() leaves the finished job in the jobDAO for the caller to free.
        await this.jobDAO.remove(job);
      } catch (e) {
        this.output += '\n' + e;
      } finally {
        this.running = false;
      }
    }
  ],

  actions: [
    {
      name: 'run',
      isEnabled: function(running) { return ! running; },
      code: function() { return this.run_(); }
    }
  ]
});
