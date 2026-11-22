/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'DetailViewDisplayTestRow',

  documentation: 'A row with one section that shows and one that never does.',

  sections: [
    { name: 'shownSection', title: 'Shown' },
    { name: 'goneSection', title: 'Gone', isAvailable: function() { return false; } }
  ],

  properties: [
    { class: 'String', name: 'title', section: 'shownSection' },
    { class: 'String', name: 'note',  section: 'goneSection' }
  ]
});


foam.CLASS({
  package: 'foam.u2.test',
  name: 'DetailViewDisplayJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The wrapper elements of a detail view take their display from
    a class, never from an inline style: an inline display beats show(), hide()
    and every class rule, so the next state rule would need !important.`,

  requires: [
    'foam.u2.detail.VerticalDetailView',
    'foam.u2.test.DetailViewDisplayTestRow'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var view = this.VerticalDetailView.create({
          data: this.DetailViewDisplayTestRow.create({ title: 'a title' }, x)
        }, x);
        view.write();
        var root = view.element_;

        var drawn = false;
        for ( var i = 0 ; i < 50 && ! drawn ; i++ ) {
          await new Promise(r => setTimeout(r, 100));
          drawn = !! root.querySelector('.foam-u2-PropertyBorder');
        }
        x.test(drawn, 'the detail view drew its property');

        var inline = Array.from(root.querySelectorAll('*')).filter(e => e.style.display);
        x.test(inline.length === 0,
          'no element in the detail view sets display inline, got ' +
          inline.map(e => e.className + ' {' + e.style.display + '}').join(', '));

        var section = root.querySelector('.foam-u2-detail-VerticalDetailView-section');
        x.test(section && getComputedStyle(section).display === 'contents',
          'a section wrapper adds no box of its own (display: contents), got ' +
          (section && getComputedStyle(section).display));

        var gone = Array.from(root.querySelectorAll('.foam-u2-Element-hidden'))
          .filter(e => ! e.children.length);
        x.test(gone.length > 0 && gone.every(e => getComputedStyle(e).display === 'none'),
          'the placeholder of a section that is not available takes no space, found ' + gone.length);
        x.test(! /Gone/.test(root.innerText), 'the section that is not available shows no title');

        if ( section ) {
          section.classList.add('foam-u2-Element-hidden');
          x.test(getComputedStyle(section).display === 'none', 'hide() can still hide a section wrapper');
        }

        view.remove();
      }
    }
  ]
});
