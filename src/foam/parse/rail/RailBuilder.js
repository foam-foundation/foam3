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
    'foam.parse.rail.RailGeneric',
    'foam.parse.rail.RailSeq',
    'foam.parse.rail.RailStrip',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTerminal',
    'foam.parse.rail.RailTheme'
  ],

  properties: [
    { name: 'grammar', documentation: 'A foam.parse.Grammar (symbols[] of PSymbol {name, parser}).' },
    { name: 'theme',   factory: function() { return this.RailTheme.create(); } },
    { name: 'measure', factory: function() { return foam.graphics.TextUtil.estimateMeasurer(7); } }
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

    function buildStrips() {
      /** One strip per rule, in declaration order. */
      var self = this, ids = foam.parse.rail.ParserIds;
      return this.grammar.symbols.map(function(ps) {
        return self.make(self.RailStrip, {
          name: ps.name, parser: ps.parser, pathIds: [ ids.idOf(ps.parser) ],
          track: self.buildSymbol(ps.name, {}, [])
        });
      });
    },

    function buildSymbol(name, chain, path) {
      /** The track for rule `name`. chain = rule names open above; path = ids of the enclosing call-site chain ([] for a strip). */
      var c = Object.assign({}, chain); c[name] = true;
      return this.build(this.grammar.getSymbol(name), c, path);
    },

    function build(p, chain, path) {
      /** The mapping table. Each PR appends rows; the last row is the never-throw fallback. */
      var self = this, P = foam.parse, L = foam.parse.rail.ParserLabels;
      var here = path.concat(foam.parse.rail.ParserIds.idOf(p));
      var kids = function(arr) { return arr.map(function(a) { return self.build(a, chain, here); }); };
      var el;
      var text = L.terminal(p);
      if      ( text !== null )                        el = this.make(this.RailTerminal, { text: text, badge: L.badge(p) });
      else if ( P.Sequence.isInstance(p) || P.Sequence0.isInstance(p) || P.Sequence1.isInstance(p) )
                                                       el = this.make(this.RailSeq, { items: kids(p.args) });
      else if ( P.Symbol.isInstance(p) )               el = this.make(this.RailSymRef, { name: p.name, builder: this, chain: chain, missing: ! this.hasSymbol(p.name) });
      else                                             el = this.make(this.RailGeneric, { text: p.cls_.name });
      el.parser  = p;
      el.pathIds = here;
      return el;
    }
  ]
});
