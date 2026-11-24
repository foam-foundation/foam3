/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'UploadSinkJobTest',
  extends: 'foam.core.test.JSTest',

  documentation: `UploadSink puts each 2000-row batch as a job of its run's group, one put after
    another, and does not wait on a job. Against a jobDAO that runs the jobs of the group one at a
    time: the jobs are put in order with ids runKey:n, no more than 20 are waiting at once, the
    finish job is put last, sent and processed report the two counts, and a failed batch stops the
    upload and still runs the finish job.`,

  requires: [
    'foam.core.job.Job',
    'foam.core.job.JobStatus',
    'foam.core.job.test.CountingJob',
    'foam.core.reflow.UploadSink',
    'foam.core.reflow.test.UploadTestRow',
    'foam.dao.MDAO'
  ],

  methods: [
    {
      name: 'fakeJobDAO',
      documentation: `A jobDAO backed by a real MDAO, so the sink's group and status queries run
        as written. A timer plays the server: every 10 ms it ends the first job put and not yet
        ended, as a group does, unless hold is set. failIndexes lists the batch numbers that
        end FAILED; the jobs behind a failure end FAILED with "Not run:", except a job with
        runAfterFailure.`,
      code: function(failIndexes) {
        var Status = this.JobStatus;
        var mdao   = this.MDAO.create({ of: this.Job });
        var fake   = {
          order: [], daoKeys: [], hold: false, failedId: null,
          put: async function(job) {
            fake.order.push(job.id);
            fake.daoKeys.push(job.daoKey);
            await mdao.put(job.clone());
            return job;
          },
          where: function(p) { return mdao.where(p); },
          find: function(id) { return mdao.find(id); },
          size: async function() { return (await mdao.select()).array.length; },
          stop: function() { clearInterval(timer); }
        };
        var ended = {};
        var timer = setInterval(async function() {
          if ( fake.hold ) return;
          var id = fake.order.find(i => ! ended[i]);
          if ( ! id ) return;
          ended[id] = true;
          var job = (await mdao.find(id)).clone();
          var n   = Number(id.split(':')[1]);
          if ( fake.failedId && ! job.runAfterFailure ) {
            job.status    = Status.FAILED;
            job.exception = 'Not run: job ' + fake.failedId + ' of this group failed';
          } else if ( failIndexes.indexOf(n) !== -1 ) {
            fake.failedId = id;
            job.status    = Status.FAILED;
            job.exception = 'java.lang.RuntimeException: batch ' + n + ' failed\n\tat some.Frame';
          } else {
            job.status = Status.COMPLETED;
          }
          await mdao.put(job);
        }, 10);
        return fake;
      }
    },
    {
      name: 'makeSink',
      code: function(x, fake, withFinishJob, progress, totalRows) {
        var self = this;
        var vx   = x.createSubContext({ jobDAO: fake });
        return this.UploadSink.create({
          dao: { cmd: function() {} },
          daoKey: 'someDAO',
          isRealUpload: true,
          bulkUpload: true,
          totalRows: totalRows || 0,
          progressCallback: function(processing, p, sent, processed) { if ( progress ) progress.push([ sent, processed ]); },
          finishJob: withFinishJob ? function() {
            return self.CountingJob.create({ tag: 'finish', runAfterFailure: true });
          } : undefined
        }, vx);
      }
    },
    async function feed(sink, n) {
      for ( var i = 0 ; i < n ; i++ ) await sink.put(this.UploadTestRow.create({ id: 'r' + i, name: 'row ' + i }));
    },
    async function runTest(x) {
      var wait = ms => new Promise(r => setTimeout(r, ms));

      // Three full batches and a part batch left for eof, then the finish job.
      var fake = this.fakeJobDAO([]);
      var seen = [];
      var sink = this.makeSink(x, fake, true, seen, 3 * 2000 + 500);
      await this.feed(sink, 3 * 2000 + 500);
      await sink.eof();

      var runKey = fake.order[0].split(':')[0];
      x.test(fake.order.join(' ') === [ 0, 1, 2, 3, 4 ].map(n => runKey + ':' + n).join(' '),
        'three batches, the tail and the finish job are put as runKey:n in order, actual: ' + fake.order.join(' '));
      x.test(fake.daoKeys.slice(0, 4).every(k => k === 'someDAO'), 'a batch job carries the target DAO name');
      x.test(sink.finishJobCompleted, 'the sink says the finish job completed');
      x.test(await fake.size() === 0, 'the jobs of the run are removed when it ends, left: ' + await fake.size());
      var last = seen[seen.length - 1];
      x.test(last[0] === 100 && last[1] === 100, 'sent and processed both reach 100, actual: ' + last);
      x.test(seen.every((s, i) => i === 0 || (s[0] >= seen[i - 1][0] && s[1] >= seen[i - 1][1])), 'sent and processed never go back');
      x.test(seen.some(s => s[1] < s[0]), 'sent runs ahead of processed while the server is behind');
      fake.stop();

      var otherDAO = this.fakeJobDAO([]);
      var other    = this.makeSink(x, otherDAO, false);
      x.test(other.runKey_ !== sink.runKey_, 'two sinks get different run keys');
      otherDAO.stop();

      // The group is the run key, and the finish job asks to run after a failure.
      var f2 = this.fakeJobDAO([]);
      f2.hold = true;
      var s2 = this.makeSink(x, f2, true);
      await this.feed(s2, 10);
      var eofDone = s2.eof();
      await wait(100);
      var finishJob = await f2.find(s2.runKey_ + ':1');
      x.test(finishJob && finishJob.group === s2.runKey_ && finishJob.runAfterFailure,
        'the finish job is in the run group and runs after a failure');
      x.test(f2.order.length === 2, 'a small upload is one batch and the finish job, actual: ' + f2.order.length);
      f2.hold = false;
      await eofDone;
      f2.stop();

      // No finish job: only batches.
      var f3 = this.fakeJobDAO([]);
      var s3 = this.makeSink(x, f3, false);
      await this.feed(s3, 10);
      await s3.eof();
      x.test(f3.order.length === 1 && ! s3.finishJobCompleted, 'without a finish job only the batch is put, actual: ' + f3.order.length);
      f3.stop();

      // The 21st put waits while 20 jobs are not completed.
      var f4 = this.fakeJobDAO([]);
      f4.hold = true;
      var s4 = this.makeSink(x, f4, false);
      var fed = false;
      var feeding = this.feed(s4, 21 * 2000).then(() => { fed = true; });
      await wait(800);
      x.test(f4.order.length === 20, 'twenty batches are put and the 21st waits, actual: ' + f4.order.length);
      x.test(! fed, 'the put of the 21st batch has not returned');
      f4.hold = false;
      await feeding;
      x.test(f4.order.length === 21, 'the 21st batch is put once the server catches up, actual: ' + f4.order.length);
      await s4.eof();
      f4.stop();

      // Batch 1 fails. The next put sees it, the sink puts the finish job, and throws the batch's error.
      var f5 = this.fakeJobDAO([1]);
      var s5 = this.makeSink(x, f5, true);
      var failure = null;
      try {
        await this.feed(s5, 5 * 2000);
        await wait(50);
        await this.feed(s5, 2000);
        await s5.eof();
      } catch (e) { failure = e; }
      x.test(failure && failure.message === 'java.lang.RuntimeException: batch 1 failed',
        'the upload fails with the first line of the failed batch, actual: ' + (failure && failure.message));
      x.test(s5.finishJobCompleted, 'the finish job runs and completes after a failure too');
      x.test(f5.order[f5.order.length - 1] === s5.runKey_ + ':' + (f5.order.length - 1) && f5.order.length < 7,
        'the finish job comes last and no batch is put after the failure, actual: ' + f5.order.length);
      var again = null;
      try { await s5.put(this.UploadTestRow.create({ id: 'late' })); } catch (e) { again = e; }
      x.test(again === failure, 'put keeps throwing the first failure');
      f5.stop();
    }
  ]
});
