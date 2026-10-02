/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.parse.rail.ParserLabels',

  documentation: `
    The one place that knows what to call a parser, shared by the canvas boxes
    and the derivation panel. Glyph strings here are the notation contract
    checked by the enumeration test against NOTATION.md.
  `,

  methods: [
    function terminal(p) {
      /** Box text for a terminal parser, or null for anything else. */
      var P = foam.parse;
      if ( P.Literal.isInstance(p) || P.LiteralIC.isInstance(p) ) return '"' + p.s + '"';
      if ( P.Range.isInstance(p) )    return p.from + '…' + p.to;
      if ( P.NotChars.isInstance(p) ) return '¬[' + p.string + ']';
      if ( P.Chars.isInstance(p) )    return '[' + p.string + ']';
      if ( P.AnyChar.isInstance(p) )  return '•';
      if ( P.EOF.isInstance(p) )      return '⊣';
      return null;
    },

    function isTerminal(p) { return this.terminal(p) !== null; },

    function badge(p) {
      /** Small tag drawn in a terminal box's corner. */
      return foam.parse.LiteralIC.isInstance(p) ? 'aA' : '';
    },

    function name(p) {
      /** Derivation-panel label: rule name, terminal text, or null (combinator: hoist its children). */
      return foam.parse.Symbol.isInstance(p) ? p.name : this.terminal(p);
    }
  ]
});
