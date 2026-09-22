/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'SubmitJobRuleAction',

  implements: [ 'foam.core.ruler.RuleAction' ],

  documentation: `Hands a newly created Job to an Agency to be run, wrapped in
    a JobRunner.

    The rule this backs is on create only, so a Job is submitted once: the
    JobRunner's own status writes come back through the same jobDAO as updates
    and do not re-submit it.

    The Agency lookup happens outside the agency agent so that a dao.cmd()
    probe reports a missing threadPool instead of failing inside it, and so
    that a probe never actually runs the Job. The submit itself only queues,
    so the put that triggered this rule returns without waiting on the work.`,

  javaImports: [
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X'
  ],

  properties: [
    {
      documentation: 'Context name of the Agency that runs the Job.',
      class: 'String',
      name: 'agencyName',
      value: 'threadPool'
    }
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        // The Job runs detached from this put, and mutates itself as it goes,
        // so the runner gets its own unfrozen copy.
        Job    job  = (Job) obj.fclone();
        Agency pool = (Agency) x.get(getAgencyName());

        if ( pool == null )
          throw new RuntimeException("Agency not found: " + getAgencyName());

        agency.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            pool.submit(
              x,
              new JobRunner.Builder(x).setJob(job).build(),
              job.getClass().getSimpleName() + ":" + job.getId());
          }
        }, "Submitting job " + job.getId());
      `
    }
  ]
});
