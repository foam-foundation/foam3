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
    A rule reference (call site): a box naming another rule. Unfolding one
    level in place arrives in a later PR; the properties it needs (builder,
    chain, unfolded, inner) are declared here so nothing is renamed then.
  `,

  properties: [
    { class: 'String', name: 'name', documentation: 'The referenced rule.' },
    { class: 'Boolean', name: 'missing', documentation: 'No rule of that name in the grammar: red outline and a "?" suffix.' },
    { name: 'builder', documentation: 'The RailBuilder that made this element; unfold asks it for the referenced rule\'s track.' },
    { name: 'chain', factory: function() { return {}; }, documentation: 'Rule names open on the ancestor chain: { name: true }. A rule already open stays a box (recursion guard).' },
    { class: 'Boolean', name: 'unfolded' },
    { name: 'inner', documentation: 'The unfolded track, when unfolded.' },
    {
      class: 'Float',
      name: 'width',
      expression: function(name, theme, measure) {
        return theme.GLYPH_SLOT + measure(name, theme.font('label')) + theme.PAD * 2;
      }
    },
    { class: 'Float', name: 'height', factory: function() { return this.theme.BOX_H; } }
  ],

  methods: [
    function canUnfold() { return false; },   // a later PR turns this on
    function toggle()    {},

    function paintSelf(ctx) {
      var T = this.theme;
      ctx.fillStyle = T.resolve('ruleRefBg');
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.lineWidth   = this.strokeWidth();
      ctx.strokeStyle = this.missing ? T.outcomeColor(foam.parse.rail.Outcome.FAILED) : this.outcomeColor();
      ctx.strokeRect(0.5, 0.5, this.width - 1, this.height - 1);
      // A reference already open above us is drawn muted: clicking it would recurse.
      this.paintLabel(ctx, this.name + ( this.missing ? '?' : '' ), this.chain[this.name] ? T.resolve('muted') : undefined);
      this.paintGlyph(ctx);
    },

    function tipText() {
      if ( this.missing )          return 'sym("' + this.name + '") — missing: no rule of that name';
      if ( this.chain[this.name] ) return 'sym("' + this.name + '") — already open above (recursion)';
      return this.SUPER();
    }
  ]
});
