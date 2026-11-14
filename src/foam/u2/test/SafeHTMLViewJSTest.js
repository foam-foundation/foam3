/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'SafeHTMLViewJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `SafeHTMLView shows HTML a user typed. Script in it must not
    run, links may only go to http, https or mailto addresses, and simple
    formatting must survive with its text in the right element.`,

  requires: [ 'foam.u2.SafeHTMLView' ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var self = this;
        function render(html) {
          var view = self.SafeHTMLView.create({ data: html }, x);
          view.write();
          return view;
        }

        window.__safeHTMLViewRan = false;
        var img = render('<img src="x" onerror="window.__safeHTMLViewRan = true">');
        await new Promise(r => setTimeout(r, 200));
        x.test(! window.__safeHTMLViewRan, 'an onerror handler in the data does not run');
        x.test(img.element_.querySelector('img, [onerror]') === null,
          'no IMG element and no onerror attribute reach the page, got ' + img.element_.innerHTML);
        img.remove();

        var format = render('<strong>bold</strong> and <em>stressed</em>');
        x.test(format.element_.querySelector('strong') !== null, 'STRONG is kept');
        x.test(format.element_.querySelector('em') !== null, 'EM is kept');
        format.remove();

        var nested = render('<p><b>x</b> tail</p>');
        var p = nested.element_.querySelector('p');
        x.test(p && p.textContent === 'x tail', 'the paragraph holds "x tail", got ' + (p && p.innerHTML));
        x.test(p && p.querySelector('b').textContent === 'x',
          'text after a nested element stays outside it, got ' + (p && p.innerHTML));
        nested.remove();

        var links = render('<a href="java&#9;script:alert(1)">bad</a><a href="https://example.com/">good</a>');
        var anchors = links.element_.querySelectorAll('a');
        x.test(anchors.length === 2 && ! anchors[0].hasAttribute('href'),
          'a javascript: href with a tab in it is dropped, got ' + links.element_.innerHTML);
        x.test(anchors.length === 2 && anchors[1].getAttribute('href') === 'https://example.com/',
          'an https href is kept, got ' + links.element_.innerHTML);
        links.remove();

        // HTMLView redraws on the next animation frame after data changes.
        var live = render('<b>first</b>');
        live.data = '<b>second</b>';
        await new Promise(r => setTimeout(r, 200));
        x.test(live.element_.textContent === 'second', 'a new data value replaces the old one, got ' + live.element_.textContent);
        live.remove();
      }
    }
  ]
});
