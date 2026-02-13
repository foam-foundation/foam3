/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'MarkdownView',
  extends: 'foam.u2.View',

  documentation: 'Markdown parser and renderer with full CommonMark support including HTML',

  exports: [ 'markdownContext' ],

  imports: [
    'document',
    'window'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
    }
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

          htmlBlock: alt(sym('autoCloseHtmlBlock'), sym('fullHtmlBlock')),

          autoCloseHtmlBlock: seq(
            '<',
            'img',
            sym('htmlAttributes'),
            '>'
          ),

          fullHtmlBlock: seq(
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

          htmlText: str(repeat(not(alt('</', sym('htmlBlock')), any()), null, 1)),

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
              this.tag(tagName);
            } else {
              let content = closing[1];
              let e = this.start(tagName).attrs(attributes).call(content);
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
              this.add('<' + tagName + attributes + '/>');
            } else {
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

          return function() {
            this.start('ol').attrs({start: start}).forEach(v, function(item) {
              let title = item[2], nestedContent = item[3];
              this.start('li').call(title).callIf(nestedContent, function() {
                this.start().style({marginLeft: '20px'}).call(nestedContent);
              });
            });
          };
        },

        function table(v) {
          let headers = v[0], rows = v[2];

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
          return function() {};
        },

        function image(v) {
          let alt = v[1], url = v[3], title = v[4] || '';
          return function() {
            this.start('img').attrs({
              src: url,
              alt: alt,
              title: title
            }).end();
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
      name: 'markdownContext',
      factory: function() {
        return {};
      }
    },
    {
      class: 'String',
      name: 'data'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this
        .addClass()
        .add(this.dynamic(function(data) {
          self.markdownContext = undefined;
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


foam.CLASS({
  package: 'foam.u2.view',
  name: 'MarkdownEditorView',
  extends: 'foam.u2.View',

  documentation: 'Markdown editor with formatting toolbar',

  imports: [
    'document',
    'window'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
    }
    ^ButtonToolbar {
      display: flex;
      gap: 8px;
      width: 100%;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    ^ButtonToolbar > button + button {
      margin-left: 0 !important;
    }
    ^separator {
      background: $backgroundSecondary0;
      width: 1px;
      height: 2em;
      align-self: center;
    }
    ^tool.foam-u2-ActionView {
      padding: 6px 10px;
      max-height: unset;
    }
  `,

  requires: [
    'foam.u2.dialog.StyledModal'
  ],

  properties: [
    {
      class: 'String',
      name: 'data'
    },
    'editorElement_',
    {
      class: 'String',
      name: 'lastTextColor',
      value: '#000000'
    },
    {
      class: 'String',
      name: 'lastBgColor',
      value: '#ffff00'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this
        .addClass()
        .startContext({ data: this })
        .start()
          .addClass(this.myClass('ButtonToolbar'))
          .start(this.BOLD, { themeIcon: 'bold', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.ITALIC, { themeIcon: 'italic', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.UNDERLINE, { themeIcon: 'underline', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.STRIKETHROUGH, { themeIcon: 'strikethrough', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.TEXT_COLOR, { label: 'Color', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.BG_COLOR, { label: 'BG', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.HEADING1, { label: 'H1', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.HEADING2, { label: 'H2', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.HEADING3, { label: 'H3', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.HEADING4, { label: 'H4', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.LEFT_JUSTIFY, { themeIcon: 'leftAlign', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.CENTER_JUSTIFY, { themeIcon: 'centerAlign', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.RIGHT_JUSTIFY, { themeIcon: 'rightAlign', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.NUMBERED_LIST, { themeIcon: 'numberedList', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.BULLET_LIST, { themeIcon: 'bulletedList', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.TABLE, { label: 'Table', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.LINK, { themeIcon: 'link', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.IMAGE, { themeIcon: 'image', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.HORIZONTAL_RULE, { label: 'HR', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.BLOCK_QUOTE, { themeIcon: 'blockQuote', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.CODE_BLOCK, { label: 'Code', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INLINE_CODE, { label: '`code`', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.INSERT_TOC, { label: 'TOC', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INSERT_SEARCH, { label: 'Search', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INSERT_SECTION, { label: 'Section', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.INSERT_GLOSSARY, { label: 'Glossary', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INSERT_DEF, { label: 'Def', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INSERT_TERM, { label: 'Term', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start().addClass(this.myClass('separator')).end()
          .start(this.INSERT_EXAMPLE, { label: 'Example', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INSERT_PERMISSIONED, { label: 'Perm', size: 'SMALL' }).addClass(this.myClass('tool')).end()
          .start(this.INSERT_INCLUDE, { label: 'Include', size: 'SMALL' }).addClass(this.myClass('tool')).end()
        .end()
        .endContext()
        .start(foam.u2.tag.TextArea, {
          rows: 20,
          cols: 80,
          data$: this.data$,
          placeholder: 'Enter markdown text...'
        }, this.editorElement_$)
        .end();
    },

    function wrapSelection(prefix, suffix) {
      var textarea = this.editorElement_.el_();
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      var selectedText = this.data.substring(start, end);

      if ( !selectedText ) return;

      var newText = this.data.substring(0, start) +
                    prefix + selectedText + suffix +
                    this.data.substring(end);

      this.data = newText;

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    },

    function wrapLines(prefix, suffix) {
      suffix = suffix || '';
      var textarea  = this.editorElement_.el_();
      var start     = textarea.selectionStart;
      var end       = textarea.selectionEnd;
      var lineStart = this.data.lastIndexOf('\n', start - 1) + 1;
      var lineEnd   = this.data.indexOf('\n', end);

      if ( lineEnd === -1 ) lineEnd = this.data.length;

      var lines        = this.data.substring(lineStart, lineEnd).split('\n');
      var wrappedLines = lines.map(line => prefix + line + suffix);

      this.data = this.data.substring(0, lineStart) +
                  wrappedLines.join('\n') +
                  this.data.substring(lineEnd);

      setTimeout(() => textarea.focus(), 0);
    },

    function wrapLinesNumbered() {
      var textarea  = this.editorElement_.el_();
      var start     = textarea.selectionStart;
      var end       = textarea.selectionEnd;
      var lineStart = this.data.lastIndexOf('\n', start - 1) + 1;
      var lineEnd   = this.data.indexOf('\n', end);

      if ( lineEnd === -1 ) lineEnd = this.data.length;

      var lines         = this.data.substring(lineStart, lineEnd).split('\n');
      var numberedLines = lines.map((line, i) => (i + 1) + '. ' + line);

      this.data = this.data.substring(0, lineStart) +
                  numberedLines.join('\n') +
                  this.data.substring(lineEnd);

      setTimeout(() => textarea.focus(), 0);
    },

    function insertAtCursor(text, selectionOffset, selectionLength) {
      var textarea = this.editorElement_.el_();
      var start    = textarea.selectionStart;
      var end      = textarea.selectionEnd;
      var newText  = this.data.substring(0, start) +
                    text +
                    this.data.substring(end);

      this.data = newText;

      setTimeout(() => {
        textarea.focus();
        if ( selectionOffset !== undefined ) {
          var selStart = start + selectionOffset;
          var selEnd = selStart + (selectionLength || 0);
          textarea.setSelectionRange(selStart, selEnd);
        } else {
          textarea.setSelectionRange(start + text.length, start + text.length);
        }
      }, 0);
    },

    function insertTemplate(template, defaultText, selectPlaceholder) {
      var textarea     = this.editorElement_.el_();
      var start        = textarea.selectionStart;
      var end          = textarea.selectionEnd;
      var selectedText = this.data.substring(start, end);
      var text         = template.replace('$TEXT', selectedText || defaultText);

      this.data = this.data.substring(0, start) + text + this.data.substring(end);

      if ( selectPlaceholder ) {
        setTimeout(() => {
          textarea.focus();
          var placeholderStart = start + text.indexOf(selectPlaceholder);
          textarea.setSelectionRange(placeholderStart, placeholderStart + selectPlaceholder.length);
        }, 0);
      } else {
        setTimeout(() => textarea.focus(), 0);
      }
    },

    function openTableDialog() {
      var self = this;
      var rows = 3;
      var cols = 3;

      var modal = this.StyledModal.create({
        title: 'Insert Table',
        maxWidth: '400px'
      });

      modal
        .start()
          .start('p').add('Enter table dimensions:').end()
          .start()
            .style({ display: 'flex', gap: '16px', 'margin-bottom': '16px' })
            .start()
              .add('Rows: ')
              .start('input')
                .attrs({ type: 'number', min: 1, max: 20, value: rows })
                .on('input', function(e) { rows = parseInt(e.target.value) || 3; })
              .end()
            .end()
            .start()
              .add('Columns: ')
              .start('input')
                .attrs({ type: 'number', min: 1, max: 10, value: cols })
                .on('input', function(e) { cols = parseInt(e.target.value) || 3; })
              .end()
            .end()
          .end()
          .start()
            .style({ display: 'flex', 'justify-content': 'flex-end', gap: '8px' })
            .start('button')
              .add('Cancel')
              .on('click', function() { modal.closeModal(); })
            .end()
            .start('button')
              .add('Insert')
              .on('click', function() {
                self.insertTable(rows, cols);
                modal.closeModal();
              })
            .end()
          .end()
        .end();

      modal.open();
    },

    function insertTable(rows, cols) {
      var table = '';

      // Header row
      table += '|';
      for ( var c = 0; c < cols; c++ ) {
        table += ' Col' + (c + 1) + ' |';
      }
      table += '\n';

      // Separator row
      table += '|';
      for ( var c = 0; c < cols; c++ ) {
        table += '------|';
      }
      table += '\n';

      // Data rows
      for ( var r = 0; r < rows; r++ ) {
        table += '|';
        for ( var c = 0; c < cols; c++ ) {
          table += '      |';
        }
        table += '\n';
      }

      this.insertAtCursor('\n' + table + '\n');
    }
  ],

  actions: [
    {
      name: 'bold',
      label: 'B',
      toolTip: 'Bold',
      buttonStyle: 'TERTIARY',
      keyboardShortcuts: [ 'ctrl-b' ],
      code: function() {
        this.wrapSelection('**', '**');
      }
    },
    {
      name: 'italic',
      label: 'I',
      toolTip: 'Italic',
      buttonStyle: 'TERTIARY',
      keyboardShortcuts: [ 'ctrl-i' ],
      code: function() {
        this.wrapSelection('*', '*');
      }
    },
    {
      name: 'underline',
      label: 'U',
      toolTip: 'Underline',
      buttonStyle: 'TERTIARY',
      keyboardShortcuts: [ 'ctrl-u' ],
      code: function() {
        this.wrapSelection('<u>', '</u>');
      }
    },
    {
      name: 'strikethrough',
      label: 'S',
      toolTip: 'Strikethrough',
      buttonStyle: 'TERTIARY',
      keyboardShortcuts: [ 'ctrl-shift-x' ],
      code: function() {
        this.wrapSelection('~~', '~~');
      }
    },
    {
      name: 'textColor',
      label: 'Color',
      toolTip: 'Text Color',
      buttonStyle: 'TERTIARY',
      code: function() {
        var color = prompt('Enter text color (hex or name):', this.lastTextColor);
        if ( color ) {
          this.lastTextColor = color;
          this.wrapSelection('<span style="color: ' + color + ';">', '</span>');
        }
      }
    },
    {
      name: 'bgColor',
      label: 'BG',
      toolTip: 'Background Color',
      buttonStyle: 'TERTIARY',
      code: function() {
        var color = prompt('Enter background color (hex or name):', this.lastBgColor);
        if ( color ) {
          this.lastBgColor = color;
          this.wrapSelection('<span style="background-color: ' + color + ';">', '</span>');
        }
      }
    },
    {
      name: 'heading1',
      label: 'H1',
      toolTip: 'Heading 1',
      buttonStyle: 'TERTIARY',
      code: function() {
        this.wrapLines('# ');
      }
    },
    {
      name: 'heading2',
      label: 'H2',
      toolTip: 'Heading 2',
      buttonStyle: 'TERTIARY',
      code: function() {
        this.wrapLines('## ');
      }
    },
    {
      name: 'heading3',
      label: 'H3',
      toolTip: 'Heading 3',
      buttonStyle: 'TERTIARY',
      code: function() {
        this.wrapLines('### ');
      }
    },
    {
      name: 'heading4',
      label: 'H4',
      toolTip: 'Heading 4',
      buttonStyle: 'TERTIARY',
      code: function() {
        this.wrapLines('#### ');
      }
    },
    {
      name: 'leftJustify',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Align Left',
      code: function() {
        this.wrapLines('<div style="text-align: left;">', '</div>');
      }
    },
    {
      name: 'centerJustify',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Align Center',
      code: function() {
        this.wrapLines('<div style="text-align: center;">', '</div>');
      }
    },
    {
      name: 'rightJustify',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Align Right',
      code: function() {
        this.wrapLines('<div style="text-align: right;">', '</div>');
      }
    },
    {
      name: 'numberedList',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Numbered List',
      code: function() {
        this.wrapLinesNumbered();
      }
    },
    {
      name: 'bulletList',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Bulleted List',
      code: function() {
        this.wrapLines('- ');
      }
    },
    {
      name: 'link',
      label: 'Link',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Link',
      keyboardShortcuts: [ 'ctrl-k' ],
      code: function() {
        this.insertTemplate('[$TEXT](url)', 'link text', 'url');
      }
    },
    {
      name: 'image',
      label: 'Image',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Image',
      keyboardShortcuts: [ 'ctrl-shift-i' ],
      code: function() {
        this.insertTemplate('![$TEXT](image-url)', 'alt text', 'image-url');
      }
    },
    {
      name: 'horizontalRule',
      label: 'HR',
      buttonStyle: 'TERTIARY',
      toolTip: 'Horizontal Rule',
      code: function() {
        this.insertAtCursor('\n---\n');
      }
    },
    {
      name: 'blockQuote',
      label: '',
      buttonStyle: 'TERTIARY',
      toolTip: 'Quote',
      code: function() {
        this.wrapLines('> ');
      }
    },
    {
      name: 'codeBlock',
      label: 'Code',
      buttonStyle: 'TERTIARY',
      toolTip: 'Code Block',
      keyboardShortcuts: [ 'ctrl-shift-c' ],
      code: function() {
        this.insertTemplate('```\n$TEXT\n```\n', 'code here', 'code here');
      }
    },
    {
      name: 'inlineCode',
      label: '`code`',
      buttonStyle: 'TERTIARY',
      toolTip: 'Inline Code',
      keyboardShortcuts: [ 'ctrl-e' ],
      code: function() {
        this.wrapSelection('`', '`');
      }
    },
    {
      name: 'table',
      label: 'Table',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Table',
      keyboardShortcuts: [ 'ctrl-shift-t' ],
      code: function() {
        this.openTableDialog();
      }
    },
    {
      name: 'insertTOC',
      label: 'TOC',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Table of Contents',
      code: function() {
        this.insertAtCursor('<toc></toc>\n');
      }
    },
    {
      name: 'insertSearch',
      label: 'Search',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Search Box',
      code: function() {
        this.insertAtCursor('<search></search>\n<searchcount></searchcount>\n');
      }
    },
    {
      name: 'insertSection',
      label: 'Section',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Searchable Section',
      code: function() {
        this.insertTemplate('<section1 title="$TEXT">\nContent here...\n</section1>\n', 'Section Title', 'Section Title');
      }
    },
    {
      name: 'insertGlossary',
      label: 'Glossary',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Glossary',
      code: function() {
        this.insertAtCursor('<glossary></glossary>\n');
      }
    },
    {
      name: 'insertDef',
      label: 'Def',
      buttonStyle: 'TERTIARY',
      toolTip: 'Define Glossary Term',
      code: function() {
        this.insertTemplate('<def term="$TEXT" definition="Definition here"></def>\n', 'term', 'term');
      }
    },
    {
      name: 'insertTerm',
      label: 'Term',
      buttonStyle: 'TERTIARY',
      toolTip: 'Reference Glossary Term',
      code: function() {
        this.insertTemplate('<term term="$TEXT"></term>', 'term', 'term');
      }
    },
    {
      name: 'insertExample',
      label: 'Example',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Live Code Example',
      code: function() {
        this.insertTemplate('<example>\n$TEXT\n</example>\n', 'log("Hello, World!");', 'log("Hello, World!");');
      }
    },
    {
      name: 'insertPermissioned',
      label: 'Perm',
      buttonStyle: 'TERTIARY',
      toolTip: 'Insert Permissioned Content',
      code: function() {
        this.insertTemplate('<permissioned permission="$TEXT">\nContent here...\n</permissioned>\n', 'permission.name', 'permission.name');
      }
    },
    {
      name: 'insertInclude',
      label: 'Include',
      buttonStyle: 'TERTIARY',
      toolTip: 'Include Another Document',
      code: function() {
        this.insertTemplate('<include src="$TEXT"></include>\n', 'filename.md', 'filename.md');
      }
    }
  ]
});
