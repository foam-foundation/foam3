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
    COUNTER_DY: 13,         // run counter sits below the name
    LANE_DY: 20,            // value lane baseline below the strip bottom (clear of the bottom box's value tag); the scene adds LANE_GAP to the stacking gap while lanes show
    LANE_GAP: 16,
    LANE_MAX: 90            // lane characters before "…+n more"
  },

  properties: [
    { class: 'String', name: 'name' },
    { class: 'Float',  name: 'labelW', factory: function() { return this.theme.LABEL_W; }, postSet: function() { this.layout(); },
      documentation: 'Width of the rule-name column. The scene sets one shared value so every track starts at the same x.' },
    { name: 'track', documentation: 'The rule body element (any RailElement).' },
    { class: 'Int', name: 'runs',    documentation: 'Finished activations of this rule in the applied trace (attempts).' },
    { class: 'Int', name: 'matches', documentation: 'How many of those matched.' },
    { name: 'values', factory: function() { return []; }, documentation: 'Every text this rule matched in the applied trace, in input order (the lane under the strip).' },
    { name: 'laneEl_' },
    { class: 'Boolean', name: 'unreachable', documentation: 'Not reachable from the start symbol: muted name, "(unreachable)" tag, listed after a divider.' }
  ],

  methods: [
    function parts() { return [ this.track ]; },

    function layout() {
      var T = this.theme;
      this.track.x = this.labelW + T.STUB;
      this.track.y = 0;
      this.width   = this.labelW + T.STUB * 2 + this.track.width;
      this.height  = this.track.height;
      this.entryY  = this.track.entryY;
    },

    function svgSelf(g) {
      var T = this.theme, Tr = foam.parse.rail.Track, E = this.entryY;
      // Flash box behind the name: invisible until the strip pulses (rule entered or exited).
      g.start('path').addClass('flash').attrs({ d: Tr.roundRect(-4, E - this.LABEL_FLASH_DY, this.labelW - 8, 2 * this.LABEL_FLASH_DY, this.LABEL_FLASH_RADIUS) }).end();
      this.svgText(g, 'rule-name', this.name, 0, E).enableClass('muted', this.unreachable);
      if ( this.unreachable ) this.svgText(g, 'counter', '(unreachable)', 0, E + this.COUNTER_DY);
      // Attempts and matches stated separately: the derivation only ever shows matches.
      this.counterEl_ = this.unreachable ? null : this.svgText(g, 'counter', '', 0, E + this.COUNTER_DY);
      // Entry stub, dot; exit stub, bar. Coloured by the outcome.
      this.svgTrack(g, Tr.h(this.labelW, this.track.x, E) + Tr.h(this.track.x + this.track.width, this.width, E), 'stub');
      g.start('circle').addClass('dot').attrs({ cx: Tr.n(this.labelW), cy: Tr.n(E), r: T.TERMINATOR_RADIUS }).end();
      // Under the rule name, not the track, so the row reads as this rule's output and not the next rule's header.
      this.laneEl_ = this.svgText(g, 'lane', '', 0, Math.max(this.height, T.BOX_H) + this.LANE_DY);
      g.start('rect').addClass('end-stop').attrs({ x: Tr.n(this.width - T.END_STOP_W + 1), y: Tr.n(E - T.END_STOP_H / 2), width: T.END_STOP_W, height: T.END_STOP_H }).end();
    },

    function syncState() {
      this.SUPER();
      if ( this.counterEl_ ) this.counterEl_.element_.textContent = this.runs ? 'tried ×' + this.runs + ' · ✓' + this.matches : '';
      if ( this.laneEl_ ) this.laneEl_.element_.textContent = this.laneText();
    },

    function laneText() {
      /** Every value this rule matched, in order, clipped to LANE_MAX characters. */
      var out = '', shown = 0;
      for ( var i = 0 ; i < this.values.length ; i++ ) {
        var v = this.visibleText(this.values[i]) || '∅', next = out ? out + ' · ' + v : v;
        if ( next.length > this.LANE_MAX ) break;
        out = next; shown++;
      }
      var rest = this.values.length - shown;
      return this.values.length ? '⇒ ' + out + ( rest > 0 ? ( out ? ' ' : '' ) + '…+' + rest + ' more' : '' ) : '';
    },

    function isHitTarget() { return true; },

    function tipText() {
      var tag = this.unreachable ? ' · unreachable from the start rule' : '';
      if ( ! this.runs ) return this.name + ' — not tried yet' + tag;
      return this.name + ': tried ' + this.runs + ( this.runs === 1 ? ' time' : ' times' ) + ' so far, '
           + this.matches + ' matched · click to list the matches' + tag;
    }
  ]
});
