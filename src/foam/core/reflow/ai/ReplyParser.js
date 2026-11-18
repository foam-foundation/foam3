/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai',
  name: 'ReplyParser',
  extends: 'foam.parse.Grammar',

  documentation: `
    Reads an AI agent's reply into the commands it calls and the text around
    them, without evaluating any of it. parseString(reply) returns the parts in
    reply order:

      { text: 'Reading the head of the file first.' }
      { ask: true, command: 'doc.readLines', params: { doc: 'file', from: 1, count: 20 },
        source: 'ask doc.readLines({"doc":"file","from":1,"count":20})' }

    A command is a line "ask <id>(<params>)" or "<id>(<params>)" whose params
    are a literal: an object, array, string, number, true, false or null. It
    may continue over several lines until its brackets close, so a parser's
    code can be passed as written inside a backtick string. Splitting on every
    newline instead sent each line of such a command back as a Syntax Error.

    A backtick string is also kept as written: literal('\\n') and /\\d+/ in a
    parser's code arrive unchanged; only a backslash before a backtick is
    dropped. A quoted string reads \\n as a line break, as in JSON.

    An ask line whose call does not parse, such as an unclosed bracket or
    params that are not a literal, gives { ask: true, error, source }, so the
    agent hears that it did not run instead of the line passing as its answer.

    Every other line is text.
  `,

  methods: [
    function grammar(alt, anyChar, chars, eof, literal, notChars, optional, range, repeat, repeat0, seq, seq1, str, substring, sym) {
      return {
        START: seq1(0, repeat(alt(sym('call'), sym('brokenAsk'), sym('line'))), eof()),

        call: seq(
          sym('hws'),
          optional(seq1(0, literal('ask', true), repeat(chars(' \t'), null, 1)), false),
          sym('id'), sym('hws'), '(', sym('ws'), optional(sym('value')), sym('ws'), ')', optional(';'),
          sym('lineEnd')),

        brokenAsk: seq1(0,
          substring(seq(sym('hws'), 'ask', repeat(chars(' \t'), null, 1), sym('id'), sym('hws'), '(', repeat(notChars('\n')))),
          alt('\n', eof())),

        line: alt(
          seq1(0, str(repeat(notChars('\n'))), '\n'),
          seq1(0, str(repeat(notChars('\n'), null, 1)), eof())),

        value: alt(
          sym('string'),
          sym('number'),
          literal('true', true),
          literal('false', false),
          sym('null'),
          sym('array'),
          sym('object')),

        string: alt(
          seq1(1, '"', str(repeat(alt(sym('escape'), notChars('"\\')))), '"'),
          seq1(1, '\'', str(repeat(alt(sym('escape'), notChars('\'\\')))), '\''),
          seq1(1, '`', str(repeat(alt(seq1(1, '\\', '`'), notChars('`')))), '`')),

        escape: seq1(1, '\\', alt(
          seq1(1, 'u', substring(repeat(alt(range('0', '9'), range('a', 'f'), range('A', 'F')), null, 4, 4))),
          anyChar())),

        number: substring(seq(
          optional('-'),
          repeat(range('0', '9'), null, 1),
          optional(seq('.', repeat(range('0', '9'), null, 1))))),

        null: literal('null'),

        array: seq1(2, '[', sym('ws'), repeat(sym('value'), sym('comma')), optional(sym('comma')), sym('ws'), ']'),

        object: seq1(2, '{', sym('ws'), repeat(sym('member'), sym('comma')), optional(sym('comma')), sym('ws'), '}'),

        member: seq(alt(sym('string'), sym('identifier')), sym('ws'), ':', sym('ws'), sym('value')),

        comma: seq(sym('ws'), ',', sym('ws')),

        id: substring(seq(sym('identifier'), repeat(seq('.', sym('identifier'))))),

        identifier: substring(seq(
          alt(range('a', 'z'), range('A', 'Z'), chars('_$')),
          repeat(alt(range('a', 'z'), range('A', 'Z'), range('0', '9'), chars('_$'))))),

        lineEnd: seq(sym('hws'), optional(seq('//', repeat(notChars('\n')))), alt('\n', eof())),

        hws: repeat0(chars(' \t')),

        ws: repeat0(chars(' \t\r\n'))
      };
    },

    function STARTAction(parts) {
      // Lines of text in a row become one text part, as the model wrote them
      var out = [];
      parts.forEach(p => {
        if ( ! p ) return;
        var last = out[out.length - 1];
        if ( p.text !== undefined && last && last.text !== undefined ) last.text += '\n' + p.text;
        else out.push(p);
      });
      return out;
    },

    function callAction(a) {
      return this.command_(a[1], a[2], a[6] === null || a[6] === undefined ? {} : a[6]);
    },

    function brokenAskAction(source) {
      return { ask: true, source: source.trim(),
        error: 'This did not run: write ask <command>({...}) with literal params and every bracket and quote closed.' };
    },

    function lineAction(text) { return { text: text }; },

    function escapeAction(c) {
      return c.length === 4 ? String.fromCharCode(parseInt(c, 16)) : { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[c] || c;
    },

    function numberAction(s) { return parseFloat(s); },

    function nullAction() { return null; },

    function objectAction(members) {
      var o = {};
      members.forEach(m => o[m[0]] = m[4]);
      return o;
    },

    function command_(ask, command, params) {
      return { ask: ask, command: command, params: params, source: ( ask ? 'ask ' : '' ) + command + '(' + JSON.stringify(params) + ')' };
    }
  ]
});
