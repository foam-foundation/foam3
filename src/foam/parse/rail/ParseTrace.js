/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'ParseTrace',

  documentation: `
    Records one parse of one input through the PStream apply hook, then
    answers "what is true after the first n events?" as a TraceSnapshot,
    computed in ONE walk. Two events per attempt: try on entry, done on exit.
    The start rule is called directly (not through apply), so its pair is
    synthesised here; without it the root never lights. The root's end is the
    stream position the start rule returns, so a parse that stops before the
    end of the input reports how far it got.
  `,

  requires: [ 'foam.parse.StringPStream', 'foam.parse.rail.Runaway', 'foam.parse.rail.TraceSnapshot' ],

  constants: {
    MIN_EVENT_CAP:   10000,   // floor so tiny inputs still get a fair budget
    EVENTS_PER_CHAR: 200      // a real parse is a few events per char
  },

  properties: [
    { name: 'grammar' },
    { class: 'String', name: 'startSymbol', value: 'START' },
    { class: 'String', name: 'input' },
    { name: 'events_', factory: function() { return []; } },
    { name: 'error_' }
  ],

  methods: [
    function record() {
      /** Runs the parse once. Both ways a grammar never finishes are caught so the page survives. */
      var events = [], self = this;
      var cap = Math.max(this.MIN_EVENT_CAP, this.EVENTS_PER_CHAR * this.input.length);
      var apply = function(p, obj) {
        if ( events.length >= cap ) throw self.Runaway.create({ events: events.length });
        var start = this.pos;
        events.push({ type: 'try',  p: p, start: start, end: null });
        var res = p.parse(this, obj);
        events.push({ type: 'done', p: p, start: start, end: res ? res.pos : null });
        return res;
      };
      var startP = this.grammar.getSymbol(this.startSymbol), result, err;
      events.push({ type: 'try', p: startP, start: 0, end: null, root: true });
      try { result = startP.parse(this.StringPStream.create({ apply: apply, str: this.input }), this.grammar); }
      catch (x) { err = this.explain(x, events); }
      events.push({ type: 'done', p: startP, start: 0, end: result ? result.pos : null, root: true });
      this.events_ = events;
      this.error_  = err;
      return this;
    },

    function explain(x, events) {
      /** One human line for a parse-time throw, naming the rule most often left open at the cut. */
      var c = this.busiestOpenRule(events);
      var where = c ? ' · suspect rule: ' + c.name + ' (' + c.open + ' activations still open)' : '';
      if ( this.Runaway.isInstance(x) ) return 'did not terminate: ' + x.events + ' events without finishing — a loop over something that can match nothing?' + where;
      if ( x instanceof RangeError )     return 'did not terminate: call stack overflow — a rule that starts with itself (left recursion)?' + where;
      return 'threw: ' + ( x.message || x );
    },

    function busiestOpenRule(events) {
      var open = new Map(), P = foam.parse;
      events.forEach(function(ev) {
        if ( ! P.Symbol.isInstance(ev.p) ) return;
        open.set(ev.p.name, ( open.get(ev.p.name) || 0 ) + ( ev.type === 'try' ? 1 : -1 ));
      });
      var best = null;
      open.forEach(function(n, name) { if ( n > 0 && ( ! best || n > best.open ) ) best = { name: name, open: n }; });
      return best;
    },

    function length() { return this.events_.length; },

    function stepOverFrom(n) {
      /** If event n-1 is a try, the index just past its matching done; else n+1. */
      var ev = this.events_[n - 1];
      if ( ! ev || ev.type !== 'try' ) return Math.min(this.length(), n + 1);
      var depth = 0;
      for ( var i = n - 1 ; i < this.events_.length ; i++ ) {
        depth += this.events_[i].type === 'try' ? 1 : -1;
        if ( depth === 0 ) return i + 1;
      }
      return this.length();
    },

    function nextRuleFrom(n) {
      /**
       * Index just past the next rule entry at or after event n. A Symbol try is
       * always followed by the try of the rule's body (Symbol.parse applies it at
       * once); the body is what the definition strip is keyed on, so land past both.
       * The synthetic root try already carries the body parser.
       */
      for ( var i = n ; i < this.events_.length ; i++ ) {
        var ev = this.events_[i];
        if ( ev.type !== 'try' ) continue;
        if ( ev.root ) return i + 1;
        if ( foam.parse.Symbol.isInstance(ev.p) ) return Math.min(this.length(), i + 2);
      }
      return this.length();
    },

    function at(n) {
      /** Snapshot after the first n events (clamped). One walk computes everything. */
      var events = this.events_, O = foam.parse.rail.Outcome, ids = foam.parse.rail.ParserIds;
      n = Math.max(0, Math.min(events.length, n));
      var outcomes = new Map(), stack = new Set(), runs = new Map(), matches = new Map();
      var path = [], keys = [], open = [], frames = [];
      var root = null, pos = 0, deepest = -1, rootMatched = false, rootEnd = -1;

      for ( var i = 0 ; i < n ; i++ ) {
        var ev = events[i];
        if ( ev.type === 'try' ) {
          path.push(ids.idOf(ev.p));
          var key = ids.keyOf(path);
          keys.push(key);
          var o = outcomes.get(key) || { parser: ev.p, outcome: O.NONE, start: ev.start, end: null, everMatched: false };
          o.outcome = O.TRYING; o.start = ev.start; o.end = null;
          outcomes.set(key, o);
          stack.add(ev.p);
          open.push(ev.start);
          frames.push({ parser: ev.p, start: ev.start, end: null, kids: [], pending: true, root: !! ev.root });
          pos = ev.start;
        } else {
          var d = outcomes.get(keys.pop());
          path.pop();
          var ok = ev.end !== null;
          if ( ok ) { d.outcome = O.MATCHED; d.end = ev.end; d.everMatched = true; }
          else       d.outcome = d.everMatched ? O.MATCHED : O.FAILED;     // a call site that matched earlier keeps its win
          stack.delete(ev.p);
          runs.set(ev.p, ( runs.get(ev.p) || 0 ) + 1);
          if ( ok ) matches.set(ev.p, ( matches.get(ev.p) || 0 ) + 1);
          open.pop();
          var node = frames.pop();
          node.pending = false; node.end = ev.end;
          if ( ok ) { if ( frames.length ) frames[frames.length - 1].kids.push(node); else root = node; }   // a failed done discards its subtree
          if ( ev.root ) { rootMatched = ok; rootEnd = ok ? ev.end : -1; }
          else if ( ! ok && ev.start > deepest ) deepest = ev.start;
          pos = ok ? ev.end : ev.start;
        }
      }
      for ( var j = frames.length - 1 ; j > 0 ; j-- ) frames[j - 1].kids.push(frames[j]);   // open attempts hang off their parent

      var finished = n === events.length, failed = finished && ! rootMatched, last = n ? events[n - 1] : null;
      return this.TraceSnapshot.create({
        step: n, total: events.length, input: this.input, startSymbol: this.startSymbol,
        finished: finished, matched: finished && rootMatched, matchedTo: finished ? rootEnd : -1,
        pos: failed ? deepest : pos,
        tryStart: open.length ? open[open.length - 1] : -1,
        failPos: failed ? deepest : -1,
        outcomes: outcomes, stack: stack, runs: runs, matches: matches,
        derivation: frames.length ? frames[0] : root,
        lastEvent: last,
        probe: this.probeFor(last),
        error: finished ? this.error_ : null
      });
    },

    function probeFor(ev) {
      /** Terminal under test: the input span it will look at and what it wants. */
      if ( ! ev || ev.type !== 'try' ) return null;
      var P = foam.parse, p = ev.p, len = -1, expects = null;
      if      ( P.Literal.isInstance(p) || P.LiteralIC.isInstance(p) ) { len = p.s.length; expects = '"' + p.s + '"'; }
      else if ( P.Range.isInstance(p) )    { len = 1; expects = p.from + '…' + p.to; }
      else if ( P.Chars.isInstance(p) )    { len = 1; expects = '[' + p.string + ']'; }
      else if ( P.NotChars.isInstance(p) ) { len = 1; expects = '¬[' + p.string + ']'; }
      else if ( P.AnyChar.isInstance(p) )  { len = 1; expects = 'any char'; }
      else if ( P.EOF.isInstance(p) )      { len = 0; expects = 'end of input'; }
      if ( len < 0 ) return null;
      return { start: ev.start, end: Math.min(this.input.length, ev.start + len), expects: expects };
    }
  ]
});
