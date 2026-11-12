/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowDocumentCrumbs',
  extends: 'foam.u2.View',

  documentation: `
    The breadcrumb a Knowledge Base document shows before its name in the
    Reflow header: "Knowledge Base › Guides · 2 of 3 ›". The first crumb links
    back to the Knowledge Base; the second names the category and where the
    document sits in it. Shows nothing for a flow that is not a document.
  `,

  requires: [ 'foam.u2.tag.Image' ],

  css: `
    << {
      display: contents;
    }
    <<crumb {
      color: $textSecondary;
      white-space: nowrap;
    }
    a<<crumb:hover {
      color: $textDefault;
    }
    <<chevron {
      color: $textSecondary;
    }
  `,

  messages: [
    { name: 'KNOWLEDGE_BASE', message: 'Knowledge Base' },
    { name: 'OF',             message: 'of' }
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.Flow',
      name: 'flow'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass();

      // Loading a flow copies it into the same object, so this follows the
      // fields that decide the crumbs rather than the object
      this.add(this.dynamic(async function(flow$name, flow$category, flow$keywords) {
        var place = await self.flow.findDocumentPlace();
        if ( ! place || self.flow.name !== flow$name ) return;
        this
          // A route, not a heading of this page, so the link leaves the flow
          .start('a').addClass(self.myClass('crumb'))
            .attrs({ href: '#knowledgeBase' })
            .add(self.KNOWLEDGE_BASE)
          .end()
          .call(self.renderChevron, [self])
          .start('span').addClass(self.myClass('crumb'))
            .add(flow$category, ' · ', place.index + 1, ' ', self.OF, ' ', place.names.length)
          .end()
          .call(self.renderChevron, [self]);
      }));
    },

    function renderChevron(self) {
      this.start(self.Image, { glyph: 'rightChevron', embedSVG: true })
        .addClass(self.myClass('chevron'))
      .end();
    }
  ]
});
