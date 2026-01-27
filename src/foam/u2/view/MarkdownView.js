/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO:
//   TOC?

foam.CLASS({
  package: 'foam.u2.view',
  name: 'MarkdownView',
  extends: 'foam.u2.View',

  documentation: 'Markdown parser and View with full CommonMark support including HTML',

  css: `
    ^codeBlock {
      background: $backgroundTertiary;
      border-radius: 6px;
      padding: 16px;
    }
    ^ h3 {
      font-size: 1.25em;
    }
    ^ h4 {
      font-size: 1.2em;
    }
    ^ h5 {
      font-size: 1.15em;
    }
    ^ h6 {
      font-size: 1.15em;
      font-weight: normal;
    }
    `,

  grammars: [
    {
      name: 'markdownGrammar',
      language: 'foam.parse.Parsers',

      symbols: function() {
        return {
          START: repeat(sym('element'), '\n'),

          element: alt(
            sym('codeBlock'),
            sym('heading'),
            sym('horizontalRule'),
            sym('blockquote'),
            sym('table'),
            sym('unorderedList'),
            sym('orderedList'),
            sym('blankLine'),
            sym('paragraph')
          ),

          // HTML support
          htmlComment: seq0(
            '<!--',
              str(repeat(not('-->', anyChar()))),
            '-->'
          ),

          htmlBlock: seq(
            '<',
            str(sym('htmlTagName')),
            sym('htmlAttributes'),
            alt(
              seq('>', sym('htmlContent'), '</', sym('htmlTagName'), '>'),
              '/>'
            )
          ),

          htmlTagName: repeat(alt(range('0','9'), range('a', 'z')), null, 1),

          htmlAttributes: repeat(seq(
            repeat(chars(' \t')),
            sym('htmlAttribute')
          )),

          htmlAttribute: seq(
            str(repeat(alt(range('a', 'z'), range('A', 'Z'), range('0', '9'), '-'), null, 1)),
            optional(seq(
              '=',
              alt(
                seq1(1, '"', str(repeat(notChars('"'))), '"'),
                seq1(1, "'", str(repeat(notChars("'"))), "'"),
                str(repeat(notChars(' \t>'), null, 1))
              )
            ))
          ),

          htmlContent: repeat(
            alt(
              sym('htmlBlock'),
              sym('htmlText')
            )
          ),

          htmlText: str(repeat(notChars('<'), null, 1)),

          // Block-level elements
          heading: seq(
            repeat('#', null, 1, 6),
            ' ',
            str(repeat(notChars('\n')))
          ),

          codeBlock: seq(
            '```',
              optional(str(repeat(range('a', 'z')))),
              '\n',
              str(repeat(not('```', anyChar()))),
            '```'
          ),

          horizontalRule: alt(
            repeat('-', null, 3),
            repeat('*', null, 3),
            repeat('_', null, 3)
          ),

          blockquote: repeat(seq1(1,
            '> ',
            str(repeat(notChars('\n'))),
          ), '\n', 1),

          unorderedList: repeat(seq(
            alt('- ', '* ', '+ '),
            sym('inlineContent'),
            optional(sym('nestedContent'))
          ), '\n', 1),

          orderedList: repeat(seq(
            str(repeat(range('0', '9'), null, 1)),
            '. ',
            sym('inlineContent'),
            optional(sym('nestedContent'))
          ), '\n', 1),

          nestedContent: repeat(seq1(1, '\n    ', str(repeat(notChars('\n')))), null, 1),

          table: seq(
            sym('tableHeader'),
            sym('tableSeparator'),
            repeat(sym('tableRow'), null, 1)
          ),

          tableHeader: seq1(1,
            '|',
            repeat(seq1(0,
              str(repeat(notChars('|\n'))),
              '|'
            ), null, 1),
            '\n'
          ),

          tableSeparator: seq1(1,
            '|',
            repeat(seq1(0,
              str(repeat(alt('-', ':', ' '), null, 1)),
              '|'
            ), null, 1),
            '\n'
          ),

          tableRow: seq1(1,
            '|',
            repeat(seq1(0,
              str(repeat(notChars('|\n'))),
              '|'
            ), null, 1),
            '\n'
          ),

          paragraph: sym('inlineContent'),

          blankLine: peek('\n'),

          // Inline elements
          inlineContent: repeat(sym('inline'), null, 1),

          inline: alt(
            sym('htmlComment'),
            sym('htmlBlock'),
//            sym('htmlInline'), // allow inner markdown
            sym('image'),
            sym('link'),
            sym('strikethrough'),
            sym('bold'),
            sym('italic'),
            sym('inlineCode'),
            sym('text')
          ),

          htmlInline: seq(
            '<',
            str(repeat(range('a', 'z'), null, 1)),
            sym('htmlAttributes'),
            alt(
              seq('>', sym('htmlInlineContent'), '</', str(repeat(range('a', 'z'), null, 1)), '>'),
              '/>'
            )
          ),

          htmlInlineContent: str(repeat(not(seq('</', str(repeat(range('a', 'z'), null, 1)), '>'), anyChar()))),

          image: seq(
            '![',
              str(repeat(notChars(']'))),
            '](',
              str(repeat(notChars(') '))),
              optional(seq1(1,
                ' "',
                str(repeat(notChars('"'))),
                '"'
              )),
            ')'
          ),

          link: seq(
            '[',
              str(repeat(notChars(']'))),
            '](',
              str(repeat(notChars(')'))),
            ')'
          ),

          strikethrough: seq1(1,
            '~~',
              str(repeat(not('~~', anyChar()), null, 1)),
            '~~'
          ),

          bold: seq1(1,
            alt('**', '__'),
              str(repeat(not(alt('**', '__'), anyChar()), null, 1)),
            alt('**', '__')
          ),

          italic: seq1(1,
            alt('*', '_'),
              str(repeat(not(alt('*', '_'), anyChar()), null, 1)),
            alt('*', '_')
          ),

          inlineCode: seq1(1,
            '`',
              str(repeat(notChars('`'), null, 1)),
            '`'
          ),

          text: str(repeat(not(alt(chars('*_`~[\n<'), '!['), anyChar()), null, 1))
        };
      },

      actions: [
        function htmlComment(v) {
          return function() {};
        },

        function htmlAttributes(v) {
          let attrs = {};
          v.forEach(attr => {
            let name  = attr[1][0];
            let value = attr[1][1];
            if ( name ) {
              if ( value ) {
                attrs[name] = value[1];
              } else {
                // Boolean attribute (e.g., disabled, checked)
                attrs[name] = true;
              }
            }
          });
          return attrs;
        },

        function htmlBlock(v) {
          let tagName    = v[1];
          let attributes = v[2];
          let closing    = v[3];

          return function() {
            if ( closing === '/>' ) {
              // Self-closing tag
              this.tag(tagName);
            } else {
              // Tag with content
              let content = closing[1];
              let e = this.start(tagName, attributes).call(content);
              // TODO: Use foam.u2.parse.CSSParser to allow for CSS tokens
              if ( attributes.style ) {
                let style = {};
                attributes.style.split(';').forEach(s => {
                  let p = s.split(':');
                  style[p[0]] = p[1];
                });
                e.style(style);
              }
            }
          };
        },

        function htmlInline(v) {
          let self       = this;
          let tagName    = v[1];
          let attributes = v[2];
          let closing    = v[3];

          return function() {
            if ( closing === '/>' ) {
              // Self-closing tag
              this.add('<' + tagName + attributes + '/>');
            } else {
              // Tag with content
              let content = self.markdownGrammar.parseString(closing[1]);
              this.add('<' + tagName + attributes + '>' + content + '</' + tagName + '>');
            }
          };
        },

        function nestedContent(v) {
          v = v.join('\n') + '\n';
          let fs = this.markdownGrammar.parseString(v);
          return function() {
            fs.forEach(f => this.call(f));
          };
        },

        function htmlContent(v) {
          return function() {
            v.forEach(f => this.call(f));
          };
        },

        function heading(v) {
          let level = v[0].length, text = v[2];
          return function() { this.start('h' + level).add(text).callIf(level <= 2, function() { this.tag('hr'); }).end(); }
        },

        function codeBlock(v) {
          let self = this;
          let language = v[1] || 'plaintext', text = v[3];
          return function() {
            this.start('pre').
              addClass(self.myClass('codeBlock')).
              start('code').
                addClass('language-' + language).
                add(text);
          };
        },

        function horizontalRule(v) {
          return function() { this.tag('hr'); };
        },

        function blockquote(v) {
          return function() { this.start('blockquote').add(v.join('\n')); }
        },

        function unorderedList(v) {
          return function() {
            this.start('ul').forEach(v, function(item) {
              let title = item[1], nestedContent = item[2];
              this.start('li').call(title).callIf(nestedContent, function() {
                this.start().style({marginLeft: '20px'}).call(nestedContent);
              });
            });
          };
        },

        function orderedList(v) {
          var items = v.map(function(item) { return item[2]; });
          var start = parseInt(v[0][0]) || 1;

          debugger;
          return function() {
            this.start('ol').attrs({start: start}).forEach(v, function(item) {
              let title = item[2], nestedContent = item[3];
              this.start('li').call(title).callIf(nestedContent, function() {
                this.start().style({marginLeft: '20px'}).call(nestedContent);
              });
            });
          };
        },

        /*
        function orderedList(v) {
          var items = v.map(function(item) { return item[2]; });
          var start = parseInt(v[0][0]) || 1;
          return function() {
            this.start('ol').attrs({start: start}).forEach(items, function(item) {
              this.start('li').call(item);
            });
          };
          },
          */


        function table(v) {
          let headers = v[0], rows = v[2];

          // Parse alignments from separator
          let alignments = v[1].map(s => {
            s = s.trim();
            if ( s.startsWith(':') && s.endsWith(':') ) return {'text-align': 'center'};
            if ( s.endsWith(':')   ) return {'text-align': 'right'};
            if ( s.startsWith(':') ) return {'text-align': 'left'};
            return null;
          });

          return function render(el) {
            this.start('table').attrs({border: '1px', cellspacing: 0, cellpadding: 8}).start('thead')
              .start('tr')
                .forEach(headers, function(h, i) {
                  this.start('th').style(alignments[i]).add(h.trim()).end();
                })
              .end().end()
              .start('tbody')
                .forEach(rows, function(row) {
                  this.start('tr').forEach(row, function (cell, i) {
                    this.start('td').style(alignments[i]).call(cell).end();
                  });
                });
          };
        },

        function tableRow(v) {
          return v.map(c => this.markdownGrammar.getSymParser('inlineContent').parseString(c));
        },

        function paragraph(v) {
          return function() { this.start('p').call(v); };
        },

        function blankLine(v) {
          return function() { /* this.tag('br'); */ };
        },

        function image(v) {
          let alt = v[1], url = v[3], title = v[4] || '';
          return function() {
            this.start('img').attrs({
              src: url,
              alt: alt,
              title: title
            });
          };
        },

        function link(v) {
          let title = v[1], url = v[3];
          return function() { this.start('a').attrs({href: url}).add(title); };
        },

        function strikethrough(v) {
          return function() { this.start('del').add(v); };
        },

        function bold(v) {
          return function() { this.start('strong').add(v); };
        },

        function italic(v) {
          return function() { this.start('em').add(v); };
        },

        function inlineCode(v) {
          return function() { this.start('code').add(v); };
        },

        function htmlText(v) {
          return function() { this.add(v); };
        },

        function text(v) {
          return function() { this.add(v); };
        },

        function inlineContent(v) {
          return function() { v.forEach(e => e.call(this)); }
        }
      ]
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'data'
    }
  ],

  methods: [
    function render() {
      this.SUPER();

      var self = this;

      this.addClass();

      this.add(this.dynamic(function(data) {
        var tokens = self.markdownGrammar.parseString(data + '\n');
        if ( tokens ) {
          tokens.forEach(t => t.call(this));
        } else {
          this.start().add('PARSE ERROR');
        }
      }));
    }
  ]
});
