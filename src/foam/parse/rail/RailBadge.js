/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailBadge',
  extends: 'foam.parse.rail.RailComposite',

  documentation: `
    A value-only decorator (it changes what the parse returns, not what it
    consumes): draws its child unchanged with a small tag in a row above it.
    The tooltip names the wrapper and, for ParserWithAction, shows the action
    source.
  `,

  constants: {
    BADGE_H: 12,
    HINT_MAX: 200
  },

  properties: [
    { name: 'item' },
    { class: 'String', name: 'tag', documentation: '∅ «» ⊕ ⚙ 💬 🐞 (see NOTATION.md).' },
    { class: 'String', name: 'hint', documentation: 'Extra tooltip line, e.g. the action source.' }
  ],

  methods: [
    function parts() { return [ this.item ]; },

    function layout() {
      this.item.x = 0;
      this.item.y = this.BADGE_H;
      this.width  = this.item.width;
      this.height = this.item.height + this.BADGE_H;
      this.entryY = this.BADGE_H + this.item.entryY;
    },

    function svgSelf(g) {
      this.svgText(g, 'badge', this.tag, 0, this.BADGE_H / 2);
    },

    function isHitTarget() { return true; },

    function tipText() {
      var s = this.parser ? this.parser.toString() : this.cls_.name;
      if ( this.hint ) s += '\n' + this.hint.substring(0, this.HINT_MAX);
      return s;
    }
  ]
});
