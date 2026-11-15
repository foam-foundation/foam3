/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'MarkdownViewSafetyJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    MarkdownView renders the HTML tags written in a document, and a document
    can come from a user or an LLM reply. A tag must not carry an event
    handler such as onerror, a link or image must not point at a
    javascript: address, and tags that load or run code (script, iframe,
    object and similar) must not render. Simple tags keep working, and <br>
    breaks the line whether it is written <br>, <br/> or <br />.
  `,

  requires: [ 'foam.u2.view.MarkdownView' ],

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
      var q    = (v, sel) => v.el_().querySelector(sel);
      var qa   = (v, sel) => v.el_().querySelectorAll(sel);
      var html = v => v.el_().innerHTML;

      // Event handlers are dropped; the element itself still renders.
      var v = await render('<img src="images/a.png" onerror="alert(1)">\n\n<div onclick="alert(1)" data-keep="yes">click</div>\n');
      x.test(! q(v, '[onerror], [onclick]'), 'no onerror or onclick attribute renders, got ' + html(v));
      x.test(q(v, 'img[src="images/a.png"]'), 'the image still renders with its src');
      x.test(q(v, 'div[data-keep="yes"]') && q(v, 'div[data-keep="yes"]').innerText.trim() == 'click', 'the div keeps its other attributes and text, got ' + html(v));
      v.remove();

      // Links and images may only point at web, mail or data addresses.
      v = await render(
        '[md](javascript:alert(1)) <a href="JavaScript:alert(1)">tag</a> <a href="https://example.com/">ok</a> [page](Client Programs)\n\n' +
        '![img](javascript:alert(1))\n');
      // Reflow's Link, which draws every <a>, sets its href after an async flow lookup.
      await new Promise(r => setTimeout(r, 300));
      x.test(! q(v, '[href^="javascript" i], [src^="javascript" i]'), 'no javascript: href or src renders, got ' + html(v));
      x.test(q(v, 'a[href="https://example.com/"]'), 'an https link keeps its href');
      x.test(Array.from(qa(v, 'a')).some(a => a.innerText.trim() == 'md'), 'a link with an unsafe target still shows its text');
      x.test(q(v, 'a[href="Client Programs"]'), 'a link to a page by name keeps its href');
      v.remove();

      // Tags that load or run code do not render at all.
      v = await render(
        '<script>window.mdScriptRan = true</script>\n\n<iframe src="https://example.com/"></iframe>\n\n' +
        '<object data="x.swf"></object>\n\n<form action="https://example.com/"><b>in form</b></form>\n\n<p>after</p>\n');
      x.test(! q(v, 'script, iframe, object, form'), 'script, iframe, object and form do not render, got ' + html(v));
      x.test(q(v, 'p') && q(v, 'p').innerText.trim() == 'after', 'the document after them still renders');
      v.remove();

      // <br> breaks the line in all three spellings, inside a paragraph.
      v = await render('one<br>two<br/>three<br />four\n');
      x.test(qa(v, '.mdParagraph br').length == 3, '<br>, <br/> and <br /> each give a line break, got ' + html(v));
      x.test(v.el_().innerText.indexOf('<br') == -1, 'no <br shows as text, got ' + JSON.stringify(v.el_().innerText));
      v.remove();

      // A tag whose name only starts with br is not a line break.
      v = await render('<brief>short</brief>\n');
      x.test(! q(v, 'br'), '<brief> is not read as <br>, got ' + html(v));
      v.remove();
    }
  ]
});
