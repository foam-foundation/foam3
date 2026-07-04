/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'Perf',
  extends: 'foam.u2.View',

  documentation: `Reflow performance block. Start/Stop captures a PerfReport:
    snapshots at both ends, FPS via requestAnimationFrame, long tasks via
    PerformanceObserver, DOM node deltas, fetch calls (count, size,
    repeats) and console.warn rate. PerfMarkers score the report into a
    colour-coded issues panel; Copy report yields a plain-text summary.
    The report is the block's structured value. The capture methods are
    callable headlessly (no rendered view) - see the loadPerf command.`,

  requires: [
    'foam.core.reflow.perf.PerfReport',
    'foam.core.reflow.perf.PerfSnapshot',
    'foam.core.reflow.perf.PerfSeverity',
    'foam.u2.Tabs',
    'foam.u2.Tab'
  ],

  imports: [ 'window' ],

  messages: [
    { name: 'NO_ISSUES_MSG',    message: 'No issues flagged' },
    { name: 'DEVTOOLS_HINT',    message: 'In-page profiling is off — the server must send the "Document-Policy: js-profiling" response header (then this fills in automatically, no DevTools needed). Meanwhile capture a CPU trace manually via DevTools → Performance.' },
    { name: 'ELAPSED_LABEL',    message: 'Load time' },
    { name: 'AVG_FPS_LABEL',    message: 'Frame rate (avg / min)' },
    { name: 'BLOCKED_LABEL',    message: 'UI frozen' },
    { name: 'LONGEST_LABEL',    message: 'Longest UI freeze' },
    { name: 'HEAP_LABEL',       message: 'Memory change' },
    { name: 'DOM_LABEL',        message: 'Page elements added' },
    { name: 'NETWORK_LABEL',    message: 'Server calls' },
    { name: 'LARGEST_LABEL',    message: 'Largest request sent' },
    { name: 'WARN_LABEL',       message: 'Console warnings' },
    { name: 'CPU_CORES_LABEL',  message: 'CPU cores' },
    { name: 'CONNECTION_LABEL', message: 'Connection' },
    { name: 'NA_MSG',           message: 'n/a' }
  ],

  css: `
    ^ { display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: $textDefault; }

    /* toolbar */
    ^toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

    /* card */
    ^card { border: 1px solid $borderLight; border-radius: 8px; padding: 12px 14px; background: $backgroundDefault; max-width: 100%; overflow-x: auto; }
    ^card-title { text-transform: uppercase; letter-spacing: 0.05em; font-weight: $font-semi-bold; font-size: 11px; color: $textSecondary; margin-bottom: 8px; }

    /* tables: shrink to content so label + value sit together; columns evenly gapped */
    ^ table { border-collapse: collapse; width: auto; }
    ^ th { text-align: left; padding: 3px 28px 3px 0; font-weight: $font-regular; color: $textSecondary; white-space: nowrap; }
    ^ td { padding: 3px 0 3px 28px; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }

    /* issues */
    ^issue-group { margin-bottom: 10px; }
    ^issue-group:last-child { margin-bottom: 0; }
    ^issue-group-title { text-transform: uppercase; letter-spacing: 0.05em; font-weight: $font-semi-bold; font-size: 10px; color: $textTertiary; margin: 0 0 4px 2px; }
    ^issue { display: flex; align-items: baseline; gap: 10px; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid transparent; }
    ^issue:last-child { margin-bottom: 0; }
    ^badge { font-weight: $font-bold; font-size: 11px; white-space: nowrap; min-width: 72px; }
    ^issue-cat { text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; font-weight: $font-semi-bold; color: $textTertiary; white-space: nowrap; min-width: 72px; }
    ^issue-BAD  { background: $destructive50; border-left-color: $destructive500; }
    ^issue-WARN { background: $warn50;        border-left-color: $warn500; }
    ^issue-OK   { background: $success50;     border-left-color: $success500; }
    ^BAD  { color: $destructive500; }
    ^WARN { color: $warn700; }
    ^OK   { color: $success600; }

    /* heatmap chips: tint a value so hot numbers pop */
    ^heat { display: inline-block; padding: 1px 7px; border-radius: 4px; }
    /* metric severity (threshold-based) */
    ^heat-bad  { background: $destructive50; color: $destructive600; font-weight: $font-semi-bold; }
    ^heat-warn { background: $warn50;        color: $warn700; }
    /* per-block relative gradient (share of the column max): cool g1 -> hot g4 */
    ^heat-g1 { background: $warn50;         color: $warn700; }
    ^heat-g2 { background: $warn100;        color: $warn700; }
    ^heat-g3 { background: $destructive50;  color: $destructive600; font-weight: $font-semi-bold; }
    ^heat-g4 { background: $destructive100; color: $destructive700; font-weight: $font-semi-bold; }

    ^env  { color: $textSecondary; font-size: 12px; }
    ^hint { color: $textSecondary; font-style: italic; }
    ^block-row { cursor: pointer; }
    ^block-row:hover { background: $grey50; }
    ^twisty { display: inline-block; width: 12px; color: $textTertiary; }
    ^hot-row td, ^hot-row th { color: $textSecondary; font-size: 12px; padding-left: 22px; }
    ^hot-detailrow > td { padding: 4px 0 8px 22px; }
    ^detail-title { text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; font-weight: $font-semi-bold; color: $textTertiary; margin: 4px 0 2px; }
    ^hot-table { width: auto; }
    ^hot-table th { text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; color: $textTertiary; }
    ^hot-table th, ^hot-table td { text-align: left; padding: 2px 24px 2px 0; font-size: 12px; color: $textSecondary; white-space: nowrap; }
  `,

  constants: {
    SAMPLE_INTERVAL_MS: 10   // JS Self-Profiling sampleInterval; each sample ≈ this many ms of CPU
  },

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.perf.PerfReport',
      name: 'report',
      factory: function() { return this.PerfReport.create({}, this); }
    },
    { class: 'Boolean', name: 'running' },
    // transient run state, not serialized
    { class: 'Int',   name: 'frameCount_',      hidden: true, transient: true },
    { class: 'Float', name: 'frameTotalMs_',    hidden: true, transient: true },
    { class: 'Float', name: 'worstFrameMs_',    hidden: true, transient: true },
    { class: 'Float', name: 'lastFrameTime_',   hidden: true, transient: true },
    { class: 'Float', name: 'longTaskTotalMs_', hidden: true, transient: true },
    { class: 'Float', name: 'longestTaskMs_',   hidden: true, transient: true },
    { class: 'Int',   name: 'warnCount_',       hidden: true, transient: true },
    { name: 'observer_',  hidden: true, transient: true },
    { name: 'netCalls_',  hidden: true, transient: true },
    { name: 'origFetch_', hidden: true, transient: true },
    { name: 'origWarn_',  hidden: true, transient: true },
    { name: 'profiler_',  hidden: true, transient: true }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass();

      // Watch report.elapsedMs (a dot-slot): refires both on report reassignment
      // (Start/Stop) and on copyFrom into the same instance (the loadPerf path).
      this.add(this.dynamic(function(report$elapsedMs) {
        var r = self.report;
        if ( ! r || ! r.endSnapshot ) return;
        // Recommended-action count = service-call groups with identical re-fetches.
        var actions = ( r.serviceCalls || [] ).filter(function(c) { return ( c.count - ( c.distinct || c.count ) ) > 0; }).length;
        var svcLabel   = 'Services' + ( actions ? ' · ' + actions + ' to fix' : '' );
        var issueLabel = 'Issues' + ( ( r.issues || [] ).length ? ' (' + r.issues.length + ')' : '' );
        // Issues first => default selected tab (the summary).
        this.start(self.Tabs)
          .start(self.Tab, { label: issueLabel }).call(function() { self.renderIssues_(this, r); }).end()
          .start(self.Tab, { label: 'Blocks' }).call(function() { self.renderBlocks_(this, r); }).end()
          .start(self.Tab, { label: svcLabel }).call(function() { self.renderServiceCalls_(this, r); }).end()
          .start(self.Tab, { label: 'Metrics' }).call(function() { self.renderMetrics_(this, r); }).end()
        .end();
        self.renderEnv_(this, r);
      }));

      // Copy action at the bottom, below the tabs.
      this.start().addClass(this.myClass('toolbar'))
        .startContext({ data: this })
          .add(this.COPY_REPORT)
        .endContext()
      .end();

      this.onDetach(function() { self.stopCapture_(); });
    },

    function card_(el, title) {
      /** Open a titled card and return it; caller adds content then calls .end(). **/
      var c = el.start().addClass(this.myClass('card'));
      if ( title ) c.start().addClass(this.myClass('card-title')).add(title).end();
      return c;
    },

    function heatCell_(td, text, level) {
      /** Fill a td with a value, tinted as a heat chip ('bad'|'warn') or plain. Ends the td. **/
      if ( level ) td.start('span').addClass(this.myClass('heat'), this.myClass('heat-' + level)).add(text).end();
      else td.add(text);
      td.end();
    },

    function heatLevel_(v, max) {
      /** Relative heat gradient: a value's share of its column max -> g4 (hottest) .. g1,
          or null when negligible. A lone 1 GB block among 100 MB ones lands g4 while the
          rest stay cool. **/
      if ( ! ( max > 0 ) || v <= 0 ) return null;
      var f = v / max;
      return f >= 0.75 ? 'g4' : f >= 0.5 ? 'g3' : f >= 0.25 ? 'g2' : f >= 0.1 ? 'g1' : null;
    },

    function renderIssues_(el, r) {
      var self   = this;
      var issues = r.issues || [];
      var box = self.card_(el);
      if ( ! issues.length ) {
        box.start().addClass(self.myClass('issue'), self.myClass('issue-OK'))
          .start('span').addClass(self.myClass('badge'), self.myClass('OK')).add('✓ OK').end()
          .start('span').add(self.NO_ISSUES_MSG).end()
        .end();
      } else {
        // Grouped by severity (Critical first, then Warning) - category shown as a tag.
        r.groupedIssues().forEach(function(g) {
          var sName = g.severity.name; // 'BAD' | 'WARN'
          var grp = box.start().addClass(self.myClass('issue-group'));
          grp.start().addClass(self.myClass('issue-group-title'), self.myClass(sName))
            .add(g.label + ' (' + g.issues.length + ')')
          .end();
          g.issues.forEach(function(i) {
            grp.start().addClass(self.myClass('issue'), self.myClass('issue-' + sName))
              .start('span').addClass(self.myClass('issue-cat')).add(i.category).end()
              .start('span').add(i.detail).end()
            .end();
          });
          grp.end();
        });
      }
      box.end();
    },

    function renderMetrics_(el, r) {
      var self = this;
      // Colour each row from the issues the markers emitted (single source: the
      // markers own the thresholds; the view just reflects what was flagged).
      var sevByMetric = {};
      ( r.issues || [] ).forEach(function(i) {
        if ( ! i.metric ) return;
        if ( ! sevByMetric[i.metric] || r.severityRank_(i.severity) > r.severityRank_(sevByMetric[i.metric]) )
          sevByMetric[i.metric] = i.severity;
      });

      var card = self.card_(el);
      var el2  = card.start('table');
      var row = function(label, text, metricKey) {
        var sev = metricKey && sevByMetric[metricKey];
        var tr  = el2.start('tr');
        tr.start('th').add(label).end();
        var td = tr.start('td');
        self.heatCell_(td, text, sev ? ( sev === self.PerfSeverity.BAD ? 'bad' : 'warn' ) : null);
        tr.end();
      };
      row(self.ELAPSED_LABEL, r.durStr(r.elapsedMs));
      row(self.AVG_FPS_LABEL, r.numStr(r.avgFps, 0) + ' / ' + r.numStr(r.minFps, 0), 'minFps');
      row(self.BLOCKED_LABEL, r.numStr(r.mainThreadBlockedPct, 0) + ' %', 'mainThreadBlockedPct');
      row(self.LONGEST_LABEL, r.durStr(r.longestTaskMs), 'longestTaskMs');
      row(self.HEAP_LABEL, r.byteStr(r.heapDeltaBytes), 'heapDeltaBytes');
      row(self.DOM_LABEL, r.numStr(r.domNodeDelta, 0) + ( r.tableCellDelta > 0 ? ' (' + r.numStr(r.tableCellDelta, 0) + ' cells)' : '' ), 'domNodeDelta');
      row(self.NETWORK_LABEL, r.numStr(r.networkCallCount, 0) + ' (' + r.numStr(r.repeatedRequestCount, 0) + ' identical)', 'repeatedRequestCount');
      row(self.LARGEST_LABEL, r.byteStr(r.largestRequestBytes), 'largestRequestBytes');
      row(self.WARN_LABEL, r.numStr(r.warnCount, 0), 'warnRate');
      el2.end();
      card.end();
    },

    function renderServiceCalls_(el, r) {
      var self  = this;
      var calls = r.serviceCalls || [];
      if ( ! calls.length ) return;
      // identical re-fetches (cache candidates) = total calls - distinct request bodies.
      var repeatedOf = function(c) { return c.count - ( c.distinct || c.count ); };
      // Only the repeated calls are an issue - heat those; sizes are shown plain.
      var maxRepeated = 0;
      calls.forEach(function(c) { var rep = repeatedOf(c); if ( rep > maxRepeated ) maxRepeated = rep; });
      var card = self.card_(el);
      var t = card.start('table');
      t.start('tr')
        .start('th').add('Service').end()
        .start('th').add('Operation').end()
        .start('td').add('Calls').end()
        .start('td').add('Data sent').end()
        .start('td').add('Data received').end()
        .start('td').add('Recommended action').end()
      .end();
      calls.forEach(function(c) {
        var rep        = repeatedOf(c);
        var variants   = c.variants || [];
        // Only expand when there are DIFFERENT requests to tell apart; a single repeated
        // request is already explained by "N calls · 1 unique" + the cache action.
        var expandable = c.distinct > 1;
        var open$      = foam.lang.SimpleSlot.create({ value: false });

        // Plain "N calls" unless some are repeats - then "N calls · M unique" (rest are dupes).
        var label  = r.numStr(c.count, 0) + ( c.count === 1 ? ' call' : ' calls' );
        if ( rep > 0 ) label += ' · ' + r.numStr(c.distinct, 0) + ' unique';
        var action = rep > 0 ? 'Cache (' + r.numStr(rep, 0) + ' avoidable)' : '—';
        var heat   = rep > 0 ? self.heatLevel_(rep, maxRepeated) : null;

        var tr = t.start('tr').addClass(self.myClass('block-row'));
        if ( expandable ) tr.on('click', function() { open$.set( ! open$.get() ); });
        var th = tr.start('th');
        th.start('span').addClass(self.myClass('twisty'))
          .add( expandable ? open$.map(function(o) { return o ? '▾' : '▸'; }) : '' )
        .end();
        th.add(c.service).end();
        tr.start('th').add(( c.operation || '' ) + ( c.sink ? ' · ' + c.sink : '' )).end();
        // Flag only the issue (identical re-fetches); sizes shown plain.
        self.heatCell_(tr.start('td'), label, heat);
        self.heatCell_(tr.start('td'), r.sizeStr(c.requestBytes),  null);
        self.heatCell_(tr.start('td'), r.sizeStr(c.responseBytes), null);
        self.heatCell_(tr.start('td'), action, heat);
        tr.end();

        // Expand (only when multiple distinct requests): nested table, each distinct
        // request as a row with its own labeled columns so the numbers read clearly.
        if ( expandable ) {
          var vt = t.start('tr').addClass(self.myClass('hot-detailrow')).show(open$)
            .start('td').attrs({ colspan: 6 })
              .start('div').addClass(self.myClass('detail-title')).add('Requests').end()
              .start('table').addClass(self.myClass('hot-table'));
          vt.start('tr')
            .start('th').add('Filter / query').end()
            .start('th').add('Calls').end()
            .start('th').add('Data sent').end()
            .start('th').add('Data received').end()
            .start('th').add('').end()
          .end();
          variants.forEach(function(v) {
            vt.start('tr')
              .start('td').add( v.query || '(no filter)' ).end()
              .start('td').add(r.numStr(v.count, 0)).end()
              .start('td').add(r.sizeStr(v.requestBytes)).end()
              .start('td').add(r.sizeStr(v.responseBytes)).end()
              .start('td').add( v.count > 1 ? r.numStr(v.count, 0) + '× — cacheable' : '' ).end()
            .end();
          });
          vt.end().end().end();
        }
      });
      t.end();
      card.end();
    },

    function renderBlocks_(el, r) {
      var self   = this;
      var blocks = r.blockProfile || [];
      if ( ! blocks.length ) return;
      // Column maxes for relative heat (each column shaded against its own worst).
      var maxMs = 0, maxDom = 0, maxHeap = 0;
      blocks.forEach(function(b) {
        if ( b.ms > maxMs )            maxMs   = b.ms;
        if ( b.domDelta > maxDom )     maxDom  = b.domDelta;
        if ( b.heapDelta > maxHeap )   maxHeap = b.heapDelta;
      });
      var card = self.card_(el);
      var t = card.start('table');
      t.start('tr')
        .start('th').add('Block').end()
        .start('td').add('Time to execute').end()
        .start('td').add('Elements added').end()
        .start('td').add('Memory change').end()
      .end();
      blocks.forEach(function(b) {
        var hot        = b.hot || [];
        var bCalls     = b.calls || [];
        var expandable = hot.length > 0 || bCalls.length > 0;
        var open$      = foam.lang.SimpleSlot.create({ value: false });

        var tr = t.start('tr').addClass(self.myClass('block-row'));
        if ( expandable ) tr.on('click', function() { open$.set( ! open$.get() ); });
        var th = tr.start('th');
        th.start('span').addClass(self.myClass('twisty'))
          .add( expandable ? open$.map(function(o) { return o ? '▾' : '▸'; }) : '' )
        .end();
        th.add(b.flowName).end();
        self.heatCell_(tr.start('td'), r.durStr(b.ms), self.heatLevel_(b.ms, maxMs));
        self.heatCell_(tr.start('td'), r.numStr(b.domDelta, 0),    self.heatLevel_(b.domDelta, maxDom));
        self.heatCell_(tr.start('td'), r.byteStr(b.heapDelta),     self.heatLevel_(b.heapDelta, maxHeap));
        tr.end();

        // Expandable detail: hottest functions and the server calls this block made.
        if ( hot.length ) {
          var ht = t.start('tr').addClass(self.myClass('hot-detailrow')).show(open$)
            .start('td').attrs({ colspan: 4 })
              .start('div').addClass(self.myClass('detail-title')).add('Hottest functions').end()
              .start('table').addClass(self.myClass('hot-table'));
          ht.start('tr')
            .start('th').add('Function').end()
            .start('th').add('Location').end()
            .start('th').add('Time').end()
          .end();
          hot.forEach(function(f) {
            ht.start('tr')
              .start('td').add(f.name).end()
              .start('td').add(r.frameLoc(f)).end()
              .start('td').add(r.durStr(f.ms) + '  (' + r.numStr(f.pct, 0) + '%)').end()
            .end();
          });
          ht.end().end().end();
        }
        if ( bCalls.length ) {
          var ct = t.start('tr').addClass(self.myClass('hot-detailrow')).show(open$)
            .start('td').attrs({ colspan: 4 })
              .start('div').addClass(self.myClass('detail-title')).add('Server calls').end()
              .start('table').addClass(self.myClass('hot-table'));
          ct.start('tr')
            .start('th').add('Service').end()
            .start('th').add('Operation').end()
            .start('th').add('Calls').end()
            .start('th').add('Sent').end()
            .start('th').add('Received').end()
          .end();
          bCalls.forEach(function(c) {
            ct.start('tr')
              .start('td').add(c.service).end()
              .start('td').add(( c.operation || '' ) + ( c.sink ? ' · ' + c.sink : '' )).end()
              .start('td').add(r.numStr(c.count, 0)).end()
              .start('td').add(r.sizeStr(c.requestBytes)).end()
              .start('td').add(r.sizeStr(c.responseBytes)).end()
            .end();
          });
          ct.end().end().end();
        }
      });
      t.end();
      if ( ! r.profilingSupported ) {
        card.start().addClass(self.myClass('hint')).add(self.DEVTOOLS_HINT).end();
      }
      card.end();
    },

    function renderEnv_(el, r) {
      var self = this;
      var end  = r.endSnapshot;
      el.start().addClass(self.myClass('env'))
        .add(self.CPU_CORES_LABEL + ' ' + ( end.hardwareConcurrency || self.NA_MSG ))
        .add(' · ' + self.CONNECTION_LABEL + ' ' + ( end.connectionType || self.NA_MSG ))
        .add(end.deviceMemoryGB ? ' · ' + end.deviceMemoryGB + ' GB' : '')
      .end();
    },

    function takeSnapshot_() {
      return this.PerfSnapshot.create({}, this)
        .capture(this.window.performance, this.window.navigator, this.window.document);
    },

    function startCapture_() {
      /** Begin a capture window. Callable headlessly - no rendered view required. **/
      var self = this;
      this.frameCount_ = this.frameTotalMs_ = this.worstFrameMs_ = this.lastFrameTime_ = 0;
      this.longTaskTotalMs_ = this.longestTaskMs_ = 0;
      this.warnCount_ = 0;
      this.report = this.PerfReport.create({ startSnapshot: this.takeSnapshot_() }, this);

      try {
        this.observer_ = new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(e) {
            self.longTaskTotalMs_ += e.duration;
            if ( e.duration > self.longestTaskMs_ ) self.longestTaskMs_ = e.duration;
          });
        });
        this.observer_.observe({ entryTypes: ['longtask'] });
      } catch (e) { /* longtask unsupported (Firefox/Safari) */ }

      this.wrapFetch_();
      this.wrapWarn_();

      // Buffer the Console's per-block load loop writes into (Console.includeScript).
      if ( this.window ) this.window.__perfCapture__ = [];

      // JS Self-Profiling API: sample the call stack so we can name the hottest
      // functions ourselves, no DevTools. Throws unless the js-profiling document
      // policy is set - then we fall back to the DevTools hint.
      try {
        this.profiler_ = this.window.Profiler ?
          new this.window.Profiler({ sampleInterval: this.SAMPLE_INTERVAL_MS, maxBufferSize: 100000 }) : null;
      } catch (e) { this.profiler_ = null; }

      this.running = true;
      this.window.requestAnimationFrame(this.frameTick);
    },

    async function finishCapture_() {
      /** End the capture window and compute the report. Callable headlessly.
          Async because the JS Self-Profiling API resolves its trace on stop(). **/
      var net    = this.summarizeNetwork_(this.netCalls_ || []);
      var prof   = await this.stopProfile_();          // {supported, trace} - need trace for per-block hot
      var blocks = this.summarizeBlocks_(prof.trace);  // drains buffer, attributes hot fns per block
      this.flushLongTasks_();                          // collect buffered longtasks before disconnect
      this.stopCapture_();
      this.report.endSnapshot = this.takeSnapshot_();
      this.report.finish({
        frameCount:           this.frameCount_,
        frameTotalMs:         this.frameTotalMs_,
        worstFrameMs:         this.worstFrameMs_,
        longTaskTotalMs:      this.longTaskTotalMs_,
        longestTaskMs:        this.longestTaskMs_,
        networkCallCount:     net.networkCallCount,
        largestRequestBytes:  net.largestRequestBytes,
        repeatedRequestCount: net.repeatedRequestCount,
        repeatedRequests:     net.repeatedRequests,
        serviceCalls:         net.serviceCalls,
        warnCount:            this.warnCount_
      });
      this.report.profilingSupported = prof.supported;
      this.report.blockProfile       = blocks;
      return this.report;
    },

    function summarizeBlocks_(trace) {
      /** Drain the per-block capture buffer into PerfBlockCost rows, worst first, each
          carrying its hottest functions and the server calls it made (both bucketed into
          the block's [start,end] window). Trivial blocks are dropped; top 12 kept. **/
      var self     = this;
      var netCalls = this.netCalls_ || [];
      var raw = ( this.window && Array.isArray(this.window.__perfCapture__) ) ? this.window.__perfCapture__ : [];
      if ( this.window ) this.window.__perfCapture__ = null;
      return raw
        .filter(function(b) { return b.ms >= 1 || b.domDelta >= 50 || b.heapDelta >= 1048576; })
        .sort(function(a, b) { return b.ms - a.ms; })
        .slice(0, 12)
        .map(function(b) {
          var inWindow = b.start == null ? [] :
            netCalls.filter(function(c) { return c.t >= b.start && c.t < b.end; });
          return foam.core.reflow.perf.PerfBlockCost.create({
            flowName: b.flowName, cmd: b.cmd, ms: b.ms, domDelta: b.domDelta, heapDelta: b.heapDelta,
            hot:   ( trace && b.start != null ) ? self.framesInWindow_(trace, b.start, b.end, b.ms) : [],
            calls: self.groupServiceCalls_(inWindow)
          });
        });
    },

    function flushLongTasks_() {
      /** PerformanceObserver delivers longtask entries in a later task; pull any still
          buffered before we disconnect, else a long sync task (e.g. a busy loop) is
          missed and the CPU metrics read 0. **/
      if ( ! this.observer_ || ! this.observer_.takeRecords ) return;
      var self = this;
      this.observer_.takeRecords().forEach(function(e) {
        self.longTaskTotalMs_ += e.duration;
        if ( e.duration > self.longestTaskMs_ ) self.longestTaskMs_ = e.duration;
      });
    },

    async function stopProfile_() {
      /** Stop the self-profiler and return the raw trace (bucketed per block later). **/
      if ( ! this.profiler_ ) return { supported: false, trace: null };
      try {
        var trace = await this.profiler_.stop();
        this.profiler_ = null;
        return { supported: true, trace: trace };
      } catch (e) {
        this.profiler_ = null;
        return { supported: false, trace: null };
      }
    },

    function framesInWindow_(trace, start, end, blockMs) {
      /** Hottest leaf frames among samples whose timestamp falls in [start,end).
          Returns top 5 (>=5% of the window), with % within the window and CPU ms.
          ms is the frame's SHARE of the block's wall time (not samples × nominal
          interval - Chrome samples faster than the 10ms hint, which over-counts).
          Drops this tool's own measurement frames. **/
      if ( ! trace || ! trace.samples || ! trace.stacks || ! trace.frames ) return [];
      var self = this;
      var NOISE = { 'Profiler': true, 'querySelectorAll': true, 'now': true, 'takeRecords': true };
      var counts = {}, total = 0;
      trace.samples.forEach(function(s) {
        if ( s.timestamp < start || s.timestamp >= end ) return;
        var stack = trace.stacks[s.stackId];
        if ( ! stack ) return;
        counts[stack.frameId] = ( counts[stack.frameId] || 0 ) + 1;
        total++;
      });
      if ( ! total ) return [];
      var frames = Object.keys(counts).map(function(fid) {
        var f   = trace.frames[fid] || {};
        var res = ( f.resourceId != null && trace.resources ) ? trace.resources[f.resourceId] : '';
        return foam.core.reflow.perf.PerfHotFrame.create({
          name:        f.name || '(anonymous)',
          resource:    res || '',
          line:        f.line || 0,
          column:      f.column || 0,
          selfSamples: counts[fid],
          pct:         100 * counts[fid] / total,
          ms:          ( counts[fid] / total ) * ( blockMs || 0 )
        });
      });
      frames = frames.filter(function(f) { return ! NOISE[f.name] && f.pct >= 5; });
      frames.sort(function(a, b) { return b.selfSamples - a.selfSamples; });
      return frames.slice(0, 5);
    },

    function stopCapture_() {
      this.running = false;
      if ( this.observer_ ) { this.observer_.disconnect(); this.observer_ = null; }
      this.unwrapFetch_();
      this.unwrapWarn_();
      // Discard a still-running profiler (e.g. view detached mid-capture).
      if ( this.profiler_ ) { try { this.profiler_.stop(); } catch (e) {} this.profiler_ = null; }
      // Drop the per-block buffer if capture aborted before summarizeBlocks_ drained it.
      if ( this.window && this.window.__perfCapture__ ) this.window.__perfCapture__ = null;
    },

    function wrapFetch_() {
      /** Record {url, service, op, sink, reqBytes, respBytes, hash} for each fetch. **/
      var self = this, w = this.window;
      if ( ! w || ! w.fetch ) return;
      this.netCalls_  = [];
      this.origFetch_ = w.fetch;
      var orig = this.origFetch_;
      w.fetch = function(input, init) {
        var call = null;
        try {
          // foam's HTTPRequest calls fetch(new Request(url, {body})) - so the body is
          // on the Request object, NOT in init.body. Handle both shapes.
          var url = ( typeof input === 'string' ) ? input : ( input && input.url ) || '';
          // Only DAO / service calls (/service/<name>); skip assets, pages, everything else.
          if ( ! self.isServiceCall_(url) ) return orig.apply(this, arguments);
          call = { url: url, service: self.serviceFromUrl_(url), op: '', sink: '',
                   reqBytes: 0, respBytes: 0, hash: self.hashStr_(url),
                   t: ( w.performance ? w.performance.now() : 0 ) };   // for per-block attribution
          self.netCalls_.push(call);

          var inlineBody = ( init && typeof init.body === 'string' ) ? init.body : null;
          if ( inlineBody != null ) {
            self.recordBody_(call, inlineBody);
          } else if ( input && typeof input.clone === 'function' ) {
            // Request body is a stream; clone + read it without disturbing the real call.
            input.clone().text().then(function(t) { self.recordBody_(call, t || ''); }, function() {});
          }
        } catch (e) { /* never break the real request */ }
        var p = orig.apply(this, arguments);
        if ( call ) {
          // Response wire size from content-length (cheap, no body read).
          p.then(function(resp) {
            try { call.respBytes = parseInt(resp.headers.get('content-length'), 10) || 0; } catch (e) {}
          }, function() {});
        }
        return p;
      };
    },

    function serviceFromUrl_(url) {
      /** Service/DAO = last path segment (PTV3 wires each DAO to /service/<name>). **/
      try {
        var path = ( url || '' ).split('?')[0].replace(/\/+$/, '');
        return path.substring(path.lastIndexOf('/') + 1) || path;
      } catch (e) { return ''; }
    },

    function isServiceCall_(url) {
      /** Only DAO / service RPCs count - they are POSTed to /service/<name>. Everything
          else (static assets, pages, third-party) is ignored. **/
      return ( url || '' ).indexOf('/service/') >= 0;
    },

    function recordBody_(call, bodyStr) {
      /** Fill a call's request size + dedup hash + {op, sink} from its body. **/
      call.reqBytes = bodyStr.length;
      call.hash     = this.hashStr_(call.url + '|' + bodyStr);
      // Deserialize with FOAM's JSON parser (short-name aware) into real FObjects, then
      // read the RPC method + sink type. Skip very large bodies - parsing a multi-MB
      // predicate during the capture we are measuring would skew it (size is the signal there).
      if ( bodyStr.length > 65536 ) return;
      try {
        // The RPCMessage is wrapped: Envelope.message -> SessionedMessage.message -> RPCMessage.
        // Descend the .message chain to the node that carries the method name.
        var node = JSON.parse(bodyStr);
        while ( node && node.message && ! node.name ) node = node.message;
        if ( ! node || ! node.name ) return;
        // FOAM-parse just that RPCMessage subtree (short-name aware, typed sink; no replyBox).
        var msg = foam.json.parse(node, null, this.__context__);
        var op  = ( msg && msg.name ) || node.name;
        if ( op.endsWith && op.endsWith('_') ) op = op.slice(0, -1);   // 'select_' -> 'select'
        call.op = op;
        var args = ( msg && msg.args ) || [];
        for ( var i = 0 ; i < args.length ; i++ ) {
          if ( foam.dao.Sink.isInstance(args[i]) ) { call.sink = args[i].cls_.name; break; }
        }
        // Query descriptor for the expand view: the predicate if any (select_ arg 5),
        // else the id being fetched/written - so two calls can be compared by what they ask for.
        // Describe the query: predicate + order + non-default limit/skip (so two selects
        // that differ only by ordering or paging are distinguishable in the variant list).
        var parts = [];
        var pred  = foam.mlang.predicate.Predicate.isInstance(args[5]) ? args[5] : null;
        if ( pred && pred.toMQL ) { var mql = pred.toMQL(); if ( mql ) parts.push(mql); }
        if ( args[4] && args[4].cls_ ) parts.push('order by ' + this.prettyOrder_(args[4]));
        if ( typeof args[3] === 'number' && args[3] < 9007199254740991 ) parts.push('limit ' + args[3]);
        if ( typeof args[2] === 'number' && args[2] > 0 ) parts.push('skip ' + args[2]);
        if ( ! parts.length && op === 'find' && args[1] != null ) parts.push('id = ' + args[1]);
        var q = parts.join('  ·  ');
        call.query = q.length > 160 ? q.substring(0, 157) + '…' : q;
      } catch (e) { /* unparseable - leave op/sink blank */ }
    },

    function prettyOrder_(o) {
      /** Render an MLang order readably: 'field' (asc), 'field desc', comma-joined for ThenBy.
          Uses isInstance (typed) rather than class-name strings. **/
      if ( o == null ) return '';
      if ( foam.mlang.order.Desc.isInstance(o) )   return this.prettyOrder_(o.arg1) + ' desc';
      if ( foam.mlang.order.ThenBy.isInstance(o) ) return this.prettyOrder_(o.head) + ', ' + this.prettyOrder_(o.tail);
      if ( o.name ) return o.name;   // a property = ascending
      return o.cls_ ? o.toString() : String(o);
    },

    function unwrapFetch_() {
      if ( this.origFetch_ ) { this.window.fetch = this.origFetch_; this.origFetch_ = null; }
    },

    function wrapWarn_() {
      var self = this, w = this.window;
      if ( ! w || ! w.console || ! w.console.warn ) return;
      this.origWarn_ = w.console.warn;
      var orig = this.origWarn_;
      w.console.warn = function() { self.warnCount_++; return orig.apply(this, arguments); };
    },

    function unwrapWarn_() {
      if ( this.origWarn_ ) { this.window.console.warn = this.origWarn_; this.origWarn_ = null; }
    },

    function groupServiceCalls_(calls) {
      /** Group calls by service+operation+sink into PerfServiceCall[] (with per-body
          variants), most-called first. Shared by the global table and per-block attribution. **/
      var byService = {};
      calls.forEach(function(c) {
        var key = ( c.service || '?' ) + '|' + ( c.op || '' ) + '|' + ( c.sink || '' );
        var g = byService[key] || ( byService[key] = { service: c.service || '?', operation: c.op || '', sink: c.sink || '', count: 0, requestBytes: 0, responseBytes: 0, variants_: {} } );
        g.count++;
        g.requestBytes  += c.reqBytes || 0;
        g.responseBytes += c.respBytes || 0;
        var v = g.variants_[c.hash] || ( g.variants_[c.hash] = { count: 0, requestBytes: 0, responseBytes: 0, query: c.query || '' } );
        v.count++;
        v.requestBytes  += c.reqBytes || 0;
        v.responseBytes += c.respBytes || 0;
      });
      return Object.keys(byService).map(function(k) {
        var g = byService[k];
        var variants = Object.keys(g.variants_).map(function(h) {
          return foam.core.reflow.perf.PerfRequestVariant.create(g.variants_[h]);
        }).sort(function(a, b) { return b.count - a.count; });
        g.distinct = variants.length;
        g.variants = variants;
        delete g.variants_;
        return foam.core.reflow.perf.PerfServiceCall.create(g);
      }).sort(function(a, b) { return b.count - a.count || b.responseBytes - a.responseBytes; });
    },

    function summarizeNetwork_(calls) {
      /** Totals, largest, exact-dup repeats by (url,body) hash, and the grouped service table. **/
      var byHash = {}, largest = 0;
      calls.forEach(function(c) {
        if ( c.reqBytes > largest ) largest = c.reqBytes;
        var h = byHash[c.hash] || ( byHash[c.hash] = { url: c.url, count: 0, requestBytes: c.reqBytes } );
        h.count++;
      });

      var repeats = [], redundant = 0;
      Object.keys(byHash).forEach(function(k) {
        var g = byHash[k];
        if ( g.count > 1 ) { repeats.push(foam.core.reflow.perf.PerfRepeatedRequest.create(g)); redundant += g.count - 1; }
      });
      repeats.sort(function(a, b) { return b.count - a.count; });

      return {
        networkCallCount:     calls.length,
        largestRequestBytes:  largest,
        repeatedRequestCount: redundant,   // total identical re-fetches (Σ count-1); matches the service table
        repeatedRequests:     repeats,
        serviceCalls:         this.groupServiceCalls_(calls)
      };
    },

    function hashStr_(s) {
      /** Small 32-bit string hash (djb2-ish) for deduping identical requests. **/
      var h = 5381;
      for ( var i = 0 ; i < s.length ; i++ ) h = ( ( h << 5 ) + h + s.charCodeAt(i) ) | 0;
      return h;
    }
  ],

  actions: [
    {
      name: 'copyReport',
      label: 'Copy report',
      isEnabled: function(running) { return ! running; },
      code: async function() {
        var text = this.report.toReport();
        // Append the same system info the `info` command shows (shared buildText).
        try { text += '\n' + await foam.core.reflow.cmd.Info.buildText(this.__context__); } catch (e) { /* info unavailable */ }
        try {
          if ( this.window.navigator.clipboard ) this.window.navigator.clipboard.writeText(text);
        } catch (e) { /* clipboard blocked - report text still available via toReport() */ }
      }
    }
  ],

  listeners: [
    {
      name: 'frameTick',
      code: function() {
        if ( ! this.running ) return;
        var t = this.window.performance.now();
        if ( this.lastFrameTime_ ) {
          var dt = t - this.lastFrameTime_;
          this.frameCount_++;
          this.frameTotalMs_ += dt;
          if ( dt > this.worstFrameMs_ ) this.worstFrameMs_ = dt;
        }
        this.lastFrameTime_ = t;
        this.window.requestAnimationFrame(this.frameTick);
      }
    }
  ]
});
