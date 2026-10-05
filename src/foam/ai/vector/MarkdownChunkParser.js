/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'MarkdownChunkParser',

  documentation: `
    Splits a markdown string into sections at heading boundaries.
    Body text is collected as a flat string in O(n), then inline markup
    (images, links, bold, italic, code spans) is stripped in the grammar
    actions via stripInline_.

    Returns an array of plain objects:
      { level: Number, heading: String, payload: String }
    where level 0 is preamble content before the first heading.
    The payload includes the heading text so each chunk is self-contained.
  `,

  requires: [
    'foam.parse.Grammar',
    'foam.parse.Parsers'
  ],

  properties: [
    {
      class: 'Int',
      name:  'maxDepth',
      value: 2
    },
    {
      name: 'grammar_',
      factory: function() {
        var maxDepth = this.maxDepth;
        var self = this;
        var p    = this.Parsers.create();

        var symbols = foam.Function.withArgs(function(
          alt, anyChar, not, notChars, optional, repeat, seq, seq1, str, sym
        ) {
          return {
            START: seq(optional(sym('preamble')), repeat(sym('section'))),

            // flat O(n) string capture — no per-char alt overhead
            preamble:    str(repeat(not(sym('headingStart'), anyChar()), null, 1)),
            payload:     str(repeat(not(sym('headingStart'), anyChar()))),
            headingText: str(repeat(not('\n', anyChar()))),

            section:     seq(sym('heading'), sym('payload')),
            heading:     seq('\n', str(repeat('#', null, 1, maxDepth)), ' ', sym('headingText'), optional('\n')),

            // lookahead only — marks where payload/preamble stop; anchored to \n so
            // '###' cannot match inside '####' or at mid-line positions
            headingStart: seq('\n', repeat('#', null, 1, maxDepth), ' ')
          };
        }, p);

        var g = this.Grammar.create({ symbols: symbols });

        g.addActions({
          // inline markup stripped in the action, not by a sub-grammar
          preamble:    function(v) { return self.stripInline_(v); },
          headingText: function(v) { return self.stripInline_(v); },
          payload:     function(v) { return self.stripInline_(v); },

          heading: function(v) {
            return { level: v[1].length, text: v[3] };
          },

          section: function(v) {
            var h       = v[0];
            var payload = v[1] ? v[1].trim() : '';
            return {
              level:   h.level,
              heading: h.text,
              payload: (h.text + '\n' + payload).trim()
            };
          },

          START: function(v) {
            var out = [];
            if ( v[0] ) {
              var payload = v[0].trim();
              if ( payload ) out.push({ level: 0, heading: '', payload: payload });
            }
            if ( v[1] ) v[1].forEach(function(s) { out.push(s); });
            return out;
          }
        });

        return g;
      }
    }
  ],

  methods: [
    function parseString(markdown) {
      if ( ! markdown ) return [];
      var s = '\n' + (markdown.endsWith('\n') ? markdown : markdown + '\n');
      return this.grammar_.parseString(s) || [];
    },

    function stripInline_(text) {
      return text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')           // images → ''
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // links → label
        .replace(/\*\*([^*]*)\*\*/g, '$1')              // **bold**
        .replace(/__([^_]*)__/g, '$1')                  // __bold__
        .replace(/\*([^*]*)\*/g, '$1')                  // *italic*
        .replace(/_([^_]*)_/g, '$1')                    // _italic_
        .replace(/`([^`]*)`/g, '$1')                    // `code`
        .replace(/\n> /g, '\n')                         // blockquote markers
        .replace(/^#+\s+/gm, '');                       // headings deeper than maxDepth
    }
  ]
});
