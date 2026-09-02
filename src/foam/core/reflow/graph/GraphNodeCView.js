/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphNodeCView',
  extends: 'foam.graphics.Box',

  documentation: `
    Paints a single Reflow block as a card in the canvas graph: a kind-
    coloured top bar, a renders/silent status dot, a truncated title with
    right-aligned status badges, up to a few lines of summary text, and
    left/right connection ports. Purely a painter — selection, dragging,
    and layout are the scene's responsibility; this CView only reflects
    the state it's given through its properties.
  `,

  constants: [
    { type: 'Int', name: 'CARD_W',    value: 240 },
    { type: 'Int', name: 'HEADER_H', value: 28 },
    { type: 'Int', name: 'LINE_H',   value: 16 },
    { type: 'Int', name: 'PAD',      value: 8 },
    { type: 'Int', name: 'BAR_H',    value: 4 },
    { type: 'Int', name: 'PORT_Y',   value: 18 },
    { type: 'Int', name: 'PORT_R',   value: 5 },
    { type: 'Int', name: 'DOT_R',    value: 4 }
  ],

  properties: [
    {
      name: 'block',
      documentation: 'The underlying Flowable this card represents, if any.'
    },
    {
      class: 'String',
      name: 'id',
      documentation: 'Positional node id from DependencyScanner (unique even when name is duplicated); the FlowGraphView identity key.'
    },
    { class: 'String', name: 'name', documentation: 'The block\'s flowName, for display only.' },
    {
      class: 'String',
      name: 'kind',
      documentation: 'The value class\'s BLOCK_KIND, or "block" when it has none. Picks the GraphTheme.kinds colour; a kind the theme does not name takes the block colour.'
    },
    {
      class: 'StringArray',
      name: 'summary',
      documentation: 'Up to a few lines of summary text, pre-truncated by the caller to roughly 60 chars each.'
    },
    { name: 'theme', documentation: 'A foam.core.reflow.graph.GraphTheme.' },
    { class: 'Boolean', name: 'isSelected' },
    { class: 'Boolean', name: 'isDependent' },
    { class: 'Boolean', name: 'dimmed' },
    { class: 'Boolean', name: 'renders', value: true },
    { class: 'Boolean', name: 'hidden' },
    { class: 'Boolean', name: 'locked' },
    { class: 'String', name: 'error' },
    { class: 'Boolean', name: 'hasIn' },
    { class: 'Boolean', name: 'hasOut' },
    {
      name: 'badgesLeftX_',
      documentation: 'Left edge of the header badge cluster, in local coordinates, recorded by the last paintSelf() so tooltipAt() can hit-test it without re-measuring text.',
      hidden: true,
      transient: true,
      value: 0
    },
    {
      class: 'Float',
      name: 'width',
      factory: function() { return this.CARD_W; }
    },
    {
      class: 'Float',
      name: 'height',
      expression: function(summary) {
        return this.cls_.heightFor(summary ? summary.length : 0);
      }
    },
    {
      class: 'Float',
      name: 'alpha',
      expression: function(dimmed) { return dimmed ? 0.2 : 1; }
    }
  ],

  methods: [
    function paintSelf(ctx) {
      var theme = this.theme;
      var t     = theme ? theme.colors : {};
      var f     = theme ? theme.fonts  : {};
      var w     = this.width, h = this.height;

      ctx.save();
      if ( this.hidden ) ctx.globalAlpha *= 0.7;

      // Card background.
      this.roundRect(ctx, 0, 0, w, h, 6);
      ctx.fillStyle = ( this.hidden || ! this.renders ) ? t.silentBg : t.nodeBg;
      ctx.fill();

      // Card border.
      var borderColor = this.error       ? t.error :
                         this.isSelected  ? t.selected :
                         this.isDependent ? t.dependent :
                         t.nodeBorder;
      ctx.lineWidth   = ( this.isSelected || this.isDependent ) ? 3 : 1;
      ctx.strokeStyle = borderColor;
      ctx.setLineDash(this.hidden ? [4, 4] : []);
      this.roundRect(ctx, 0, 0, w, h, 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // Kind bar along the top, clipped to the card's rounded corners.
      ctx.save();
      this.roundRect(ctx, 0, 0, w, h, 6);
      ctx.clip();
      ctx.fillStyle = ( t.kinds && ( t.kinds[this.kind] || t.kinds.block ) ) || t.nodeBorder;
      ctx.fillRect(0, 0, w, this.BAR_H);
      ctx.restore();

      // Renders/silent status dot.
      var dotX = this.PAD + this.DOT_R;
      var dotY = this.BAR_H + this.HEADER_H / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, this.DOT_R, 0, Math.PI * 2);
      if ( this.renders ) {
        ctx.fillStyle = t.renders;
        ctx.fill();
      } else {
        ctx.lineWidth   = 1;
        ctx.strokeStyle = t.textMuted;
        ctx.stroke();
      }

      // Header badges, right-aligned, drawn right-to-left.
      var badges = [ this.kind.toUpperCase() ];
      if ( this.hidden ) badges.push(this.HIDDEN.toUpperCase());
      if ( ! this.renders && ! this.hidden ) badges.push(this.SILENT.toUpperCase());
      if ( this.locked ) badges.push(this.LOCKED.toUpperCase());

      ctx.font        = f.badge;
      ctx.textAlign   = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = t.textMuted;
      var bx = w - this.PAD;
      for ( var i = 0 ; i < badges.length ; i++ ) {
        ctx.fillText(badges[i], bx, dotY);
        bx -= ctx.measureText(badges[i]).width + 6;
      }
      this.badgesLeftX_ = bx + 6;

      // Title, truncated to the space left of the badges.
      var titleX    = this.PAD + this.DOT_R * 2 + 6;
      var titleMaxW = Math.max(0, this.badgesLeftX_ - titleX - 8);
      ctx.font        = f.title;
      ctx.textAlign   = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = this.error ? t.error : this.isSelected ? t.selected : t.text;
      var title = foam.core.reflow.dashboard.CanvasTextUtil.truncate(ctx, this.name || '', f.title, titleMaxW);
      ctx.fillText(title, titleX, dotY);

      // Summary lines.
      ctx.font        = f.body;
      ctx.textAlign   = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle   = t.textMuted;
      var maxW = w - 2 * this.PAD;
      for ( var i = 0 ; i < ( this.summary || [] ).length ; i++ ) {
        var line = foam.core.reflow.dashboard.CanvasTextUtil.truncate(ctx, this.summary[i], f.body, maxW);
        ctx.fillText(line, this.PAD, this.BAR_H + this.HEADER_H + this.PAD + i * this.LINE_H + 12);
      }

      // Connection ports.
      ctx.fillStyle = this.hasIn ? t.portActive : t.port;
      ctx.beginPath();
      ctx.arc(0, this.PORT_Y, this.PORT_R, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.hasOut ? t.portActive : t.port;
      ctx.beginPath();
      ctx.arc(w, this.PORT_Y, this.PORT_R, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },

    function tooltipAt(p) {
      var dotX = this.PAD + this.DOT_R;
      var dotY = this.BAR_H + this.HEADER_H / 2;
      var dx = p.x - dotX, dy = p.y - dotY;
      var r = this.DOT_R + 3;
      if ( dx * dx + dy * dy <= r * r ) {
        return this.renders ? this.TIP_RENDERS : this.TIP_SILENT;
      }

      if ( p.y >= 0 && p.y <= this.BAR_H + this.HEADER_H && p.x >= this.badgesLeftX_ ) {
        return this.error || null;
      }

      return null;
    }
  ],

  messages: [
    { name: 'HIDDEN',         message: 'Hidden' },
    { name: 'SILENT',         message: 'No output' },
    { name: 'LOCKED',         message: 'Locked' },
    { name: 'TIP_RENDERS',    message: 'Renders output' },
    { name: 'TIP_SILENT',     message: 'No visual output' }
  ]
});

foam.LIB({
  name: 'foam.core.reflow.graph.GraphNodeCView',
  methods: [
    function heightFor(lineCount) {
      // Called both as an instance method (this.cls_.heightFor(...) from the
      // height expression) and statically (GraphNodeCView.heightFor(...) from
      // the scene, for layout before a CView exists) -- constants are
      // installed on both the prototype and the class, so `this.HEADER_H`
      // etc. resolve either way.
      return this.HEADER_H + this.BAR_H +
        ( lineCount ? this.PAD + lineCount * this.LINE_H + this.PAD : this.PAD );
    }
  ]
});
