/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'ParseTraceTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.Outcome',
    'foam.parse.rail.ParseTrace'
  ],

  documentation: 'Known grammar + input: expected parsers lit, the untaken branch failed, failure position and char right; derivation pruned; runaway grammars fail cleanly; a throwing action still reports.',

  methods: [
    function toy() {
      return this.Grammar.create({ symbols: function(seq, sym, literal, plus, range, repeat, optional, alt, eof) {
        return {
          START:   alt(seq(sym('list'), eof()), seq(sym('keyword'), eof())),
          list:    seq(literal('['), optional(sym('ws')), repeat(sym('item'), seq(optional(sym('ws')), literal(','), optional(sym('ws')))), optional(sym('ws')), literal(']')),
          item:    alt(sym('number'), sym('word'), sym('list')),
          number:  plus(range('0', '9')),
          word:    plus(range('a', 'z')),
          ws:      plus(literal(' ')),
          keyword: alt(literal('do'), literal('double'))
        };
      } });
    },

    function keyOf(parsers) { var I = foam.parse.rail.ParserIds; return I.keyOf(parsers.map(function(p) { return I.idOf(p); })); },

    async function runTest(x) {
      var O = this.Outcome, g = this.toy();

      // Happy path.
      var tr = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: '[1, ab]' }).record();
      x.test(tr.length() > 20 && tr.length() % 2 === 0, 'two events per attempt');
      var end = tr.at(tr.length());
      x.test(end.finished && end.matched && end.pos === 7 && end.failPos === -1, 'finished, matched all 7 chars');
      x.test(end.summary().indexOf('matched all 7 chars') > 0, 'summary states the match');
      var s0 = tr.at(0);
      x.test(! s0.finished && s0.pos === 0 && s0.derivation === null && s0.lastEvent === null, 'step 0: nothing applied');
      x.test(tr.at(1).lastEvent.type === 'try' && tr.at(1).lastEvent.root === true, 'the first event is the synthetic root try');

      // Outcome by activation path: START -> alt -> seq(list, eof) -> sym(list).
      var startP = g.getSymbol('START'), alt = startP, seqList = alt.args[0], symList = seqList.args[0];
      x.test(end.outcomeOf(this.keyOf([ startP, seqList, symList ])) === O.MATCHED, 'sym(list) under branch 1 matched');
      x.test(end.consumedBy(this.keyOf([ startP, seqList, symList ])) === '[1, ab]', 'consumed text for that activation');
      var seqKw = alt.args[1];
      x.test(end.outcomeOf(this.keyOf([ startP, seqKw ])) === O.NONE, 'branch 2 (keyword) never tried on a list input');
      x.test(end.runsOf(g.getSymbol('item')) === 2 && end.matchesOf(g.getSymbol('item')) === 2, 'item ran twice, matched twice');

      // Suffix match: a definition-strip key (rule root only) aggregates activations of that rule.
      var wordP = g.getSymbol('word');
      x.test(end.outcomeOf(this.keyOf([ wordP ])) === O.MATCHED, 'definition key for word aggregates its activation');

      // Ordered-choice trap: "double" lights "do", fails at 2 on eof, "double" never tried.
      var tr2 = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: 'double' }).record();
      var e2 = tr2.at(tr2.length());
      var kwP = g.getSymbol('keyword'), doP = kwP.args[0], doubleP = kwP.args[1], eofP = seqKw.args[1];
      x.test(e2.finished && ! e2.matched && e2.failPos === 2, 'failed at position 2');
      x.test(e2.summary().indexOf('failed at 2 near') > 0, 'summary names the failure position');
      x.test(e2.outcomeOf(this.keyOf([ startP, seqKw, kwP ])) !== undefined, 'keyword key resolves');
      x.test(e2.outcomeOf(this.keyOf([ doP ])) === O.MATCHED && e2.outcomeOf(this.keyOf([ doubleP ])) === O.NONE, '"do" matched, "double" never tried (first match wins)');
      x.test(e2.outcomeOf(this.keyOf([ startP, seqKw, eofP ])) === O.FAILED, 'eof after "do" failed');
      x.test(e2.outcomeOf(this.keyOf([ startP, seqList, eofP ])) === O.NONE, 'the eof singleton under the list branch was never reached (path keys, not object identity)');

      // Derivation pruning: for "double" the "do" under keyword vanishes (its seq failed); nothing matched at the root.
      x.test(e2.derivation && e2.derivation.kids.length === 0 || e2.derivation === null, 'a failed parse leaves no matched derivation subtree');
      var rows = end.derivationRows();
      x.test(rows[0].kind === 'rule' && rows[0].label === 'START' && rows[0].depth === 0, 'rows start at the start rule');
      var leafRows = rows.filter(function(r) { return r.kind === 'leaf'; });
      x.test(leafRows.some(function(r) { return r.label === 'a…z' && r.count === 2 && r.start === 4 && r.end === 6; }), 'consecutive a…z leaves collapse to one row ×2 after hoisting');
      x.test(rows.every(function(r) { return r.kind !== 'rule' || r.label !== 'alt' ; }), 'combinators never appear as rows');
      var wordRows = end.derivationRows(wordP);
      x.test(wordRows.length === 1 && wordRows[0].kind === 'run' && wordRows[0].consumed === 'ab', 'filter by rule lists its runs flat');

      // Probe (character under test) while a terminal is being tried.
      var probeSnap = null;
      for ( var i = 1 ; i <= tr.length() && ! probeSnap ; i++ ) { var s = tr.at(i); if ( s.probe ) probeSnap = s; }
      x.test(probeSnap && probeSnap.probe.start === 0 && probeSnap.probe.end === 1 && probeSnap.probe.expects === '"["', 'first terminal under test is "[" at 0');

      // Gaits.
      var n = 1;                                             // after the root try
      x.test(tr.stepOverFrom(n) === tr.length(),             'step over from the root try lands on the root done');
      x.test(tr.nextRuleFrom(0) === 1 && tr.nextRuleFrom(1) > 1, 'next rule finds the next Symbol try');

      // Runaway (a): loop over an empty match; (b): left recursion.
      var bad1 = this.Grammar.create({ symbols: function(seq, sym, repeat, optional, literal, eof) { return { START: seq(sym('as'), eof()), as: repeat(optional(literal('a'))) }; } });
      var t1 = this.ParseTrace.create({ grammar: bad1, startSymbol: 'START', input: 'b' }).record();
      x.test(t1.error_ && t1.error_.indexOf('did not terminate') === 0 && t1.error_.indexOf('suspect rule: as') > 0, 'event cap names the busiest open rule');
      x.test(t1.length() >= 10000 && t1.at(t1.length()).error === t1.error_, 'partial trace kept and steppable; error surfaces on the finished snapshot');
      var bad2 = this.Grammar.create({ symbols: function(seq, sym, alt, literal, range, eof) { return { START: seq(sym('list'), eof()), list: alt(seq(sym('list'), literal(','), sym('item')), sym('item')), item: range('0', '9') }; } });
      var t2 = this.ParseTrace.create({ grammar: bad2, startSymbol: 'START', input: '1,2' }).record();
      x.test(t2.error_ && t2.error_.indexOf('left recursion') > 0 && t2.error_.indexOf('suspect rule: list') > 0, 'stack overflow is explained as left recursion');
      var rr = t2.at(t2.length()).derivationRows();
      x.test(rr.some(function(r) { return r.recursing && r.count > 100; }), 'a chain of the same rule at the same position collapses to one recursing row');

      // An action that throws still reports.
      var g3 = this.toy(); g3.addAction('number', function() { throw new Error('boom'); });
      var t3 = this.ParseTrace.create({ grammar: g3, startSymbol: 'START', input: '[1]' }).record();
      x.test(t3.error_ === 'threw: boom' && t3.length() > 2, 'action throw is reported and events before it are kept');

      // valuesByParser: every matched activation in input order; a loop's iterations are separate entries.
      var g4 = this.Grammar.create({ symbols: function(seq, sym, literal, plus, eof) {
        return { START: seq(plus(sym('ab')), eof()), ab: seq(literal('a'), literal('b')) };
      } });
      var t4 = this.ParseTrace.create({ grammar: g4, startSymbol: 'START', input: 'abab' }).record();
      var snap = t4.at(t4.length()), ab = g4.getSymbol('ab');
      x.test(snap.valuesOf(ab).join(',') === 'ab,ab', 'rule ab matched twice: ' + snap.valuesOf(ab).join(','));
      x.test(snap.valuesOf(ab.args[0]).join(',') === 'a,a', 'literal a inside the loop: one entry per iteration');
      x.test(snap.valuesOf({}).length === 0, 'unknown parser: empty');
      x.test(snap.valuesByParser() === snap.valuesByParser(), 'the map is cached on the snapshot');
    }
  ]
});
