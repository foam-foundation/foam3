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
      { level: Number, heading: String, body: String }
    where level 0 is preamble content before the first heading.
    The body includes the heading text so each chunk is self-contained.
  `,

  axioms: [ foam.pattern.Singleton.create() ],

  requires: [
    'foam.parse.Grammar',
    'foam.parse.Parsers'
  ],

  properties: [
    {
      name: 'grammar_',
      transient: true,
      factory: function() {
        var self = this;
        var p    = this.Parsers.create();

        var symbols = foam.Function.withArgs(function(
          alt, anyChar, not, notChars, optional, repeat, seq, seq1, str, sym
        ) {
          return {
            START: seq(optional(sym('preamble')), repeat(sym('section'))),

            // flat O(n) string capture — no per-char alt overhead
            preamble:    str(repeat(not(sym('headingStart'), anyChar()), null, 1)),
            body:        str(repeat(not(sym('headingStart'), anyChar()))),
            headingText: str(repeat(not('\n', anyChar()))),

            section:     seq(sym('heading'), sym('body')),
            heading:     seq(str(repeat('#', null, 1, 6)), ' ', sym('headingText'), optional('\n')),

            // lookahead only — marks where body/preamble stop
            headingStart: seq(repeat('#', null, 1, 6), ' ')
          };
        }, p);

        var g = this.Grammar.create({ symbols: symbols });

        g.addActions({
          // inline markup stripped in the action, not by a sub-grammar
          preamble:    function(v) { return self.stripInline_(v); },
          headingText: function(v) { return self.stripInline_(v); },
          body:        function(v) { return self.stripInline_(v); },

          heading: function(v) {
            return { level: v[0].length, text: v[2] };
          },

          section: function(v) {
            var h    = v[0];
            var body = v[1] ? v[1].trim() : '';
            return {
              level:   h.level,
              heading: h.text,
              body:    (h.text + '\n' + body).trim()
            };
          },

          START: function(v) {
            var out = [];
            if ( v[0] ) {
              var body = v[0].trim();
              if ( body ) out.push({ level: 0, heading: '', body: body });
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
      var s = markdown.endsWith('\n') ? markdown : markdown + '\n';
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
        .replace(/\n> /g, '\n');                        // blockquote markers
    }
  ]
});
