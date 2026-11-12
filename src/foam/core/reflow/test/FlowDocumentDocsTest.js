/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'FlowDocumentDocsTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    A side <toc side> lists only the sections beside the document, a plain
    <toc> keeps its title and every heading, and <docnav> shows where a flow
    sits in its series and links the flows before and after.
  `,

  requires: [
    'foam.core.reflow.Flow',
    'foam.core.reflow.FlowDocumentNav',
    'foam.dao.MDAO',
    'foam.u2.view.MarkdownView'
  ],

  methods: [
    async function runTest(x) {
      var self    = this;
      var flowDAO = this.MDAO.create({ of: this.Flow }, x);
      x = x.createSubContext({ flowDAO: flowDAO });

      var doc = (name, category, keywords) => flowDAO.put(this.Flow.create({
        name: name, category: category, keywords: keywords || [ 'knowledge' ]
      }, x));
      // Put out of order: reading order is name order
      await doc('3. Deploy',    'Guides');
      await doc('1. Install',   'Guides');
      await doc('2. Configure', 'Guides');
      await doc('Elsewhere',    'Other');
      await doc('A plain flow', 'Guides', [ 'dashboard' ]);

      var render = async (md, sub) => {
        var v = self.MarkdownView.create({ data: md }, sub || x);
        v.write(x.document.body);
        await new Promise(r => setTimeout(r, 100));
        return v;
      };
      var texts = (v, sel) => Array.from(v.el_().querySelectorAll(sel)).map(e => e.textContent.trim());

      var md = '# Title\n\n<toc side></toc>\n\n## One\n\ntext\n\n### Two\n\ntext\n';
      var v  = await render(md);
      var toc = v.el_().querySelector('.foam-u2-markdown-TableOfContents');
      x.test(toc && toc.classList.contains('foam-u2-markdown-TableOfContents-side'), 'a side TOC is marked as one');
      x.test(texts(v, '.foam-u2-markdown-TableOfContents-item').join('|') === 'One|Two',
        'a side TOC lists the sections and leaves out the title, got ' + texts(v, '.foam-u2-markdown-TableOfContents-item'));
      v.remove();

      v = await render(md.replace('<toc side>', '<toc>'));
      x.test(texts(v, '.foam-u2-markdown-TableOfContents-item').join('|') === 'Title|One|Two',
        'a plain TOC still lists every heading, got ' + texts(v, '.foam-u2-markdown-TableOfContents-item'));
      x.test(texts(v, '.foam-u2-markdown-TableOfContents-title')[0] === 'Table of Contents', 'a plain TOC keeps its title');
      v.remove();

      // What <docnav> shows for a flow: its crumb line and where its links go
      var navFor = async (name, args) => {
        var flow = await flowDAO.find(name);
        var n = self.FlowDocumentNav.create(args || {}, x.createSubContext({ flow: flow }));
        n.write(x.document.body);
        await new Promise(r => setTimeout(r, 100));
        var crumbs = texts(n, '.foam-core-reflow-FlowDocumentNav-crumbs')[0] || '';
        var hrefs  = Array.from(n.el_().querySelectorAll('.foam-core-reflow-FlowDocumentNav-link')).map(a => a.getAttribute('href'));
        n.remove();
        return { crumbs: crumbs.replace(/^.*›\s*/, ''), hrefs: hrefs.join('|') };
      };
      var nav = await navFor('2. Configure');
      x.test(nav.crumbs === 'Guides · 2 of 3', 'a document shows its category and position, got ' + nav.crumbs);
      x.test(nav.hrefs === '1. Install|3. Deploy', 'a middle document links back and on, got ' + nav.hrefs);
      nav = await navFor('1. Install');
      x.test(nav.hrefs === '2. Configure', 'the first document has no previous link, got ' + nav.hrefs);
      nav = await navFor('A plain flow');
      x.test(nav.crumbs === '' && nav.hrefs === '', 'a flow outside the series shows nothing, got ' + nav.crumbs);
      nav = await navFor('A plain flow', { keyword: 'dashboard' });
      x.test(nav.crumbs === 'Guides · 1 of 1', 'the keyword attribute picks another series, got ' + nav.crumbs);
    }
  ]
});
