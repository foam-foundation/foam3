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
    it ends.`,

  javaImports: [
    'foam.lang.PropertyInfo'
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Job old = (Job) oldObj;
        if ( ( (Job) obj ).getStatus() != JobStatus.SCHEDULED ) return;
        if ( old.getStatus() != JobStatus.COMPLETED && old.getStatus() != JobStatus.FAILED ) return;

        for ( Object o : obj.getClassInfo().getAxiomsByClass(PropertyInfo.class) ) {
          PropertyInfo p = (PropertyInfo) o;
          if ( p.isSet(oldObj) ) p.set(obj, p.get(oldObj));
          else                   p.clear(obj);
        }
      `
    }
  ]
});
