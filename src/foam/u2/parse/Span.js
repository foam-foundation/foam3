/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.parse',
  name: 'Span',
  extends: 'foam.parse.ParserDecorator',

  documentation: `
    Wraps a parser and records where its match starts and ends.

    Problem: no foam.parse combinator reports input offsets. A grammar that
    feeds an editor needs them to underline a node, and a value such as
    'color: red' gives no way to recover that 'red' sits at offset 7.

    Fix: this decorator reads ps.pos before and after the delegate runs.
    Without a build function the value becomes
      { node: <delegate value>, start: <offset>, end: <offset> }
    With build(value, start, end, str) the value is whatever build returns;
    build returning undefined makes the parse fail, so a grammar can reject
    a match after inspecting it (for example a value made only of comments).
    'end' is exclusive: str.slice(start, end) is the matched text.
  `,

  properties: [
    {
      name: 'build',
      documentation: 'Optional function(value, start, end, str) returning the node, or undefined to fail.'
    }
  ],

  methods: [
    function parse(ps, obj) {
      var start = ps.pos;
      var res   = ps.apply(this.p, obj);
      if ( ! res ) return undefined;
      if ( ! this.build ) return res.setValue({ node: res.value, start: start, end: res.pos });
      var v = this.build(res.value, start, res.pos, ps.str[0]);
      return v === undefined ? undefined : res.setValue(v);
    },

    function toString() {
      return 'span(' + this.SUPER() + ')';
    }
  ]
});
