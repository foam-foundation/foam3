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

    With no tool registered, Claude still sometimes writes a call in its own
    tool-call format:

      <invoke name="intake.testParser"><parameter name="code">foam.CLASS(...)</parameter></invoke>

    That is read as ask intake.testParser({code: 'foam.CLASS(...)'}). A
    parameter is kept as written, so code needs no escaping, unless it is a
    JSON number, boolean, array or object.

    Every other line is text.
  `,

  methods: [
    function grammar(alt, anyChar, chars, eof, literal, notChars, optional, range, repeat, repeat0, seq, seq1, str, substring, sym, until) {
      return {
        START: seq1(0, repeat(alt(sym('call'), sym('invoke'), sym('wrapper'), sym('line'))), eof()),

        call: seq(
          sym('hws'),
          optional(seq1(0, literal('ask', true), repeat(chars(' \t'), null, 1)), false),
          sym('id'), sym('hws'), '(', sym('ws'), optional(sym('value')), sym('ws'), ')', optional(';'),
          sym('lineEnd')),

        invoke: seq(
          sym('hws'), '<invoke name="', sym('id'), '">', sym('ws'),
          repeat(sym('parameter'), sym('ws')), sym('ws'), '</invoke>',
          sym('lineEnd')),

        parameter: seq('<parameter name="', sym('identifier'), '">', str(until('</parameter>'))),

        // The tags around a tool call, and a closing tag the model doubled
        wrapper: seq(sym('hws'), alt('<function_calls>', '</function_calls>', '</invoke>'), sym('lineEnd')),

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
          seq1(1, '`', str(repeat(alt(sym('escape'), notChars('`\\')))), '`')),

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

    function invokeAction(a) {
      var params = {};
      a[5].forEach(p => params[p[0]] = p[1]);
      return this.command_(true, a[2], params);
    },

    function parameterAction(a) {
      var value = a[3];
      try {
        var v = JSON.parse(value);
        if ( v !== null && typeof v !== 'string' ) value = v;
      } catch (e) {}
      return [ a[1], value ];
    },

    function wrapperAction() { return null; },

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
