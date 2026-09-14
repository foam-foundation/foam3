/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailElement',
  extends: 'foam.graphics.CView',

  documentation: `
    Anything drawn on a rail. Holds the parser it stands for, its structural
    path (canvas identity), and two enums the scene assigns from a trace
    snapshot: outcome (what the parser did) and tier (how much attention it
    gets). Every visual derivation is a table lookup in the theme or the enums.
  `,

  requires: [ 'foam.parse.rail.RailTheme' ],

  properties: [
    { name: 'parser', documentation: 'The foam.parse parser this element draws.' },
    {
      name: 'pathIds',
      documentation: 'ParserIds from the strip root (or the enclosing call site, when built inside an unfolded frame) down to this parser. Canvas identity; never the parser object itself.',
      factory: function() { return []; }
    },
    { class: 'String', name: 'pathKey', expression: function(pathIds) { return pathIds.join('/'); } },
    { class: 'Enum', of: 'foam.parse.rail.Outcome', name: 'outcome', factory: function() { return foam.parse.rail.Outcome.NONE; } },
    { class: 'Enum', of: 'foam.parse.rail.Tier',    name: 'tier',    factory: function() { return foam.parse.rail.Tier.LIVE; } },
    { class: 'String',  name: 'consumed', documentation: 'Input text this parser matched in the applied trace (shown in the tooltip).' },
    { class: 'Boolean', name: 'highlighted', documentation: 'Selected from the derivation panel: heavy outline, exempt from fading.' },
    { class: 'Float',   name: 'pulse', documentation: '1 right after a state change, decays to 0; widens the stroke briefly.' },
    {
      name: 'theme',
      documentation: 'A foam.parse.rail.RailTheme; the builder passes one instance to every element.',
      factory: function() { return this.RailTheme.create(); }
    },
    {
      name: 'measure',
      documentation: 'function(text, font) -> px; the builder passes scene.measure, tests pass TextUtil.estimateMeasurer.',
      factory: function() { return foam.graphics.TextUtil.estimateMeasurer(7); }
    },
    {
      class: 'Float',
      name: 'alpha',
      expression: function(tier, highlighted) { return highlighted ? 1 : tier.alpha; }
    },
    {
      class: 'Float',
      name: 'entryY',
      documentation: 'Local y where the incoming track meets this element. Boxes: mid-height. Composites set it in layout().',
      expression: function(height) { return height / 2; }
    }
  ],

  methods: [
    function tipText() {
      var s = this.parser ? this.parser.toString() : this.cls_.name;
      if ( this.consumed ) s += '\nmatched: "' + this.consumed + '"';
      return s;
    },

    function outcomeColor() { return this.theme.outcomeColor(this.outcome); },
    function glyph()        { return this.outcome.glyph; },
    function visited()      { return this.outcome !== foam.parse.rail.Outcome.NONE; },

    function strokeWidth() {
      /** State by weight: highlighted > visited > base, plus the transient pulse. */
      var T = this.theme;
      var base = this.highlighted ? T.STROKE_HIGHLIGHT : this.visited() ? T.STROKE_VISITED : T.STROKE_BASE;
      return base + this.pulse * T.STROKE_PULSE;
    },

    function paintGlyph(ctx) {
      /** Outcome glyph in the reserved left column of a box. */
      var g = this.glyph();
      if ( ! g ) return;
      ctx.font = this.theme.font('glyph'); ctx.fillStyle = this.outcomeColor();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g, this.theme.GLYPH_SLOT / 2 + 3, this.height / 2);
    },

    function paintLabel(ctx, text, opt_color) {
      /** Box label, starting after the glyph column so the two never overlap. */
      var T = this.theme;
      ctx.font = T.font('label'); ctx.fillStyle = opt_color || T.resolve('text');
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, T.GLYPH_SLOT + T.PAD, this.height / 2);
    }
  ]
});
