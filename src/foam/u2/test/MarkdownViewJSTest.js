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
    <stepper>, which documents migrated from GitBook use, text in angle
    brackets that is no tag, and links to a heading or to another document.
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

      // A heading styled letter by letter, with its closing tag on the next
      // line: the text after the last span must stay in the heading's line,
      // not drop into a paragraph of its own.
      v = await render('<h1>The <x style="color:red">R</x>eactive <span style="color:red">E</span>ditor for <span style="color:gray">FLOW</span> documents.\n</h1>\n');
      x.test(q(v, 'h1') && ! q(v, 'h1 .mdParagraph'), 'text before a closing tag on the next line is no paragraph');
      x.test(q(v, 'h1') && q(v, 'h1').innerText.trim().replace(/ +/g, ' ') == 'The Reactive Editor for FLOW documents.', 'the heading reads as one line, got ' + JSON.stringify(q(v, 'h1') && q(v, 'h1').innerText));
      v.remove();

      // Spans written one per line inside a div: the indentation between
      // them is whitespace, not a paragraph, so they read "hello there".
      v = await render('<div>\n  <span>hello</span>\n  <span>there</span>\n</div>\n');
      var d = q(v, 'div div');
      x.test(d && ! d.querySelector('.mdParagraph'), 'whitespace between tags makes no paragraph');
      x.test(d && d.innerText.trim().replace(/ +/g, ' ') == 'hello there', 'the spans share one line, got ' + JSON.stringify(d && d.innerText));
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

      // SVG names are case-sensitive, so <linearGradient> must keep its capital
      // G; lowercased, the browser does not know it and the fill finds no gradient.
      v = await render(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 150' width='300' height='150'>\n" +
        "<defs>\n<linearGradient id='gradK'><stop offset='0%' stop-color='#2e8b57'/><stop offset='100%' stop-color='#1b5e3a'/></linearGradient>\n</defs>\n" +
        "<path d='M50,100 C70,50 100,50 120,100 Z' style='fill: url(#gradK)'/>\n" +
        "</svg>\n");
      var grad = q(v, 'svg defs > *');
      x.test(grad && grad.localName == 'linearGradient', 'an SVG element keeps its camel-case name, got ' + ( grad && grad.localName ));
      x.test(grad instanceof SVGLinearGradientElement, 'the browser recognises it as a gradient');
      var path = q(v, 'svg path');
      x.test(path && path.namespaceURI == 'http://www.w3.org/2000/svg', 'elements inside an <svg> are in the SVG namespace');
      v.remove();

      // A style value may itself hold colons, as in url(http://...).
      v = await render('<div style="background-image: url(http://example.com/a.png); color: red">x</div>\n');
      var styled = q(v, '[style*="color"]');
      var bg     = styled && styled.style.backgroundImage;
      x.test(bg && bg.indexOf('http://example.com/a.png') != -1, 'a style value with a colon inside is kept whole, got ' + JSON.stringify(bg));
      x.test(styled && styled.style.color == 'red', 'the declaration after it still applies');
      v.remove();

      // Text in angle brackets that is no tag, such as a file layout written
      // as <name>, is text. It used to be read as an opening tag and the rest
      // of the page was dropped.
      v = await render('Send `D,Q,<name>,0,<product>` as the first line.\n\nAmounts must be <= 10 and <name> is the file name.\n\nLast paragraph.\n');
      x.test(q(v, 'code') && q(v, 'code').innerText == 'D,Q,<name>,0,<product>', 'inline code keeps its angle brackets, got ' + JSON.stringify(q(v, 'code') && q(v, 'code').innerText));
      x.test(text(v).indexOf('must be <= 10 and <name> is the file name.') != -1, 'a bare "<" and a <word> in a sentence show as text, got ' + JSON.stringify(text(v)));
      x.test(text(v).indexOf('Last paragraph.') != -1, 'the page after the angle brackets still renders');
      v.remove();

      // Forty of them in one page, as in a guide that writes List<String>
      // all over: each is settled where it stands, so the page still parses
      // at once.
      var generics = [];
      for ( var i = 0 ; i < 40 ; i++ ) generics.push('A List<String> named n' + i + '.');
      v = await render(generics.join('\n\n') + '\n');
      x.test(qa(v, '.mdParagraph').length == 40 && text(v).indexOf('A List<String> named n39.') != -1, 'forty <word> texts render as forty paragraphs, got ' + qa(v, '.mdParagraph').length);
      v.remove();

      // The same inside a step, where the body is split at every tag: inline
      // code and a code fence are not searched for tags.
      v = await render(
        '<stepper>\n<step>\n\n### First\n\nSend `D,Q,<name>,0,<product>` first.\n\n```\nH,<date>,<count>\n<b>not bold</b>\n```\n</step>\n\n' +
        '<step>\n\n### Second\n\nThen wait.\n</step>\n</stepper>\n\nAfter the steps.\n');
      stepper = find(v, e => self.Stepper.isInstance(e));
      steps = stepper ? [...stepper.el_().children].filter(c => c.classList.contains('foam-u2-markdown-Step')) : [];
      x.test(steps.length == 2, 'both steps render when the first holds angle brackets, got ' + steps.length);
      x.test(steps[0] && steps[0].querySelector('.mdParagraph code') && steps[0].querySelector('.mdParagraph code').innerText == 'D,Q,<name>,0,<product>', 'inline code inside a step keeps its angle brackets');
      var pre = steps[0] && steps[0].querySelector('pre code');
      x.test(pre && pre.innerText.indexOf('H,<date>,<count>') != -1 && pre.innerText.indexOf('<b>not bold</b>') != -1, 'a code fence inside a step shows its tags as text, got ' + JSON.stringify(pre && pre.innerText));
      x.test(pre && ! pre.querySelector('b'), 'a tag inside a code fence is not rendered');
      x.test(text(v).indexOf('After the steps.') != -1, 'the page after the stepper still renders');
      v.remove();

      // A closing tag only closes the tag of the same name, so <name> inside a
      // hint does not swallow the hint's own closing tag.
      v = await render('<hint category="hint">\nUse the <name> of the file here.\n</hint>\n\nAfter the hint.\n');
      var hint = q(v, '.foam-u2-markdown-Hint');
      x.test(hint && hint.innerText.replace(/\s+/g, ' ').indexOf('Use the <name> of the file here.') != -1, 'a <word> inside a hint shows as text, got ' + JSON.stringify(hint && hint.innerText));
      x.test(text(v).indexOf('After the hint.') != -1, 'the page after the hint still renders');
      v.remove();

      // Links. A click must not reach the browser's own navigation when the
      // link is handled here; this listener records that and then stops the
      // navigation either way, so a failing check cannot leave the test page.
      var prevented;
      var guard = function(e) { prevented = e.defaultPrevented; e.preventDefault(); };
      x.document.addEventListener('click', guard);
      var loaded = [];
      var flows  = foam.dao.ArrayDAO.create({ of: foam.core.reflow.Flow }, x);
      await flows.put(foam.core.reflow.Flow.create({ name: 'Support and Contacts' }, x));
      var linkX  = x.createSubContext({ flowDAO: flows, eval_: function(cmd) { loaded.push(cmd); } });
      var renderIn = async (md, ctx) => {
        var mv = self.MarkdownView.create({ data: md }, ctx);
        mv.write(x.document.body);
        await new Promise(r => setTimeout(r, 100));
        return mv;
      };

      // A link to another document by its flow name loads that flow. The
      // browser used to follow the href as well and show a 404 page.
      v = await renderIn('See [the contacts](Support and Contacts).\n', linkX);
      prevented = undefined;
      q(v, 'a').click();
      x.test(loaded.join() == 'load("Support and Contacts")', 'a link by flow name loads the flow, got ' + JSON.stringify(loaded));
      x.test(prevented === true, 'and the browser does not follow the href to a 404, defaultPrevented=' + prevented);
      v.remove();

      // A link to a heading of the same page scrolls to it. The browser used
      // to set the page hash, which the application reads as a route.
      v = await renderIn('[Go to part two](#part-two)\n\n# Part one\n\nText.\n\n## Part two\n\nMore text.\n', linkX);
      var target = x.document.getElementById('part-two');
      x.test(target, 'the heading has the id the link names');
      var scrolled = false;
      if ( target ) target.scrollIntoView = function() { scrolled = true; };
      prevented = undefined;
      q(v, 'a').click();
      x.test(scrolled, 'a link to a heading scrolls the heading into view');
      x.test(prevented === true, 'and the page hash is left alone, defaultPrevented=' + prevented);
      v.remove();

      // Any other "#" link is an application route and still goes to the browser.
      v = await renderIn('[Open the menu](#someMenu)\n', linkX);
      prevented = undefined;
      q(v, 'a').click();
      x.test(prevented === false, 'a "#" link that names no heading is left to the browser, defaultPrevented=' + prevented);
      v.remove();
      x.document.removeEventListener('click', guard);
    }
  ]
});
