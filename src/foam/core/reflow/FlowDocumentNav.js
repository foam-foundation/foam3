/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowDocumentNav',
  extends: 'foam.u2.Element',
  implements: [ 'foam.mlang.Expressions' ],

  documentation: `
    Where a flow sits in a series of flows, for the end of a document:
      <docnav></docnav>
    A series is the flows of one category that carry a keyword, in name order.
    In a "Guides" category holding "1. Install", "2. Configure" and
    "3. Deploy", the end of "2. Configure" shows "Knowledge Base › Guides ·
    2 of 3", then links back to "1. Install" and on to "3. Deploy".

    The defaults make the series the Knowledge Base documents of the category.
    Attributes pick another series and the menu the first crumb links to:
      <docnav keyword="tutorial" home="tutorials"></docnav>
    The first crumb shows that menu's label. Each link is an <a> naming a flow,
    which opens that flow in place.
  `,

  requires: [ 'foam.core.reflow.Flow' ],

  imports: [ 'flow?', 'flowDAO?', 'menuDAO?' ],

  css: `
    << {
      margin-top: 3.2rem;
      padding-top: 1.6rem;
      border-top: 1px solid $borderLight;
    }
    <<crumbs {
      display: flex;
      gap: 0.8rem;
      margin-bottom: 1.2rem;
      color: $textSecondary;
    }
    <<links {
      display: flex;
      justify-content: space-between;
      gap: 1.6rem;
    }
    <<link {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      max-width: 45%;
      padding: 1.2rem 1.6rem;
      border: 1px solid $borderLight;
      border-radius: 0.8rem;
      text-decoration: none;
    }
    <<link:hover {
      border-color: $borderBrand;
    }
    <<next {
      margin-left: auto;
      text-align: right;
    }
    <<label {
      color: $textSecondary;
    }
  `,

  messages: [
    { name: 'OF',       message: 'of' },
    { name: 'PREVIOUS', message: 'Previous' },
    { name: 'NEXT',     message: 'Next' }
  ],

  properties: [
    {
      class: 'String',
      name: 'keyword',
      attribute: true,
      documentation: 'The keyword every flow of the series carries.',
      value: 'knowledge'
    },
    {
      class: 'String',
      name: 'home',
      attribute: true,
      documentation: 'The id of the menu that lists the series, linked from the first crumb.',
      value: 'knowledgeBase'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass();
      if ( ! this.flow || ! this.flowDAO ) return;

      // Loading a flow copies it into the same object, so this follows the
      // fields that place it rather than the object
      this.add(this.dynamic(async function(flow$name, flow$category) {
        var names = await self.findSeries();
        var i     = names.indexOf(flow$name);
        if ( i < 0 || self.flow.name !== flow$name ) return;
        var home  = self.menuDAO && await self.menuDAO.find(self.home);
        this
          .start().addClass(self.myClass('crumbs'), 'p-sm')
            .callIf(home, function() {
              this.start('a').attrs({ href: '#' + self.home }).add(home.label).end().add('›');
            })
            .add(flow$category, ' · ', i + 1, ' ', self.OF, ' ', names.length)
          .end()
          .start().addClass(self.myClass('links'))
            .callIf(i > 0,                function() { self.renderLink(this, names[i - 1], false); })
            .callIf(i < names.length - 1, function() { self.renderLink(this, names[i + 1], true); })
          .end();
      }));
    },

    async function findSeries() {
      /**
       * The names of the flows in this flow's series, in name order. The DAO
       * leaves out flows the user may not read, so each user counts only the
       * ones they can open. Only names are fetched, not each flow's markdown.
       */
      var sink = await this.flowDAO
        .where(this.AND(
          this.EQ(this.Flow.CATEGORY, this.flow.category),
          this.IN(this.keyword, this.Flow.KEYWORDS)))
        .orderBy(this.Flow.NAME)
        .select(this.PROJECTION(this.Flow.NAME));
      return sink.array.map(f => f.name);
    },

    function renderLink(e, name, isNext) {
      e.start('a')
        .addClass(this.myClass('link'))
        .enableClass(this.myClass('next'), isNext)
        .attrs({ href: name })
        .start('span').addClass(this.myClass('label'), 'p-sm').add(isNext ? this.NEXT : this.PREVIOUS).end()
        .start('span').addClass('p-semiBold').add(isNext ? name + ' →' : '← ' + name).end()
      .end();
    }
  ]
});


foam.SCRIPT({
  package: 'foam.core.reflow',
  name: 'FlowDocumentNavScript',
  code: function() {
    foam.__context__.registerElement(foam.core.reflow.FlowDocumentNav, 'docnav');
  }
});
