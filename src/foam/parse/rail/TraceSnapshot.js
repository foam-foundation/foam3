/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'TraceSnapshot',

  documentation: `
    The parse state after the first \`step\` events: a value object built by
    ParseTrace.at(n), read by the scene, ribbon, derivation panel and status
    line, then discarded. Outcomes are keyed by activation path (ids of every
    parser on the stack when the attempt began, outermost first).
  `,

  constants: {
    DESCRIBE_MAX: 60,      // parser description length in the status line
    NEAR_CHARS: 5,         // context each side of the failure position
    CLIP_CHARS: 80         // consumed text shown in the status line before it is clipped
  },

  properties: [
    { class: 'Int',     name: 'step' },
    { class: 'Int',     name: 'total' },
    { class: 'String',  name: 'input' },
    { class: 'String',  name: 'startSymbol' },
    { class: 'Boolean', name: 'finished', documentation: 'step === total.' },
    { class: 'Boolean', name: 'matched',  documentation: 'The start rule succeeded (meaningful once finished).' },
    { class: 'Int',     name: 'pos',      documentation: 'Stream position after the applied events; the failure position once finished and failed.' },
    { class: 'Int',     name: 'tryStart', value: -1, documentation: 'Start of the innermost open attempt, or -1.' },
    { class: 'Int',     name: 'failPos',  value: -1, documentation: 'Deepest failure position, or -1 while unfinished or when matched.' },
    { name: 'outcomes',   documentation: 'Map activation key -> { parser, outcome, start, end, everMatched }.' },
    { name: 'cache_',     factory: function() { return new Map(); } },
    { name: 'valuesCache_' },
    { name: 'stack',      documentation: 'Set of parsers with an open activation (the call stack).' },
    { name: 'runs',       documentation: 'Map parser -> finished activations so far (matched or not).' },
    { name: 'matches',    documentation: 'Map parser -> activations that matched so far.' },
    { name: 'derivation', documentation: 'Pruned match tree { parser, start, end, kids, pending, root } or null.' },
    { name: 'lastEvent' },
    { name: 'probe',      documentation: 'While a terminal is being tried: { start, end, expects }; else null.' },
    { name: 'error',      documentation: 'One-line explanation when the parse did not finish normally; only on the finished snapshot.' }
  ],

  methods: [
    function outcomeAt(pathKey) {
      /**
       * Aggregate over every activation whose key ENDS with pathKey. A definition-strip
       * element (key = its rule root and below) therefore sums all activations of that
       * rule; an element inside an unfolded frame (key through the call site) sees only
       * activations through that call site. Sticky: trying > matched > failed.
       */
      if ( this.cache_.has(pathKey) ) return this.cache_.get(pathKey);
      var O = foam.parse.rail.Outcome;
      var agg = { outcome: O.NONE, start: 0, end: null }, suffix = '/' + pathKey;
      this.outcomes.forEach(function(o, key) {
        if ( key !== pathKey && ! key.endsWith(suffix) ) return;
        if ( o.outcome === O.TRYING ) { agg.outcome = O.TRYING; agg.start = o.start; agg.end = null; return; }
        if ( agg.outcome === O.TRYING ) return;
        if ( o.outcome === O.MATCHED ) { agg.outcome = O.MATCHED; agg.start = o.start; agg.end = o.end; }
        else if ( agg.outcome === O.NONE ) { agg.outcome = O.FAILED; agg.start = o.start; }
      });
      this.cache_.set(pathKey, agg);
      return agg;
    },

    function outcomeOf(pathKey) { return this.outcomeAt(pathKey).outcome; },

    function consumedBy(pathKey) {
      var o = this.outcomeAt(pathKey);
      return o.end !== null ? this.input.substring(o.start, o.end) : '';
    },

    function runsOf(parser)    { return this.runs.get(parser) || 0; },
    function matchesOf(parser) { return this.matches.get(parser) || 0; },
    function isActive(parser)  { return this.stack.has(parser); },

    function summary() {
      /** Two lines: the last event (or the character under test), and the verdict once finished. */
      var ev = this.lastEvent, pr = this.probe;
      var line1 = 'step ' + this.step + '/' + this.total + '  ' + ( ! ev ? '(nothing applied)'
        : pr ? 'checking ' + ( pr.end > pr.start ? '"' + this.input.substring(pr.start, pr.end) + '"' : 'end of input' ) + ' at ' + pr.start + ' · expects ' + pr.expects
        : this.describe(ev) );
      var line2 = ! this.finished ? ''
        : this.error   ? this.error
        : this.matched ? 'matched all ' + this.input.length + ' chars'
        : 'failed at ' + this.failPos + ' near "' + this.input.substring(Math.max(0, this.failPos - this.NEAR_CHARS), this.failPos + this.NEAR_CHARS) + '"';
      return line1 + '\n' + line2;
    },

    function clip(text) {
      /** Consumed text for the status line: a whole document would push the controls off the page. */
      return text.length > this.CLIP_CHARS ? text.substring(0, this.CLIP_CHARS) + '…(' + text.length + ' chars)' : text;
    },

    function describe(ev) {
      var name = ev.root ? this.startSymbol : ev.p.toString();
      if ( name.length > this.DESCRIBE_MAX ) name = name.substring(0, this.DESCRIBE_MAX - 3) + '…';
      if ( ev.type === 'try' ) return 'try  ' + name + ' @' + ev.start;
      return ev.end === null ? '✗    ' + name + ' @' + ev.start
                             : '✓    ' + name + ' ' + ev.start + '→' + ev.end + ' "' + this.clip(this.input.substring(ev.start, ev.end)) + '"';
    },

    function derivationRows(opt_filterParser) {
      /**
       * Flat rows for the derivation panel. Tree mode: rules and terminals only
       * (combinators hoist their children), consecutive leaves of the same terminal
       * collapse (after hoisting), a chain of the same rule re-entered at the same
       * position collapses to one recursing row. Filter mode: every activation of one
       * rule, flat.
       */
      var self = this, L = foam.parse.rail.ParserLabels, rows = [];
      if ( ! this.derivation ) return rows;
      var isRule = function(node) { return node.root || foam.parse.Symbol.isInstance(node.parser); };
      // Explicit stack, pre-order: a left-recursion staircase is thousands of nodes deep, too deep to recurse.
      var todo = [ { node: this.derivation, depth: 0 } ], item, node, depth;
      var pushKids = function(kids, d) { for ( var i = kids.length - 1 ; i >= 0 ; i-- ) todo.push({ node: kids[i], depth: d }); };
      if ( opt_filterParser ) {
        while ( todo.length ) {
          node = todo.pop().node;
          if ( node.parser === opt_filterParser ) rows.push({ parser: node.parser, label: 'run ' + ( rows.length + 1 ), kind: 'run', depth: 0,
            start: node.start, end: node.end, pending: node.pending, count: 1, consumed: node.end !== null ? self.input.substring(node.start, node.end) : '', recursing: false });
          pushKids(node.kids, 0);
        }
        return rows;
      }
      while ( todo.length ) {
        item = todo.pop(); node = item.node; depth = item.depth;
        var label = node.root ? self.startSymbol : L.name(node.parser);
        var childDepth = depth;
        if ( label !== null ) {
          var rule = isRule(node), prev = rows[rows.length - 1];
          // Same terminal, contiguous span, same depth: extend the previous row instead of adding one.
          if ( ! rule && prev && prev.kind === 'leaf' && prev.depth === depth && prev.parser === node.parser && prev.end === node.start && node.end !== null ) {
            prev.count++; prev.end = node.end; prev.consumed = self.input.substring(prev.start, prev.end);
            childDepth = depth + 1;
          } else if ( rule && node.pending && prev && prev.kind === 'rule' && prev.pending && prev.parser === node.parser && prev.start === node.start ) {
            // Left recursion staircase: one row with the count, not a thousand.
            prev.count++; prev.recursing = true; childDepth = prev.depth + 1;
          } else {
            rows.push({ parser: node.parser, label: label, kind: rule ? 'rule' : 'leaf', depth: depth, start: node.start, end: node.end,
              pending: node.pending, count: 1, consumed: rule && node.end !== null ? self.input.substring(node.start, node.end) : '', recursing: false, root: !! node.root });
            childDepth = depth + 1;
          }
        }
        pushKids(node.kids, childDepth);
      }
      return rows;
    },

    function valuesByParser() {
      /**
       * Map parser -> [matched text, ...] in input order, over every matched activation
       * on the path (a loop's iterations are separate entries). One explicit-stack walk,
       * cached on the snapshot: the value tags and rule lanes read it every step.
       */
      if ( this.valuesCache_ ) return this.valuesCache_;
      var out = new Map(), todo = this.derivation ? [ this.derivation ] : [], node, input = this.input;
      while ( todo.length ) {
        node = todo.pop();
        if ( node.parser && node.end !== null && ! node.pending ) {
          var list = out.get(node.parser);
          if ( ! list ) { list = []; out.set(node.parser, list); }
          list.push(input.substring(node.start, node.end));
        }
        for ( var i = node.kids.length - 1 ; i >= 0 ; i-- ) todo.push(node.kids[i]);
      }
      // Pre-order pops children last-first, so each list came out in input order.
      this.valuesCache_ = out;
      return out;
    },

    function valuesOf(parser) {
      return this.valuesByParser().get(parser) || [];
    },

    function spans() {
      /**
       * Rule activations on the path as text spans for the document view:
       * [{ parser, name, start, end, pending, depth }] in pre-order (outer before
       * inner), the start rule itself excluded. A pending span has end null; it is
       * open up to pos. Same collapsing as derivationRows(), so a left-recursion
       * staircase is one span.
       */
      return this.derivationRows().filter(function(r) { return r.kind === 'rule' && ! r.root; }).map(function(r) {
        return { parser: r.parser, name: r.label, start: r.start, end: r.end, pending: r.pending, depth: r.depth };
      });
    }
  ]
});
