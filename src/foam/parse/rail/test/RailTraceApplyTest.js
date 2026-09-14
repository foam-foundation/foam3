/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailTraceApplyTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.Outcome',
    'foam.parse.rail.ParseTrace',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailScene',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.Tier'
  ],

  documentation: 'A snapshot lights elements by structural path; tiers follow the call stack; an unfolded frame sees only activations through its call site; a finished trace renders as a result view.',

  methods: [
    async function runTest(x) {
      var O = this.Outcome, T = this.Tier;
      var g = this.Grammar.create({ symbols: function(seq, sym, literal, alt, eof) {
        return {
          START:   alt(seq(sym('list'), eof()), seq(sym('keyword'), eof())),
          list:    seq(literal('['), sym('ws'), literal(']')),
          ws:      literal(' '),
          keyword: alt(literal('do'), literal('double'))
        };
      } });
      var s = this.RailScene.create({ viewWidth: 600, viewHeight: 400, measure: foam.graphics.TextUtil.estimateMeasurer(7), motion: false });
      var b = this.RailBuilder.create({ grammar: g, theme: s.theme, measure: s.measure });
      s.setStrips(b.buildStrips());
      var find = function(name) { return s.strips.find(function(st) { return st.name === name; }); };

      // Finished, matched "[ ]": result view, everything visited is LIVE, keyword branch NEVER.
      var tr = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: '[ ]' }).record();
      s.applyTrace(tr.at(tr.length()));
      var startAlt = find('START').track;
      x.test(startAlt.items[0].outcome === O.MATCHED && startAlt.items[0].tier === T.LIVE, 'branch 1 matched and live in the result view');
      x.test(startAlt.items[1].outcome === O.NONE && startAlt.items[1].tier === T.NEVER,   'branch 2 never reached: faded');
      x.test(find('ws').runs === 1 && find('ws').matches === 1 && find('ws').outcome === O.MATCHED, 'strip run counters and outcome');
      x.test(find('list').track.items[1].consumed === ' ',                                 'call site knows what it consumed');

      // Mid-trace: while list is on the stack, elements inside the list strip are LIVE, the finished "[" is LIVE, ws idle.
      var midN = tr.nextRuleFrom(tr.nextRuleFrom(1));       // just after "try ws"
      s.applyTrace(tr.at(midN));
      var lst = find('list').track;
      x.test(lst.items[0].outcome === O.MATCHED && lst.items[0].tier === T.LIVE, '"[" matched, live while list is open');
      x.test(lst.items[1].outcome === O.TRYING,                                   'sym(ws) call site is trying');
      x.test(find('ws').track.outcome === O.TRYING && find('ws').track.tier === T.LIVE, 'the ws definition lights while ws is on the stack');

      // After ws is done but list still open: ws definition drops to HISTORY (visited, rule idle).
      var afterWs = tr.stepOverFrom(midN);
      s.applyTrace(tr.at(afterWs));
      x.test(find('ws').track.outcome === O.MATCHED && find('ws').track.tier === T.HISTORY, 'idle rule: its visited elements are history-tier');

      // Unfolded frame: only activations THROUGH the call site light it.
      var tr2 = this.ParseTrace.create({ grammar: g, startSymbol: 'START', input: 'double' }).record();
      var kwRef = startAlt.items[1].items[0];
      x.test(this.RailSymRef.isInstance(kwRef) && kwRef.name === 'keyword', 'found the keyword call site');
      kwRef.unfold();
      s.applyTrace(tr2.at(tr2.length()));
      var innerKw = kwRef.inner;
      x.test(innerKw.items[0].outcome === O.MATCHED && innerKw.items[1].outcome === O.NONE, 'unfolded keyword: "do" matched, "double" never tried');
      x.test(startAlt.items[1].items[1].outcome === O.FAILED,                              'eof after keyword failed');
      x.test(startAlt.items[0].items[1].outcome === O.NONE,                                'the eof singleton under branch 1 stays untouched (path identity)');

      // Clearing.
      s.applyTrace(null);
      var allClear = true;
      s.eachElement(function(el) { if ( el.outcome !== O.NONE || el.tier !== T.LIVE || el.consumed ) allClear = false; });
      x.test(allClear && find('ws').runs === 0, 'applyTrace(null) resets every element and counter');

      // Highlight.
      var hl = s.highlightParser(g.getSymbol('ws'));
      x.test(hl.length === 2 && hl.every(function(el) { return el.highlighted; }), 'highlight lights the definition strip and its call site');
      s.clearHighlight();
      x.test(hl.every(function(el) { return ! el.highlighted; }), 'clearHighlight');

      // Follow: an element outside the viewport pans the camera (motion off = instant).
      s.x = 0; s.y = 0; s.zoom = 1;
      var far = find('keyword');
      far.y = 5000;
      s.revealElement(far.track);
      x.test(s.y < -4000, 'revealElement pans so the element is inside the viewport');
      s.revealElement(far.track);
      var y1 = s.y; s.revealElement(find('START').track);
      x.test(s.y !== y1, 'revealing another element pans again');
    }
  ]
});
