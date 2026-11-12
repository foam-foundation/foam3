/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowDocumentNav',
  extends: 'foam.u2.Element',

  documentation: `
    Links to the previous and next document of the same Knowledge Base
    category, for the end of a document:
      <docnav></docnav>
    In a "Guides" category holding "1. Install", "2. Configure" and "3. Deploy",
    the end of "2. Configure" links back to "1. Install" and on to "3. Deploy".
    The first document has no previous link and the last no next link. Each
    link is an <a> naming a flow, which opens that flow in place.
  `,

  imports: [ 'flow?' ],

  css: `
    << {
      display: flex;
      justify-content: space-between;
      gap: 1.6rem;
      margin-top: 3.2rem;
      padding-top: 1.6rem;
      border-top: 1px solid $borderLight;
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
    { name: 'PREVIOUS', message: 'Previous' },
    { name: 'NEXT',     message: 'Next' }
  ],

  methods: [
    function render() {
      var self = this;
      this.addClass();
      if ( ! this.flow ) return;

      // Loading a flow copies it into the same object, so this follows its name
      this.add(this.dynamic(async function(flow$name) {
        var place = await self.flow.findDocumentPlace();
        if ( ! place || self.flow.name !== flow$name ) return;
        var names = place.names, i = place.index;
        if ( i > 0 )                self.renderLink(this, names[i - 1], false);
        if ( i < names.length - 1 ) self.renderLink(this, names[i + 1], true);
      }));
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
