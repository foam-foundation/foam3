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

    A Job with a group does not go straight to the Agency. It joins its group's queue, and
    one agent drains that queue, running the Jobs one after another in the order they were
    put. The put that creates a Job runs this rule before it returns, so a submitter that
    waits for each put's reply gets its Jobs queued in the order it sent them. Once a Job of
    a group fails, the queued Jobs after it, and any put later into that group, end FAILED
    without running (except a Job with runAfterFailure). The state of a group that failed is
    kept, a few bytes per group, so a late put is still refused.

    The Agency lookup happens outside the agency agent so that a dao.cmd()
    probe reports a missing threadPool instead of failing inside it, and so
    that a probe never actually runs the Job. The submit itself only queues,
    so the put that triggered this rule returns without waiting on the work.`,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.util.ArrayDeque',
    'java.util.HashMap',
    'java.util.Map'
  ],

  javaCode: `
    /** A Job waiting in its group, with the context it was put in. */
    protected static class Entry {
      final Job job;
      final X   x;
      Entry(Job job, X x) { this.job = job; this.x = x; }
    }

    /** The queued Jobs of one group, and which Job of it failed first, if any. */
    protected static class GroupQueue {
      final ArrayDeque<Entry> pending = new ArrayDeque<>();
      boolean running;
      String  failedId;
    }

    // Static: RulerDAO builds a new action instance when its rules reload, and an instance map
    // would start empty, letting a second agent run a group that is already running.
    protected static final Map<String, GroupQueue> groups_ = new HashMap<>();
  `,

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
            if ( SafetyUtil.isEmpty(job.getGroup()) ) {
              pool.submit(
                x,
                new JobRunner.Builder(x).setJob(job).build(),
                job.getClass().getSimpleName() + ":" + job.getId());
            } else {
              enqueue(pool, x, job);
            }
          }
        }, "Submitting job " + job.getId());
      `
    },
    {
      name: 'enqueue',
      documentation: 'Adds the Job to its group and starts the agent that drains the group, unless one is already running.',
      args: 'Agency pool, X x, Job job',
      javaCode: `
        String group = job.getGroup();
        synchronized ( groups_ ) {
          GroupQueue q = groups_.computeIfAbsent(group, k -> new GroupQueue());
          q.pending.add(new Entry(job, x));
          if ( q.running ) return;
          q.running = true;
        }
        pool.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) { drain(group); }
        }, "JobGroup:" + group);
      `
    },
    {
      name: 'drain',
      documentation: `Runs the queued Jobs of the group one at a time until none is left. A queue
        that ends with no failure is forgotten; one that failed is kept so that later Jobs of the
        group are refused too.`,
      args: 'String group',
      javaCode: `
        while ( true ) {
          Entry  e;
          String failed;
          synchronized ( groups_ ) {
            GroupQueue q = groups_.get(group);
            e = q.pending.poll();
            if ( e == null ) {
              q.running = false;
              if ( q.failedId == null ) groups_.remove(group);
              return;
            }
            failed = q.failedId;
          }

          // A throw from a save below would otherwise leave this agent dead with running still
          // set, and the rest of the group queued for good. The Job counts as failed, so the
          // Jobs behind it end FAILED.
          try {
            if ( failed != null && ! e.job.getRunAfterFailure() ) {
              e.job.setStatus(JobStatus.FAILED);
              e.job.setException("Not run: job " + failed + " of this group failed");
              e.job.save(e.x);
              continue;
            }

            new JobRunner.Builder(e.x).setJob(e.job).build().execute(e.x);
          } catch ( Throwable t ) {
            Loggers.logger(e.x, this).error("job", e.job.getId(), t);
            e.job.setStatus(JobStatus.FAILED);
            e.job.setException(String.valueOf(t));
            try { e.job.save(e.x); } catch ( Throwable ignore ) {}
          }

          if ( e.job.getStatus() == JobStatus.FAILED ) {
            synchronized ( groups_ ) {
              GroupQueue q = groups_.get(group);
              if ( q.failedId == null ) q.failedId = e.job.getId();
            }
          }
        }
      `
    }
  ]
});
