/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'FixedStylesJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A style that never changes comes from the view's CSS, not from
    an inline style: an inline style beats every class rule, so the next rule
    that has to win would need !important. Each view here keeps the look it
    had, with no style attribute.`,

  requires: [
    'foam.dao.ArrayDAO',
    'foam.u2.DAOList',
    'foam.u2.borders.ExpandableBorder',
    'foam.u2.tag.Select',
    'foam.u2.tag.TextArea',
    'foam.u2.test.FixedStylesTestRow'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var until = async function(f) {
          for ( var i = 0 ; i < 50 ; i++ ) {
            if ( f() ) return true;
            await new Promise(r => setTimeout(r, 100));
          }
          return false;
        };
        var inline = function(root) {
          return [root].concat(Array.from(root.querySelectorAll('*')))
            .filter(e => e.getAttribute('style'))
            .map(e => e.className + ' {' + e.getAttribute('style') + '}').join(', ');
        };

        var border = this.ExpandableBorder.create({ title: 'Help', expanded: true }, x);
        border.add('some help');
        border.write();
        var content = border.element_.querySelector('.foam-u2-borders-ExpandableBorder-content');
        x.test(content && getComputedStyle(content).overflow === 'auto',
          'ExpandableBorder: the content scrolls (overflow: auto), got ' + (content && getComputedStyle(content).overflow));
        x.test(inline(border.element_) === '', 'ExpandableBorder: no inline style, got ' + inline(border.element_));
        border.remove();

        var area = this.TextArea.create({ escapeTextArea: true }, x);
        area.write();
        x.test(getComputedStyle(area.element_).whiteSpace === 'pre',
          'TextArea: an escaped text area keeps its spaces (white-space: pre), got ' + getComputedStyle(area.element_).whiteSpace);
        x.test(inline(area.element_) === '', 'TextArea: no inline style, got ' + inline(area.element_));
        area.remove();

        var one  = this.Select.create({ choices: [ [ 'a', 'A' ], [ 'b', 'B' ], [ 'c', 'C' ] ] }, x);
        var many = this.Select.create({ choices: [ [ 'a', 'A' ], [ 'b', 'B' ], [ 'c', 'C' ] ], size: 3 }, x);
        one.write();
        many.write();
        await until(() => many.element_.options.length === 3);
        x.test(many.element_.offsetHeight > one.element_.offsetHeight,
          'Select: a list of 3 rows is taller than a one-row select (height: auto), got ' +
          many.element_.offsetHeight + ' and ' + one.element_.offsetHeight);
        x.test(inline(many.element_) === '', 'Select: no inline style, got ' + inline(many.element_));
        one.remove();
        many.remove();

        var rows = this.ArrayDAO.create({ of: this.FixedStylesTestRow }, x);
        for ( var i = 1 ; i <= 3 ; i++ ) await rows.put(this.FixedStylesTestRow.create({ id: i, title: 'row ' + i }, x));
        var list = this.DAOList.create({ data: rows }, x);
        list.write();
        var nav;
        var drawn = await until(() => nav = list.element_.querySelector('.foam-u2-DAOList-nav'));
        x.test(drawn, 'DAOList: the footer row is drawn');
        if ( drawn ) {
          x.test(getComputedStyle(nav).justifyContent === 'flex-end',
            'DAOList: the footer row is packed to the end, over Cols\' own space-between, got ' + getComputedStyle(nav).justifyContent);
          x.test(! nav.getAttribute('style'), 'DAOList: the footer row has no inline style, got ' + nav.getAttribute('style'));
          var counters = nav.querySelector('.foam-u2-DAOList-counterRow');
          x.test(counters && getComputedStyle(counters).columnGap === '4px',
            'DAOList: the counters keep their 4px gap, got ' + (counters && getComputedStyle(counters).columnGap));
        }
        list.remove();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.test',
  name: 'FixedStylesTestRow',
  documentation: 'A row for the list in FixedStylesJSTest.',
  properties: [
    { class: 'Int', name: 'id' },
    { class: 'String', name: 'title' }
  ]
});
