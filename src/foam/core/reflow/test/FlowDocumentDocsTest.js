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
    Knowledge Base documents know their place in their category, a side
    <toc side> lists only the sections beside the document, a plain <toc>
    keeps its title and every heading, and <docnav> links the documents
    before and after.
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

      var place = await ( await flowDAO.find('2. Configure') ).findDocumentPlace();
      x.test(place && place.names.join('|') === '1. Install|2. Configure|3. Deploy',
        'a document lists the documents of its category in name order, got ' + ( place && place.names ));
      x.test(place && place.index === 1, 'a document knows its own position, got ' + ( place && place.index ));
      x.test(( await ( await flowDAO.find('A plain flow') ).findDocumentPlace() ) === null,
        'a flow without the knowledge keyword has no place');

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

      var navFor = async name => {
        var flow = await flowDAO.find(name);
        var n = self.FlowDocumentNav.create({}, x.createSubContext({ flow: flow }));
        n.write(x.document.body);
        await new Promise(r => setTimeout(r, 100));
        var hrefs = Array.from(n.el_().querySelectorAll('a')).map(a => a.getAttribute('href'));
        n.remove();
        return hrefs.join('|');
      };
      var hrefs = await navFor('2. Configure');
      x.test(hrefs === '1. Install|3. Deploy', 'a middle document links back and on, got ' + hrefs);
      hrefs = await navFor('1. Install');
      x.test(hrefs === '2. Configure', 'the first document has no previous link, got ' + hrefs);
    }
  ]
});
