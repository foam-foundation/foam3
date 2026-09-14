/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailStrip',
  extends: 'foam.parse.rail.RailComposite',

  documentation: `
    A rule definition: name column on the left, entry dot, the track, exit bar.
    The strip's own outcome colours its stubs; the strip never fades (tier is
    applied to the elements on the track). Only the name column is a hit
    target; clicking it lists the rule's runs (trace PR).
  `,

  constants: {
    LABEL_FLASH_DY: 12,     // flash box extends this far above/below the entry row
    LABEL_FLASH_RADIUS: 5,
    COUNTER_DY: 13          // run counter sits below the name
  },

  properties: [
    { class: 'String', name: 'name' },
    { name: 'track', documentation: 'The rule body element (any RailElement).' },
    { class: 'Int', name: 'runs',    documentation: 'Finished activations of this rule in the applied trace (attempts).' },
    { class: 'Int', name: 'matches', documentation: 'How many of those matched.' },
    { class: 'Boolean', name: 'unreachable', documentation: 'Not reachable from the start symbol: muted name, "(unreachable)" tag, listed after a divider.' }
  ],

  methods: [
    function parts() { return [ this.track ]; },

    function layout() {
      var T = this.theme;
      this.track.x = T.LABEL_W + T.STUB;
      this.track.y = 0;
      this.width   = T.LABEL_W + T.STUB * 2 + this.track.width;
      this.height  = this.track.height;
      this.entryY  = this.track.entryY;
    },

    function paintSelf(ctx) {
      var T = this.theme, Tr = foam.parse.rail.Track, E = this.entryY;
      if ( this.pulse > 0 ) {
        // Rule entered or exited this step: soft flash behind the name in the outcome colour, fading out.
        ctx.save();
        ctx.globalAlpha *= this.pulse * T.RULE_LABEL_FLASH_ALPHA;
        ctx.fillStyle = this.outcomeColor();
        Tr.roundRect(ctx, -4, E - this.LABEL_FLASH_DY, T.LABEL_W - 8, 2 * this.LABEL_FLASH_DY, this.LABEL_FLASH_RADIUS);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = this.pulse > 0 ? this.outcomeColor() : T.resolve(this.unreachable ? 'muted' : 'text');
      ctx.font = T.font('ruleName'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(this.name, 0, E);
      if ( this.unreachable ) {
        ctx.font = T.font('badge'); ctx.fillStyle = T.resolve('muted');
        ctx.fillText('(unreachable)', 0, E + this.COUNTER_DY);
      }
      if ( this.runs ) {
        // Attempts and matches stated separately: the derivation only ever shows matches.
        ctx.font = T.font('badge'); ctx.fillStyle = T.resolve('muted');
        ctx.fillText('tried ×' + this.runs + ' · ✓' + this.matches, 0, E + this.COUNTER_DY);
      }
      // Entry stub, dot; exit stub, bar. Coloured by the track's outcome.
      Tr.begin(ctx, this.track.outcomeColor(), T.BRANCH_STROKE);
      Tr.h(ctx, T.LABEL_W, this.track.x, E);
      Tr.h(ctx, this.track.x + this.track.width, this.width, E);
      ctx.stroke();
      ctx.fillStyle = this.track.outcomeColor();
      ctx.beginPath(); ctx.arc(T.LABEL_W, E, T.TERMINATOR_RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(this.width - T.END_STOP_W + 1, E - T.END_STOP_H / 2, T.END_STOP_W, T.END_STOP_H);
    },

    function hitTest(p) {
      /** Only the name column; the track's elements handle themselves. */
      return p.x >= 0 && p.x < this.theme.LABEL_W && p.y >= 0 && p.y < Math.max(this.height, this.theme.BOX_H);
    },

    function tipText() {
      var tag = this.unreachable ? ' · unreachable from the start rule' : '';
      if ( ! this.runs ) return this.name + ' — not tried yet' + tag;
      return this.name + ': tried ' + this.runs + ( this.runs === 1 ? ' time' : ' times' ) + ' so far, '
           + this.matches + ' matched · click to list the matches' + tag;
    }
  ]
});
