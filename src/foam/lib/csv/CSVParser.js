/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lib.csv',
  name: 'RepeatUntil',

  documentation: "A faster version of repeat(not(literal(self.delimiter), anyChar()), '', 1)",

  properties: [ 'delimiter' ],

  methods: [
    function parse(ps, obj) {
      var ret = '';
      while ( true ) {
        if ( ! ps.valid || ps.head === this.delimiter || ps.head === '\n' ) {
          return ret === '' ? undefined : ps.setValue(ret);
        }

        ret += ps.head;
        ps = ps.tail;
      }
    },

    function toString() {
      return 'repeatUntil(' + this.delimiter + ')';
    }
  ]
});


foam.CLASS({
  package: 'foam.lib.csv',
  name: 'CSVParser',

  requires: [
    'foam.parse.ImperativeGrammar'
  ],

  properties: [
    {
      class: 'String',
      name: 'delimiter'
    },
    {
      class: 'String',
      name: 'nestedObjectSeperator'
    },
    {
      name: 'stringParser',
      factory: function() {
        var X = this.X;
        var self = this;

        return this.ImperativeGrammar.create({
          symbols: function(
            alt, anyChar, not, notChars, optional,
            plus, range, repeat, repeat0, seq, seq1, str, sym, until) {
            return {
              START: seq1(1, sym('ws'), repeat(sym('field'), self.delimiter), sym('ws')),

              file: repeat(sym('START'), '\n'),

              line: seq1(0, sym('START'), alt('\r\n', '\r', '\n')),

              field: alt(sym('quotedText'), sym('unquotedText'), ''),

              unquotedText: foam.lib.csv.RepeatUntil.create({delimiter:self.delimiter}),

              quotedText: seq1(1, '"', repeat(alt(sym('escapedQuote'), not('"', anyChar()))), '"'),

              escapedQuote: '""',

              white: alt(' ', '\t'),

              // 0 or more whitespace characters.
              ws: repeat0(sym('white'))
            }
          }
        }).addActions({
          unquotedText: function(a) {
            return { node: 'unquotedText', value: a };
          },

          quotedText: function(a) {
            return { node: 'quotedText', value: a.join('') };
          },

          escapedQuote: function() { return '"'; }
        });
      }
    },
    {
      name: 'headerParser',
      factory: function() {
        var X = this.X;
        var self = this;

        return this.ImperativeGrammar.create({
          symbols: function(alt, anyChar, literal, literalIC, not, notChars, optional,
          plus, range, repeat, repeat0, seq, seq1, str, sym) {
            return {

              START: seq1(1, sym('ws'), repeat(sym('field'), literal(self.nestedObjectSeperator)), sym('ws')),

              field: alt(sym('text'), ''),

              text: repeat(alt(sym('escapedSeperator'), not(self.nestedObjectSeperator, anyChar())), '', 1),

              escapedSeperator: literal(self.nestedObjectSeperator + self.nestedObjectSeperator),

              white: alt(' ', '\t', '\r'),

              // 0 or more whitespace characters.
              ws: repeat0(sym('white'))
            }
          }
        }).addActions({
          text: function(a) {
            return { node: 'text', value: self.recoverHeaderTitle(a.join('')) };
          },

          escapedQuote: function() { return '"'; }
        });
      }
    }
  ],

  methods: [
    function parseFile(str, delimiter) {
      if ( ! this.delimiter )
        this.delimiter = delimiter;

      // Preprocess: Remove empty lines but keep lines with only delimiters
      var lines = str.split(/\r\n|\r|\n/);
      var nonEmptyLines = [];
      for ( var i = 0; i < lines.length; i++ ) {
        var line = lines[i];
        // Keep lines that have content or contain delimiters (even if fields are empty)
        if ( line.length > 0 ) {
          nonEmptyLines.push(line);
        }
      }
      str = nonEmptyLines.join('\n');

      const ps = foam.parse.StringPStream.create({str: str});
      const p  = this.stringParser.getSymParser('file');
      var result = p.parse(ps);

      return result && result.value;
    },

    function parseString(str, delimiter) {
      if ( ! this.delimiter )
        this.delimiter = delimiter;

      // Short circuit if no quoted strings
      if ( str.indexOf('"') == -1 )
        return str.split(this.delimiter).map(s => s ? { node: 'unquotedText', value: s } : '');

      return this.stringParser.parseString(str);
    },

    function parseHeader(str, nestedObjectSeperator) {
      this.nestedObjectSeperator = nestedObjectSeperator;
      return this.headerParser.parseString(str);
    },

    function recoverHeaderTitle(t) {
      // Recovers header title by replacing the nested object seperator x 2, by itself
      return t.replace(new RegExp(this.nestedObjectSeperator + this.nestedObjectSeperator, 'g'),
        this.nestedObjectSeperator);
    }
  ]
});
