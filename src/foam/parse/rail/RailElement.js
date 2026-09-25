/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailElement',
  extends: 'foam.parse.rail.RailNode',

  documentation: `
    Anything drawn on a rail. Holds the parser it stands for, its structural
    path (identity across rebuilds), and two enums the scene assigns from a
    trace snapshot: outcome (what the parser did) and tier (how much attention
    it gets). Rendering is SVG: svg(g) emits this element's shapes into a u2
    <g> and recurses into the children; syncState() rewrites the class list
    and the outcome glyph, so a trace step touches attributes, never structure.
    Colours, fonts and stroke weights are CSS rules the scene generates from
    the theme, keyed on those classes.
  `,

  requires: [ 'foam.parse.rail.RailTheme' ],

  properties: [
    { name: 'parser', documentation: 'The foam.parse parser this element draws.' },
    {
      name: 'pathIds',
      documentation: 'ParserIds from the strip root (or the enclosing call site, when built inside an unfolded frame) down to this parser. Identity; never the parser object itself.',
      factory: function() { return []; }
    },
    { class: 'String', name: 'pathKey', expression: function(pathIds) { return pathIds.join('/'); } },
    { class: 'Enum', of: 'foam.parse.rail.Outcome', name: 'outcome', factory: function() { return foam.parse.rail.Outcome.NONE; } },
    { class: 'Enum', of: 'foam.parse.rail.Tier',    name: 'tier',    factory: function() { return foam.parse.rail.Tier.LIVE; } },
    { class: 'String',  name: 'consumed', documentation: 'Input text this parser matched in the applied trace (shown in the tooltip).' },
    { class: 'Boolean', name: 'highlighted', documentation: 'Selected from the derivation panel: heavy outline, exempt from fading.' },
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
    { class: 'Int', name: 'matchCount', documentation: 'Matched activations of this element\'s parser in the applied trace.' },
    { name: 'values', factory: function() { return []; }, documentation: 'Every text this element\'s parser matched, in input order; the value tag lists them.' },
    { name: 'valueEl_',  documentation: 'The <text> under a box showing the last value it matched, when the element draws one.' },
    { name: 'g_',       documentation: 'The u2 <g> this element last rendered into, or undefined.' },
    { name: 'glyphEl_', documentation: 'The <text> carrying the outcome glyph, when this element draws one.' },
    { name: 'pulseTimer_' },
    { class: 'String', name: 'railId', documentation: 'data-rail attribute value; set by the scene for elements with a tooltip or click.' }
  ],

  constants: {
    VALUE_DY:  8,       // value tag baseline below the box bottom
    VALUE_MAX: 24       // value tag characters before "…+n"
  },

  methods: [
    function visibleText(s) {
      /** Whitespace made visible so a match of "  " is not an empty tag. */
      return s.replace(/ /g, '␣').replace(/\n/g, '⏎').replace(/\t/g, '⇥').replace(/\r/g, '');
    },

    function valueText() {
      /** What the value tag shows: every matched text in input order, clipped to VALUE_MAX characters with "…+n" for the rest. */
      var out = '', shown = 0, max = this.VALUE_MAX;
      for ( var i = 0 ; i < this.values.length ; i++ ) {
        var v = this.visibleText(this.values[i]) || '∅';
        if ( v.length > max ) v = v.substring(0, max - 1) + '…';
        var next = out ? out + ' · ' + v : v;
        if ( next.length > max && shown ) break;
        out = next; shown++;
      }
      var rest = this.values.length - shown;
      return out + ( rest > 0 ? ' …+' + rest : '' );
    },

    function svgValue(g) {
      /** Value tag under the box; text follows the trace through syncState(). */
      var Tr = foam.parse.rail.Track;
      this.valueEl_ = g.start('text').addClass('value').attrs({ x: Tr.n(0), y: Tr.n(this.height + this.VALUE_DY) });
      this.valueEl_.end();
    },

    function tipText() {
      var s = this.parser ? this.parser.toString() : this.cls_.name;
      if ( this.consumed ) s += '\nmatched: "' + this.consumed + '"';
      return s;
    },

    function outcomeColor() { return this.theme.outcomeColor(this.outcome); },
    function glyph()        { return this.outcome.mark; },
    function visited()      { return this.outcome !== foam.parse.rail.Outcome.NONE; },
    function isHitTarget()  { return true; },

    // ---- SVG ------------------------------------------------------------

    function svg(g) {
      /** Emits this element into g (a u2 element in the SVG namespace), then its children in their own translated groups. */
      this.g_ = g;
      this.glyphEl_ = undefined;
      this.valueEl_ = undefined;
      if ( this.isHitTarget() && this.railId ) g.attrs({ 'data-rail': this.railId });
      g.on('animationend', function(e) { if ( e.target.parentNode === g.element_ ) g.element_.classList.remove('pulse'); });
      this.svgSelf(g);
      this.svgChildren(g);
      this.syncState();
      return g;
    },

    function svgSelf(g) {},

    function svgChildren(g) {
      var Tr = foam.parse.rail.Track;
      this.children.forEach(function(c) {
        var cg = g.start('g').attrs({ transform: 'translate(' + Tr.n(c.x) + ' ' + Tr.n(c.y) + ')' });
        c.svg(cg);
        cg.end();
      });
    },

    function stateClasses() {
      /** Class list the theme stylesheet keys on: outcome, tier, visited, highlighted. */
      return 'rail-el outcome-' + this.outcome.name + ' tier-' + this.tier.name
           + ( this.visited()    ? ' visited'     : '' )
           + ( this.highlighted  ? ' highlighted' : '' )
           + this.extraClasses();
    },

    function extraClasses() { return ''; },

    function syncState() {
      /** Rewrites the class list and the glyph text; the structure stays. */
      if ( ! this.g_ ) return;
      var el = this.g_.element_, pulsing = el.classList.contains('pulse');   // a running pulse survives the rewrite
      el.setAttribute('class', this.stateClasses() + ( pulsing ? ' pulse' : '' ));
      if ( this.glyphEl_ ) this.glyphEl_.element_.textContent = this.glyph() || '';
      if ( this.valueEl_ ) this.valueEl_.element_.textContent = this.valueText();
    },

    function pulse() {
      /** Restarts the CSS stroke-swell animation on this element's group. */
      var el = this.g_ && this.g_.element_;
      if ( ! el ) return;
      el.classList.remove('pulse');
      void el.getBoundingClientRect();     // flush so re-adding the class restarts the keyframes
      el.classList.add('pulse');
      // Fallback for a group with nothing to animate (no animationend ever fires).
      clearTimeout(this.pulseTimer_);
      this.pulseTimer_ = setTimeout(function() { el.classList.remove('pulse'); }, 800);
    },

    function svgBox(g, w, h, r, cls) {
      /** Rounded box outline+fill in the box style; the outcome class colours the stroke. */
      var Tr = foam.parse.rail.Track;
      g.start('path').addClass('box').addClass(cls || 'terminal').attrs({ d: Tr.roundRect(0, 0, w, h, r) }).end();
    },

    function svgLabel(g, text, opt_muted) {
      /** Box label, starting after the glyph column so the two never overlap. */
      var T = this.theme, Tr = foam.parse.rail.Track;
      g.start('text').addClass('label').enableClass('muted', !! opt_muted)
        .attrs({ x: Tr.n(T.GLYPH_SLOT + T.PAD), y: Tr.n(this.height / 2) }).add(text).end();
    },

    function svgGlyph(g) {
      /** Outcome glyph in the reserved left column of a box; text follows the outcome through syncState(). */
      var T = this.theme, Tr = foam.parse.rail.Track;
      this.glyphEl_ = g.start('text').addClass('glyph').attrs({ x: Tr.n(T.GLYPH_SLOT / 2 + 3), y: Tr.n(this.height / 2) });
      this.glyphEl_.end();
    },

    function svgText(g, cls, text, x, y, opt_anchor) {
      var Tr = foam.parse.rail.Track;
      var t = g.start('text').addClass(cls).attrs({ x: Tr.n(x), y: Tr.n(y) });
      if ( opt_anchor ) t.attrs({ 'text-anchor': opt_anchor });
      t.add(text).end();
      return t;
    },

    function svgTrack(g, d, cls) {
      /** One stroked path in the track style (composites connect their parts with these). */
      g.start('path').addClass(cls || 'track').attrs({ d: d }).end();
    }
  ]
});
