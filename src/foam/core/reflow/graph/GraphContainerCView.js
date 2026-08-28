/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphHitRegion',
  extends: 'foam.graphics.CView',

  documentation: `
    An invisible CView used purely as a hit-testable region within a parent
    CView -- findFirstChildAt() returns it on a hit, and the scene reads its
    role to decide what was clicked (e.g. a container's expand/collapse
    toggle) without a dedicated event system on CView.
  `,

  properties: [
    { class: 'String', name: 'role' }
  ],

  methods: [
    function paintSelf(ctx) {}
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphContainerCView',
  extends: 'foam.graphics.Box',

  documentation: `
    Paints a Reflow layout block as either an expanded outline (a header
    over the region its laid-out children occupy) or a collapsed card
    (a fixed-size summary with a child count and an Expand chip). Purely a
    painter -- the scene owns collapsed/expanded layout, dragging, and
    which children are visible.
  `,

  requires: [ 'foam.core.reflow.graph.GraphHitRegion' ],

  constants: [
    { type: 'Int', name: 'HEADER_H',     value: 28 },
    { type: 'Int', name: 'COLLAPSED_W',  value: 240 },
    { type: 'Int', name: 'COLLAPSED_H',  value: 96 },
    { type: 'Int', name: 'PORT_Y',       value: 14 },
    { type: 'Int', name: 'PORT_R',       value: 5 }
  ],

  properties: [
    {
      name: 'block',
      documentation: 'The underlying Flowable layout block this outline represents, if any.'
    },
    { class: 'String', name: 'name' },
    { class: 'Int', name: 'childCount' },
    { class: 'Boolean', name: 'collapsed' },
    { name: 'theme', documentation: 'A foam.core.reflow.graph.GraphTheme.' },
    { class: 'Boolean', name: 'isSelected' },
    { class: 'Boolean', name: 'isDependent' },
    { class: 'Boolean', name: 'dimmed' },
    { class: 'Boolean', name: 'hasIn' },
    { class: 'Boolean', name: 'hasOut' },
    {
      class: 'Float',
      name: 'width',
      documentation: 'Set by the scene: the laid-out children bounds when expanded, COLLAPSED_W when collapsed.'
    },
    {
      class: 'Float',
      name: 'height',
      documentation: 'Set by the scene: the laid-out children bounds when expanded, COLLAPSED_H when collapsed.'
    },
    {
      class: 'Float',
      name: 'alpha',
      expression: function(dimmed) { return dimmed ? 0.2 : 1; }
    },
    {
      name: 'toggle_',
      documentation: 'Hit region over the header collapse/expand glyph. Always active.',
      hidden: true,
      transient: true,
      factory: function() { return this.GraphHitRegion.create({ role: 'toggle' }); }
    },
    {
      name: 'chip_',
      documentation: 'Hit region over the collapsed body\'s "Expand" chip. Zero-sized (inert) while expanded.',
      hidden: true,
      transient: true,
      factory: function() { return this.GraphHitRegion.create({ role: 'toggle' }); }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.add(this.toggle_, this.chip_);
    },

    function paintSelf(ctx) {
      var theme = this.theme;
      var t     = theme ? theme.colors : {};
      var f     = theme ? theme.fonts  : {};
      var w     = this.width, h = this.height;
      var PAD   = 8;

      ctx.save();

      // Background, dimmer when expanded (it's just an outline then).
      ctx.save();
      this.roundRect(ctx, 0, 0, w, h, 8);
      ctx.globalAlpha *= this.collapsed ? 0.9 : 0.6;
      ctx.fillStyle = t.containerFill;
      ctx.fill();
      ctx.restore();

      // Border.
      var solid       = this.isSelected || this.isDependent;
      var borderColor = this.isSelected  ? t.selected :
                         this.isDependent ? t.dependent :
                         t.containerStroke;
      ctx.lineWidth   = solid ? 2 : 1;
      ctx.strokeStyle = borderColor;
      ctx.setLineDash(solid ? [] : [4, 4]);
      this.roundRect(ctx, 0, 0, w, h, 8);
      ctx.stroke();
      ctx.setLineDash([]);

      // Toggle hit region: fixed 20x20 top-right of the header.
      this.toggle_.x      = w - PAD - 20;
      this.toggle_.y      = ( this.HEADER_H - 20 ) / 2;
      this.toggle_.width  = 20;
      this.toggle_.height = 20;

      var headerMidY = this.HEADER_H / 2;

      // Header badges, right-to-left, ending just left of the toggle region.
      var badges = [ this.LAYOUT.toUpperCase() ];
      if ( ! this.collapsed ) {
        badges.push((this.childCount + ' ' + ( this.childCount === 1 ? this.BLOCK : this.BLOCKS )).toUpperCase());
      }
      ctx.font        = f.badge;
      ctx.textAlign   = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = t.textMuted;
      var bx = this.toggle_.x - 6;
      for ( var i = 0 ; i < badges.length ; i++ ) {
        ctx.fillText(badges[i], bx, headerMidY);
        bx -= ctx.measureText(badges[i]).width + 6;
      }
      var badgesLeftX = bx + 6;

      // Title, truncated to the space left of the badges.
      var titleMaxW = Math.max(0, badgesLeftX - PAD - 8);
      ctx.font        = f.title;
      ctx.textAlign   = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = t.textMuted;
      var title = foam.core.reflow.dashboard.CanvasTextUtil.truncate(ctx, this.name || '', f.title, titleMaxW);
      ctx.fillText(title, PAD, headerMidY);

      // Collapse/expand glyph, centred in the toggle region.
      ctx.font        = f.title;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = t.textMuted;
      ctx.fillText(
        this.collapsed ? '▸' : '▾',
        this.toggle_.x + this.toggle_.width / 2,
        this.toggle_.y + this.toggle_.height / 2);

      if ( this.collapsed ) {
        var bodyTop = this.HEADER_H;
        var bodyH   = h - this.HEADER_H;

        ctx.font        = f.count;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle   = t.text;
        ctx.fillText(
          this.childCount + ' ' + ( this.childCount === 1 ? this.BLOCK : this.BLOCKS ),
          w / 2, bodyTop + bodyH * 0.42);

        var chipW = 96, chipH = 26;
        var chipX = ( w - chipW ) / 2;
        var chipY = bodyTop + bodyH * 0.62;

        this.chip_.x      = chipX;
        this.chip_.y      = chipY;
        this.chip_.width  = chipW;
        this.chip_.height = chipH;

        this.roundRect(ctx, chipX, chipY, chipW, chipH, 6);
        ctx.fillStyle = t.chipBg;
        ctx.fill();
        ctx.lineWidth   = 1;
        ctx.strokeStyle = t.chipBorder;
        this.roundRect(ctx, chipX, chipY, chipW, chipH, 6);
        ctx.stroke();

        ctx.font        = f.body;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle   = t.text;
        ctx.fillText('▸ ' + this.EXPAND, chipX + chipW / 2, chipY + chipH / 2);

        ctx.fillStyle = this.hasIn ? t.portActive : t.port;
        ctx.beginPath();
        ctx.arc(0, this.PORT_Y, this.PORT_R, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.hasOut ? t.portActive : t.port;
        ctx.beginPath();
        ctx.arc(w, this.PORT_Y, this.PORT_R, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Inert while expanded -- the chip only exists in the collapsed body.
        this.chip_.x      = 0;
        this.chip_.y      = 0;
        this.chip_.width  = 0;
        this.chip_.height = 0;
      }

      ctx.restore();
    },

    function tooltipAt(p) {
      if ( p.x >= this.toggle_.x && p.x <= this.toggle_.x + this.toggle_.width &&
           p.y >= this.toggle_.y && p.y <= this.toggle_.y + this.toggle_.height ) {
        return this.collapsed ? this.TIP_EXPAND : this.TIP_COLLAPSE;
      }
      return null;
    }
  ],

  messages: [
    { name: 'LAYOUT',       message: 'Layout' },
    { name: 'EXPAND',       message: 'Expand' },
    { name: 'TIP_EXPAND',   message: 'Expand layout' },
    { name: 'TIP_COLLAPSE', message: 'Collapse layout' },
    { name: 'BLOCK',        message: 'block' },
    { name: 'BLOCKS',       message: 'blocks' }
  ]
});
