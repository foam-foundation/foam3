/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'KeepFinishedJobRuleAction',

  implements: [ 'foam.core.ruler.RuleAction' ],

  documentation: `Stops a put from reopening a Job that has already ended.

    A submitter that never saw its first reply sends the same Job again, with the
    same id and status SCHEDULED. If the Job had finished by then, that put would
    write SCHEDULED over COMPLETED, and a poller waiting for COMPLETED would wait
    forever. This rule is an update rule that runs before the write: when the
    stored Job is COMPLETED or FAILED and the incoming one is SCHEDULED, it makes
    the incoming Job a copy of the stored one, so the put changes nothing. An
    update that carries any other status, such as one that backdates a finished
    Job, is left alone.

    A Job that is RUNNING is not guarded. A Job legitimately writes itself while
    running (SuspendableJob puts SUSPENDING), and its own runner saves again when
    it ends.

    The resend can arrive while the runner saves COMPLETED. The RulerDAO reads the
    old Job before any rule runs, so that old Job can still say RUNNING when the
    stored one already says COMPLETED. The rule therefore sets requiresLock, which
    holds the jobDAO's lock from here until the write, and checks the Job it reads
    from the store under that lock, not oldObj. The runner's saves are updates too,
    so they wait on the same lock.`,

  javaImports: [
    'foam.lang.PropertyInfo'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        if ( ( (Job) obj ).getStatus() != JobStatus.SCHEDULED ) return;
        Job stored = (Job) ruler.getDelegate().find_(x, obj);
        if ( stored == null ) return;
        if ( stored.getStatus() != JobStatus.COMPLETED && stored.getStatus() != JobStatus.FAILED ) return;

        for ( Object o : obj.getClassInfo().getAxiomsByClass(PropertyInfo.class) ) {
          PropertyInfo p = (PropertyInfo) o;
          if ( p.isSet(stored) ) p.set(obj, p.get(stored));
          else                   p.clear(obj);
        }
      `
    }
  ]
});
