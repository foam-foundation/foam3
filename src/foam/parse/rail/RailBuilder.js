/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailBuilder',

  documentation: `
    Parser object tree -> rail element tree. A pure factory: the ONE mapping
    table from parser class to element, no registry (the scene walks its own
    tree to find elements, so folding cannot leak). Every element receives the
    builder's theme and measure, and a structural path (pathIds) that is its
    canvas identity.
  `,

  requires: [
    'foam.parse.rail.RailAlt',
    'foam.parse.rail.RailGeneric',
    'foam.parse.rail.RailOptional',
    'foam.parse.rail.RailRepeat',
    'foam.parse.rail.RailSeq',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme'
  ],

  properties: [
    { name: 'grammar', documentation: 'A foam.parse.Grammar (symbols[] of PSymbol {name, parser}).' },
    { name: 'theme',   factory: function() { return this.RailTheme.create(); } },
    { name: 'measure', factory: function() { return foam.graphics.TextUtil.estimateMeasurer(7); } },
    {
      class: 'String',
      name: 'startSymbol',
      documentation: 'Root of the reachability walk: START if the grammar has it, else the first declared rule.',
      factory: function() {
        if ( this.hasSymbol('START') ) return 'START';
        return this.grammar.symbols.length ? this.grammar.symbols[0].name : 'START';
      }
    }
  ],

  methods: [
    function hasSymbol(name) {
      /** Grammar.getSymbol asserts on a miss; the viewer needs a quiet check. */
      return !! this.grammar.symbolMap_[name];
    },

    function make(cls, args) {
      /** Creates an element with the shared theme and measurer. */
      args.theme   = this.theme;
      args.measure = this.measure;
      return cls.create(args);
    },

    function childrenOf(p) {
      /** The parsers a parser delegates to: args (arrays), p, else, delimiter. A plain-object parser (Parsers.cut) has none. */
      if ( ! p || ! p.cls_ ) return [];
      var out = [];
      if ( Array.isArray(p.args) ) out = out.concat(p.args);
      if ( p.p )         out.push(p.p);
      if ( p.else )      out.push(p.else);
      if ( p.delimiter ) out.push(p.delimiter);
      return out;
    },

    function reachableNames() {
      /** Rule names reachable from startSymbol, in first-visit (depth-first, declaration) order. */
      var self = this, seen = [];
      var visit = function(name) {
        if ( seen.indexOf(name) >= 0 || ! self.hasSymbol(name) ) return;
        seen.push(name);
        var walk = function(p) {
          if ( foam.parse.Symbol.isInstance(p) ) { visit(p.name); return; }
          self.childrenOf(p).forEach(walk);
        };
        walk(self.grammar.getSymbol(name));
      };
      visit(this.startSymbol);
      return seen;
    },

    function unreachableNames() {
      var reach = this.reachableNames();
      return this.grammar.symbols.map(function(ps) { return ps.name; })
        .filter(function(n) { return reach.indexOf(n) < 0; })
        .sort();
    },

    function buildReachableStrips(showAll) {
      /** Reachable strips first; with showAll, the unreachable ones follow, flagged, so the divider and the toggle count can show. */
      var strips = this.buildStrips(this.reachableNames());
      if ( ! showAll ) return strips;
      return strips.concat(this.buildStrips(this.unreachableNames()).map(function(s) { s.unreachable = true; return s; }));
    },

    function buildStrips(opt_names) {
      /** One strip per rule name (default: every rule in declaration order). */
      var self = this, ids = foam.parse.rail.ParserIds;
      var names = opt_names || this.grammar.symbols.map(function(ps) { return ps.name; });
      return names.map(function(name) {
        var parser = self.grammar.getSymbol(name);
        return self.make(self.RailStrip, {
          name: name, parser: parser, pathIds: [ ids.idOf(parser) ],
          track: self.buildSymbol(name, {}, [])
        });
      });
    },

    function buildSymbol(name, chain, path) {
      /** The track for rule `name`. chain = rule names open above; path = ids of the enclosing call-site chain ([] for a strip). */
      var c = Object.assign({}, chain); c[name] = true;
      return this.build(this.grammar.getSymbol(name), c, path);
    },

    function badgeFor(p) {
      /** Bounds badge for a Repeat-family parser. Repeat0 extends Repeat, so it is checked first. */
      var P = foam.parse;
      if ( P.Repeat0.isInstance(p) ) return '∅';
      if ( P.Plus.isInstance(p) )    return '×1+';
      return p.minimum ? '×' + p.minimum + '+' : '';
    },

    function build(p, chain, path) {
      /** The mapping table. Each PR appends rows; the last row is the never-throw fallback. */
      var self = this, P = foam.parse, L = foam.parse.rail.ParserLabels;
      var here = path.concat(foam.parse.rail.ParserIds.idOf(p));
      var kids = function(arr) { return arr.map(function(a) { return self.build(a, chain, here); }); };
      var one  = function(q) { return self.build(q, chain, here); };
      var rep  = function() {
        return self.make(self.RailRepeat, { item: one(p.p), delim: p.delimiter ? one(p.delimiter) : null, badge: self.badgeFor(p) });
      };
      var el;
      var text = L.terminal(p);
      if      ( text !== null )                        el = this.make(this.RailTerminal, { text: text, badge: L.badge(p) });
      else if ( P.Alternate.isInstance(p) )            el = this.make(this.RailAlt, { items: kids(p.args) });
      else if ( P.Sequence.isInstance(p) || P.Sequence0.isInstance(p) || P.Sequence1.isInstance(p) )
                                                       el = this.make(this.RailSeq, { items: kids(p.args) });
      else if ( P.Repeat.isInstance(p) )               el = rep();
      else if ( P.Optional.isInstance(p) )             el = this.make(this.RailOptional, { item: one(p.p) });
      else if ( P.Symbol.isInstance(p) )               el = this.make(this.RailSymRef, { name: p.name, builder: this, chain: chain, missing: ! this.hasSymbol(p.name) });
      else                                             el = this.make(this.RailGeneric, { text: p.cls_.name });
      el.parser  = p;
      el.pathIds = here;
      return el;
    }
  ]
});
