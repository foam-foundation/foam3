/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail.test',
  name: 'RailSymRefTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.parse.Grammar',
    'foam.parse.rail.RailAlt',
    'foam.parse.rail.RailBuilder',
    'foam.parse.rail.RailSeq',
    'foam.parse.rail.RailSymRef',
    'foam.parse.rail.RailTheme'
  ],

  documentation: 'A self-referencing grammar builds without recursion; unfold then refold restores the width; the ancestor guard leaves the inner reference as a box; paths continue through the call site.',

  methods: [
    function findRef(el, name) {
      /** First RailSymRef named `name` in el's subtree (depth-first). */
      if ( this.RailSymRef.isInstance(el) && el.name === name ) return el;
      for ( var i = 0 ; i < el.children.length ; i++ ) {
        var r = this.findRef(el.children[i], name);
        if ( r ) return r;
      }
      return null;
    },

    async function runTest(x) {
      var T = this.RailTheme.create(), m = foam.graphics.TextUtil.estimateMeasurer(7);
      // list refers to item, item refers back to list: a rule that contains itself two levels down.
      var g = this.Grammar.create({ symbols: function(seq, sym, literal, alt, eof) {
        return {
          START: seq(sym('list'), eof()),
          list:  seq(literal('['), sym('item'), literal(']')),
          item:  alt(literal('x'), sym('list'))
        };
      } });
      var b = this.RailBuilder.create({ grammar: g, theme: T, measure: m });
      var strips = b.buildStrips();
      x.test(strips.length === 3, 'self-referencing grammar builds (references are boxes, not recursion)');

      var start = strips[0], listRef = this.findRef(start, 'list');
      var w0 = start.width, h0 = start.height, boxW = listRef.width;
      x.test(listRef.canUnfold() && ! listRef.unfolded, 'a reference to an existing rule, not already open above, can unfold');

      listRef.unfold();
      x.test(listRef.unfolded && listRef.inner && this.RailSeq.isInstance(listRef.inner), 'unfold builds the referenced rule\'s track inside');
      x.test(listRef.width === listRef.inner.width + 2 * T.FRAME_PAD, 'frame width = inner + 2 pad');
      x.test(listRef.height === listRef.inner.height + T.FRAME_HEAD + T.FRAME_PAD, 'frame height = header + inner + pad');
      x.test(listRef.entryY === T.FRAME_HEAD + listRef.inner.entryY, 'frame entry row = header + inner entry');
      x.test(start.width > w0, 'the strip re-laid-out wider through the ArraySlot chain');
      x.test(listRef.inner.pathIds.slice(0, listRef.pathIds.length).join('/') === listRef.pathKey, 'inner paths continue through the call site');

      // Second level: item inside the unfolded list; its own `list` reference is guarded.
      var itemRef = this.findRef(listRef.inner, 'item');
      x.test(itemRef && itemRef.canUnfold(), 'item (not yet open above) can unfold');
      itemRef.unfold();
      var innerList = this.findRef(itemRef.inner, 'list');
      x.test(innerList && ! innerList.canUnfold() && innerList.chain['list'] === true, 'list inside item inside list stays a box (ancestor guard)');
      x.test(innerList.tipText().indexOf('recursion') >= 0, 'the guarded box explains why in its tooltip');
      innerList.unfold();
      x.test(! innerList.unfolded, 'unfold() on a guarded reference is a no-op');

      // Hit-testing: folded = whole box; unfolded = header row only, so inner clicks reach the inner track.

      // Refold restores the exact geometry and drops the inner subtree.
      listRef.fold();
      x.test(! listRef.unfolded && ! listRef.inner && listRef.children.length === 0, 'fold removes the inner track');
      x.test(listRef.width === boxW && start.width === w0 && start.height === h0, 'refold restores the strip\'s original width and height');

      // Missing rule never unfolds.
      var g2 = this.Grammar.create({ symbols: function(sym) { return { START: sym('nope') }; } });
      var ref2 = this.RailBuilder.create({ grammar: g2, theme: T, measure: m }).buildStrips()[0].track;
      x.test(ref2.missing && ! ref2.canUnfold(), 'a missing rule cannot unfold');
      x.test(listRef.toggle && ( listRef.toggle(), listRef.unfolded ) && ( listRef.toggle(), ! listRef.unfolded ), 'toggle flips unfolded');
    }
  ]
});
