/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailSymRef',
  extends: 'foam.parse.rail.RailElement',

  documentation: `
    A rule reference (call site): a box naming another rule. Click unfolds
    that rule's track inside a frame, one level; a rule already open on its
    own ancestor chain stays a box (recursion guard). Unfolded content is
    built fresh from the same parser objects, with paths that continue through
    this call site, so a trace lights it per activation through here.
  `,

  constants: {
    HEADER_INSET: 6,        // frame header text x
    FRAME_DASH: [ 4, 3 ]
  },

  properties: [
    { class: 'String', name: 'name', documentation: 'The referenced rule.' },
    { class: 'Boolean', name: 'missing', documentation: 'No rule of that name in the grammar: red outline and a "?" suffix.' },
    { name: 'builder', documentation: 'The RailBuilder that made this element; unfold asks it for the referenced rule\'s track.' },
    { name: 'chain', factory: function() { return {}; }, documentation: 'Rule names open on the ancestor chain: { name: true }. A rule already open stays a box.' },
    { class: 'Boolean', name: 'unfolded' },
    { name: 'inner', documentation: 'The unfolded track, when unfolded.' },
    { class: 'Float', name: 'innerW_' },
    { class: 'Float', name: 'innerH_' },
    { class: 'Float', name: 'innerE_' },
    { name: 'followSubs_', factory: function() { return []; } },
    {
      class: 'Float',
      name: 'width',
      expression: function(name, theme, measure, unfolded, innerW_) {
        return unfolded ? innerW_ + theme.FRAME_PAD * 2
                        : theme.GLYPH_SLOT + measure(name, theme.font('label')) + theme.PAD * 2;
      }
    },
    {
      class: 'Float',
      name: 'height',
      expression: function(theme, unfolded, innerH_) {
        return unfolded ? innerH_ + theme.FRAME_HEAD + theme.FRAME_PAD : theme.BOX_H;
      }
    },
    {
      class: 'Float',
      name: 'entryY',
      expression: function(theme, unfolded, innerE_, height) {
        return unfolded ? theme.FRAME_HEAD + innerE_ : height / 2;
      }
    }
  ],

  methods: [
    function canUnfold() {
      return !! this.builder && ! this.missing && ! this.chain[this.name];
    },

    function toggle() { this.unfolded ? this.fold() : this.unfold(); },

    function unfold() {
      if ( this.unfolded || ! this.canUnfold() ) return;
      var T = this.theme;
      // Extend the chain by value so sibling references are unaffected; continue the path through this call site.
      var chain = Object.assign({}, this.chain); chain[this.name] = true;
      var inner = this.builder.buildSymbol(this.name, chain, this.pathIds);
      inner.x = T.FRAME_PAD;
      inner.y = T.FRAME_HEAD;
      this.followSubs_ = [
        this.innerW_$.follow(inner.width$),
        this.innerH_$.follow(inner.height$),
        this.innerE_$.follow(inner.entryY$)
      ];
      this.inner = inner;
      this.add(inner);
      this.unfolded = true;
    },

    function fold() {
      if ( ! this.unfolded ) return;
      this.followSubs_.forEach(function(s) { s.detach(); });
      this.followSubs_ = [];
      this.remove(this.inner);
      this.inner = null;
      this.unfolded = false;
    },

    function paintSelf(ctx) {
      var T = this.theme, w = this.width, h = this.height;
      if ( this.unfolded ) {
        // Frame: tinted background, dashed border, header with the rule name; the inner track paints itself.
        ctx.fillStyle = T.resolve('frameBg'); ctx.fillRect(0, 0, w, h);
        ctx.setLineDash(this.FRAME_DASH); ctx.strokeStyle = T.resolve('muted'); ctx.lineWidth = T.STROKE_BASE;
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        ctx.setLineDash([]);
        ctx.fillStyle = T.resolve('muted'); ctx.font = T.font('badge'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('▾ ' + this.name.toUpperCase(), this.HEADER_INSET, T.FRAME_HEAD / 2);
        return;
      }
      ctx.fillStyle = T.resolve('ruleRefBg');
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth   = this.strokeWidth();
      ctx.strokeStyle = this.missing ? T.outcomeColor(foam.parse.rail.Outcome.FAILED) : this.outcomeColor();
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // A reference already open above us is drawn muted: clicking it would recurse.
      this.paintLabel(ctx, this.name + ( this.missing ? '?' : '' ), this.chain[this.name] ? T.resolve('muted') : undefined);
      this.paintGlyph(ctx);
    },

    function hitTest(p) {
      /** Folded: the whole box. Unfolded: only the header row, so clicks inside reach the inner track. */
      if ( ! this.unfolded ) return this.SUPER(p);
      return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.theme.FRAME_HEAD;
    },

    function tipText() {
      if ( this.missing )          return 'sym("' + this.name + '") — missing: no rule of that name';
      if ( this.chain[this.name] ) return 'sym("' + this.name + '") — already open above (recursion); shift-click jumps to its definition';
      if ( this.unfolded )         return 'sym("' + this.name + '") — unfolded; click the header to fold';
      return this.SUPER() + '\nclick = unfold · shift-click = go to definition';
    }
  ]
});
