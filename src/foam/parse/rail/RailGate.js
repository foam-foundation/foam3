/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailGate',
  extends: 'foam.parse.rail.RailComposite',

  documentation: `
    Procedural lookahead, which textbook railroad has no symbol for. The child
    is framed and dashed because it is TESTED, not consumed. negate (Not):
    a barrier glyph, the parse continues only if the child does NOT match;
    with an else child, that child is parsed after the gate. Peek: the parse
    continues only if the child DOES match, still consuming nothing.
  `,

  constants: {
    BARRIER: '⊘',
    LOOKAHEAD: '⟶?',
    GATE_DASH: [ 3, 3 ]
  },

  properties: [
    { name: 'item' },
    { name: 'elseItem', documentation: 'Not\'s else parser, drawn after the gate; null otherwise.' },
    { class: 'Boolean', name: 'negate', documentation: 'true = Not (barrier), false = Peek (lookahead).' }
  ],

  methods: [
    function parts() { return this.elseItem ? [ this.item, this.elseItem ] : [ this.item ]; },

    function gateGlyph() { return this.negate ? this.BARRIER : this.LOOKAHEAD; },

    function gateWidth() {
      var T = this.theme;
      return this.measure(this.gateGlyph(), T.font('label')) + T.PAD;
    },

    function frameWidth() { return this.gateWidth() + this.item.width + 2 * this.theme.FRAME_PAD; },

    function layout() {
      var T = this.theme, gw = this.gateWidth();
      this.item.x = gw + T.FRAME_PAD;
      this.item.y = T.FRAME_PAD;
      var w = this.frameWidth(), h = this.item.height + 2 * T.FRAME_PAD;
      var entry = T.FRAME_PAD + this.item.entryY;
      if ( this.elseItem ) {
        this.elseItem.x = w + T.GAP;
        this.elseItem.y = entry - this.elseItem.entryY;
        w += T.GAP + this.elseItem.width;
        h = Math.max(h, this.elseItem.y + this.elseItem.height);
      }
      this.width = w; this.height = h; this.entryY = entry;
    },

    function svgSelf(g) {
      var T = this.theme, Tr = foam.parse.rail.Track, E = this.entryY, fw = this.frameWidth();
      var fh = this.item.height + 2 * T.FRAME_PAD;
      // Frame: grey, dashed; the child inside is a test, not a consumption.
      g.start('rect').addClass('gate').attrs({ x: 0.5, y: 0.5, width: Tr.n(fw - 1), height: Tr.n(fh - 1) }).end();
      // Gate glyph on the entry row.
      this.svgText(g, 'gate-glyph', this.gateGlyph(), T.PAD / 2, E);
      this.svgGlyph(g);
      if ( this.elseItem ) this.svgTrack(g, Tr.h(fw, this.elseItem.x, E));
    },

    function isHitTarget() { return true; },

    function tipText() {
      var base = this.SUPER();
      return base + '\n' + ( this.negate ? 'gate: the next input must NOT match the framed part (nothing consumed)'
                                         : 'lookahead: the next input must be next but is not consumed' )
                  + ( this.elseItem ? '; then the part after the gate is parsed' : '' );
    }
  ]
});
