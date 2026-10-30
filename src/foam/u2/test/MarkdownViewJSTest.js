/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'MarkdownViewJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    Renders markdown through MarkdownView and checks the DOM. The first group
    pins behaviour that existing docs rely on, so a grammar change cannot
    quietly break them; the rest covers quotes, table headers, <tabs> and
    <stepper>, which documents migrated from GitBook use.
  `,

  requires: [
    'foam.u2.Tabs',
    'foam.u2.markdown.Step',
    'foam.u2.markdown.Stepper',
    'foam.u2.view.MarkdownView'
  ],

  methods: [
    async function runTest(x) {
      var self = this;
      // The view renders through a dynamic(), so its children land a tick later.
      var render = async md => {
        var v = self.MarkdownView.create({ data: md }, x);
        v.write(x.document.body);
        await new Promise(r => setTimeout(r, 50));
        return v;
      };
      var find = (e, test) => {
        if ( test(e) ) return e;
        for ( var c of e.childNodes || [] ) {
          var r = find(c, test);
          if ( r ) return r;
        }
      };
      var q    = (v, sel) => v.el_().querySelector(sel);
      var qa   = (v, sel) => v.el_().querySelectorAll(sel);
      var text = v => v.el_().innerText;

      // Existing markdown keeps rendering as before.
      var v = await render(
        '# Title\n\nSome **bold**, *italic* and `code` with a [link](https://example.com).\n\n' +
        '- one\n- two\n    - nested\n\n1. first\n2. second\n\n' +
        '| A | B |\n|---|---|\n| **x** | y |\n\n```js\nlet a = 1;\n```\n\n---\n\n![alt](images/a.png)\n');
      x.test(q(v, 'h1') && q(v, 'h1').innerText.trim() == 'Title', 'heading renders');
      x.test(q(v, '.mdParagraph strong') && q(v, '.mdParagraph em') && q(v, '.mdParagraph code'), 'inline bold, italic and code render');
      // Reflow's Link sets href after an async flow lookup, so check the anchor and its text.
      x.test(q(v, 'a') && q(v, 'a').innerText.trim() == 'link', 'link renders');
      x.test(qa(v, 'ul li').length >= 3, 'list with a 4-space nested item renders all items, got ' + qa(v, 'ul li').length);
      x.test(qa(v, 'ol li').length == 2, 'ordered list renders');
      x.test(q(v, 'td strong'), 'table body cells take inline markdown');
      x.test(q(v, 'pre code') && q(v, 'pre code').innerText.indexOf('let a = 1;') != -1, 'code block renders');
      x.test(q(v, 'hr'), 'horizontal rule renders');
      x.test(q(v, 'img[src="images/a.png"]'), 'block image renders');
      x.test(text(v).indexOf('**') == -1 && text(v).indexOf('](') == -1, 'no markdown syntax shows as text');
      v.remove();

      v = await render('<hint category="warning">\nRead **this** first.\n</hint>\n');
      x.test(q(v, '.foam-u2-markdown-Hint strong'), 'a multi-line hint parses its markdown');
      v.remove();

      // A link target may hold one pair of parentheses, as a flow name does.
      v = await render('See [the guide](Client Programs (DOC)) for more.\n');
      var a = q(v, 'a');
      x.test(a && a.innerText.trim() == 'the guide', 'a link whose target has parentheses renders');
      x.test(text(v).replace(/\s+/g, ' ').trim() == 'See the guide for more.', 'text around it is kept, got ' + JSON.stringify(text(v)));
      v.remove();

      v = await render('[a](https://example.com/x) (note)\n');
      x.test(q(v, 'a') && text(v).indexOf('(note)') != -1, 'a link followed by a bracketed note keeps the note as text');
      v.remove();

      // Inside a hint, a markdown link and an inline icon stay in the sentence.
      v = await render('<hint category="hint">\nVisit [this page](Some Flow (DOC)) and click ![icon](images/i.png) to go on.\n</hint>\n');
      var hp = q(v, '.foam-u2-markdown-Hint .mdParagraph');
      x.test(hp && hp.querySelector('a') && hp.querySelector('img'), 'link and icon render inside one paragraph of the hint');
      x.test(hp && hp.innerText.replace(/\s+/g, ' ').trim() == 'Visit this page and click to go on.', 'the sentence keeps its spaces, got ' + JSON.stringify(hp && hp.innerText));
      v.remove();

      // A quote holds markdown, and a bare ">" separates its paragraphs.
      v = await render('> A **bold** word.\n>\n> Second paragraph with ![icon](images/i.png) inline.\n');
      x.test(qa(v, 'blockquote').length == 1, 'the bare ">" line keeps one quote, got ' + qa(v, 'blockquote').length);
      x.test(q(v, 'blockquote strong'), 'bold inside a quote renders');
      x.test(q(v, 'blockquote img[src="images/i.png"]'), 'an image inside a quote renders');
      x.test(qa(v, 'blockquote .mdParagraph').length == 2, 'the quote holds two paragraphs');
      x.test(text(v).indexOf('>') == -1 && text(v).indexOf('**') == -1, 'no ">" or "**" shows as text');
      v.remove();

      v = await render('> plain quote\n');
      x.test(q(v, 'blockquote') && q(v, 'blockquote').innerText.trim() == 'plain quote', 'a one-line quote still renders');
      v.remove();

      // Header cells take inline markdown like body cells.
      v = await render('| **Type** | Plain | |\n|---|---|---|\n| a | b | c |\n');
      var ths = qa(v, 'th');
      x.test(ths.length == 3, 'three header cells, got ' + ths.length);
      x.test(ths[0].querySelector('strong') && ths[0].innerText.trim() == 'Type', 'a bold header cell shows bold without asterisks');
      x.test(ths[1].innerText.trim() == 'Plain', 'a plain header cell is unchanged');
      x.test(ths[2].innerText.trim() == '', 'an empty header cell renders empty');
      v.remove();

      // A header row of only empty cells means no header: every row is data.
      v = await render('| | |\n|---|---|\n| Term | Meaning |\n| Other | More |\n');
      x.test(! q(v, 'thead') && ! q(v, 'th'), 'an all-empty header row renders no header');
      x.test(qa(v, 'tbody tr').length == 2, 'both rows stay data rows, got ' + qa(v, 'tbody tr').length);
      v.remove();

      // <tabs>: one button per <tab label>, the first shown, markdown inside.
      v = await render('<tabs>\n<tab label="One">\nFirst **tab**.\n</tab>\n\n<tab label="Two">\nSecond tab.\n</tab>\n</tabs>\n');
      var tabs = find(v, e => self.Tabs.isInstance(e));
      x.test(tabs, '<tabs> renders a Tabs view');
      var buttons = tabs ? [...tabs.el_().querySelectorAll('.foam-u2-Tabs-tab')] : [];
      x.test(buttons.map(b => b.innerText.trim()).join('|') == 'One|Two', 'tab labels come from the label attribute, got ' + buttons.map(b => b.innerText.trim()).join('|'));
      x.test(tabs && tabs.selected && tabs.selected.label == 'One', 'the first tab starts selected');
      x.test(tabs && tabs.el_().querySelector('strong'), 'markdown inside a tab renders');
      if ( buttons[1] ) buttons[1].click();
      await new Promise(r => setTimeout(r, 20));
      x.test(tabs && tabs.selected && tabs.selected.label == 'Two', 'clicking a tab selects it');
      v.remove();

      // <stepper>: one numbered Step per <step>, markdown inside.
      v = await render('<stepper>\n<step>\n\n### First\n\nDo this.\n</step>\n\n<step>\n\n### Second\n\nThen that.\n</step>\n</stepper>\n');
      var stepper = find(v, e => self.Stepper.isInstance(e));
      x.test(stepper, '<stepper> renders a Stepper');
      var steps = stepper ? [...stepper.el_().children].filter(c => c.classList.contains('foam-u2-markdown-Step')) : [];
      x.test(steps.length == 2, 'two steps, got ' + steps.length);
      x.test(steps[0] && steps[0].querySelector('h3') && steps[0].querySelector('h3').innerText.trim() == 'First', 'a heading inside a step renders');
      x.test(steps[0] && getComputedStyle(steps[0], '::before').content.indexOf('counter(step)') != -1, 'the step number is drawn by the CSS counter');
      v.remove();

      // An icon in a sentence stays on the line of text.
      v = await render('Click the ![icon](images/i.png) button.\n');
      var img = q(v, '.mdParagraph img');
      x.test(img && getComputedStyle(img).display == 'inline', 'an image inside a paragraph is inline, got ' + ( img && getComputedStyle(img).display ));
      v.remove();
    }
  ]
});
