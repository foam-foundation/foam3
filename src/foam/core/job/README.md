# Job

Server-side execution of long-running, client-initiated tasks, with pollable status.

A task submitted through `DAO.cmd()` runs inside the caller's request and is bounded by the
gateway's one-minute timeout. Work that does not care about that limit — a large match, an
import, a report — is submitted to the `jobDAO` instead. The put returns immediately with a
UUID, the work runs on the server's thread pool, and the submitter polls the job by id to
watch it progress.

## Design

Submitting is an ordinary `put`. Everything after it is wiring:

```
client                jobDAO                        threadPool
  |                     |                                |
  |-- put(job) -------->| GUIDDAO stamps a UUID          |
  |                     | MDAO stores it, SCHEDULED      |
  |                     | foam_core_job_SubmitJob rule --> JobRunner
  |<-- job (+ UUID) ----|                                |  RUNNING   -> put
  |                     |                                |  execute()
  |-- find(id) -------->| RUNNING, 40%                   |  COMPLETED -> put
  |-- find(id) -------->| COMPLETED                      |
```

| File | Role |
|---|---|
| `Job.js` | Base class. Carries the status fields and `save()` / `reportProgress()`. |
| `JobStatus.js` | `SCHEDULED → RUNNING → COMPLETED \| FAILED`. Only the last two are terminal. |
| `JobRunner.js` | The adapter actually submitted to the pool. Owns every status transition. |
| `SubmitJobRuleAction.js` | Rule action that hands a new Job to the pool. |
| `RemoveOldJobsAgent.js` | Retention sweep, run from `cronjobs.jrl`. |
| `services.jrl` | The `jobDAO` CSpec. |
| `rules.jrl`, `ruleGroups.jrl` | The submit-on-create rule and its group. |

Six decisions are worth knowing before changing anything here.

**`Job` is an abstract class, not an interface.** The obvious shape is an interface that a
task implements alongside whatever it already extends. FOAM cannot express that for a stored
type: `foam.INTERFACE` generates no Java `ClassInfo`, `EasyDAO` hard-fails without an `of`
(`foam3/src/foam/dao/EasyDAO.js:960-977`), and `MDAO` indexes through that `of`'s `id`
`PropertyInfo`, which casts (`foam3/src/foam/dao/MDAO.java:195-220`). Interface properties are
installed *per implementor*, so each would get its own `ID` and nothing common to index. Every
storable Job therefore extends `Job`.

**The rule is create-only.** `JobRunner` writes each transition back through the same
`jobDAO`. Were the rule `CREATE_OR_UPDATE`, its own `RUNNING` write would re-submit the job,
forever. `"operation": 0` in `rules.jrl` is the whole guard.

**The rule needs its `RuleGroup` row.** `RulerDAO.updateRuleGroups`
(`foam3/src/foam/core/ruler/RulerDAO.js:366-385`) resolves groups against `ruleGroupDAO` and
logs *"RuleGroup not found. Rules in the group will not be run."* for a miss — silently, with
the rule never firing. That is what `ruleGroups.jrl` is for.

**The client DAO disables caching.** `ClientBuilder` stamps `cache: true` and a five-minute
`ttlPurgeTime` onto every served EasyDAO (`foam3/src/foam/core/client/ClientBuilder.js:32,209-213`).
A polling client would read the same stale job forever, so the `client` block in `services.jrl`
sets `cache: false` explicitly.

**Jobs are in flight, not on record.** `jobDAO` is `NO_JOURNAL`: a Job is a request being
serviced, and does not survive a restart. Anything worth keeping is written by the Job itself,
to a DAO that persists.

**Reads are scoped to the submitter.** A Job carries its own results, so `Job` implements
`Authorizable`: a user reads, updates and deletes only what they submitted, unless they hold
`job.<operation>.*`. `authorizeOnCreate` is deliberately open — `CreatedByAwareDAO` sits
*inside* `AuthorizationDAO` in the EasyDAO chain, so `createdBy` is still unset at create time,
and access to the service itself governs who may submit.

## Usage

### Writing a Job

Extend `Job` and implement `execute`. Nothing else is required — no registration beyond the
POM entry, and no status handling, which is the runner's job.

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'ImportJob',
  extends: 'foam.core.job.Job',

  properties: [
    { class: 'String', name: 'fileId' }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        List<Row> rows = load(x, getFileId());

        for ( int i = 0 ; i < rows.size() ; i++ ) {
          process(x, rows.get(i));
          reportProgress(x, "row " + ( i + 1 ) + " of " + rows.size(), ( i + 1 ) * 100 / rows.size());
        }
      `
    }
  ]
});
```

`reportProgress(x, statusMsg, progress)` sets both fields and publishes them to the `jobDAO`,
so a poller sees them. Call it at whatever granularity is useful — it is one `put` against an
in-memory DAO, but it is not free in a tight loop.

A Job that cannot tell how far along it is should leave `progress` alone. It stays at `-1`,
which reads as *unknown*, not as *0%* — display it accordingly.

Do not set `status`, `exception` or `executionTime` from inside `execute`. `JobRunner` owns
them, and will overwrite whatever you wrote when the job stops. To fail a Job, throw: the
runner records `FAILED` and captures the stack trace into `exception`.

Add the model to a POM with `flags: "js|java"` as usual. `Job` is `js|java` itself, so a Job
can be constructed on the client and executed on the server.

### Submitting and polling

Server side:

```java
ImportJob job = new ImportJob();
job.setFileId(fileId);

String id = ((Job) ((DAO) x.get("jobDAO")).inX(x).put(job)).getId();
```

Client side, where the job is usually built from a form and watched in a dialog:

```javascript
var job = await this.jobDAO.put(this.ImportJob.create({ fileId: fileId }));

while ( true ) {
  job = await this.jobDAO.find(job.id);
  if ( job.status === this.JobStatus.COMPLETED ) break;
  if ( job.status === this.JobStatus.FAILED   ) throw job.exception;
  // show job.statusMsg, and job.progress when it is not -1
  await new Promise(r => setTimeout(r, 500));
}
```

The polled object is the Job itself, so any result the Job left on its own properties comes
back with it. Reaching `jobDAO` from a browser needs the `service.jobDAO` permission granted
to the user's group; that grant is an application concern, not declared here.

`com.paytic.flow.matcher.MatchAgent` is the worked example in this codebase: it extends `Job`,
and names both of its DAOs by key so that it can run detached from the request that submitted
it.

### Concurrency

Jobs run on the `threadPool` agency (`foam3/src/services.jrl:119-129`), shared with the rest of
the server, so concurrency stays bounded and a burst of submissions queues rather than
spawning threads. A Job that blocks holds a pool thread for its whole run — keep genuinely
unbounded waits out of `execute`.

### Retention

The `old jobs` cron in `cronjobs.jrl` runs `RemoveOldJobsAgent` daily. It removes `COMPLETED`
and `FAILED` jobs created longer ago than `maxAge`, which defaults to one day. `SCHEDULED` and
`RUNNING` jobs are never swept, however old, so a Job that outlives the sweep interval is safe.

Change the retention window from the cron's code, which is its configuration point:

```
import foam.core.job.RemoveOldJobsAgent;
agent = new RemoveOldJobsAgent();
agent.setMaxAge(7 * 24 * 60 * 60 * 1000L);
agent.execute(x);
```

### Tests

`test/JobTest.js` covers the contract end to end against the real `jobDAO` — submit latency,
the transitions, progress, the failure path and the retention predicate — using `test/SleepJob.js`
as a stand-in for slow work.

```
./build.sh -W9090 server-tests:JobTest
```
