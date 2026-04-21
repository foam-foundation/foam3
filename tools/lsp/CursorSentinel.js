/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'CursorSentinel',

  documentation: 'Inserts a non-matching sentinel character at the cursor position so grammar parses deterministically fail there. The failing alternatives become the completion set.',

  constants: {
    // \u0001 (Start Of Heading) — no FOAM token matches it; survives UTF-8 round-trip.
    CHAR: '\u0001'
  },

  methods: [
    function insertAt(text, position) {
      /**
       * Insert sentinel at the given { line, character } position.
       * If the cursor is inside an identifier, replace the identifier under
       * the cursor (from its start to its end) with the sentinel — this lets
       * the grammar see the start of a fresh token rather than a partial word.
       *
       * Returns { text, offset } where offset is the absolute position of
       * the sentinel in the returned text.
       */
      var lines = text.split('\n');
      var absOffset = 0;
      for ( var i = 0 ; i < position.line && i < lines.length ; i++ ) {
        absOffset += lines[i].length + 1;
      }
      var line = lines[position.line] || '';
      var ch = Math.min(position.character, line.length);
      absOffset += ch;

      var wordChar = /[a-zA-Z0-9_$]/;

      var start = ch;
      while ( start > 0 && wordChar.test(line[start - 1]) ) start--;
      var end = ch;
      while ( end < line.length && wordChar.test(line[end]) ) end++;

      if ( start !== end ) {
        var wordBefore = text.substring(0, absOffset - (ch - start));
        var wordAfter = text.substring(absOffset + (end - ch));
        return { text: wordBefore + this.CHAR + wordAfter, offset: wordBefore.length };
      }

      var before = text.substring(0, absOffset);
      var after = text.substring(absOffset);
      return { text: before + this.CHAR + after, offset: absOffset };
    },

    function removeFrom(text) {
      /** Strip the sentinel character (for debug/round-trip). */
      return text.split(this.CHAR).join('');
    }
  ]
});
