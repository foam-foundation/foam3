/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Link',
  extends: 'foam.u2.Element',

  documentation: 'Add behaviour to the "a" anchor tag so that it can load FLOWS better.',

  imports: [
    'document',
    'eval_',
    'flowDAO?'
  ],

  properties: [
    [ 'nodeName', 'a' ],
    {
      name: 'href',
      attribute: true
    }
  ],

  methods: [
    function render() {
      let self = this;

      this.dynamic(async function (href) {
        if ( ! href ) return;

        if ( href.startsWith('#') ) {
          // "#part-two" names a heading of this document: scroll to it. Left
          // to the browser it would become the page hash, which the
          // application reads as a route. A "#" link that names no element,
          // such as "#flow_/Name", is a route and stays with the browser.
          self.on('click', e => {
            let target = self.document.getElementById(decodeURIComponent(href.substring(1)));
            if ( ! target ) return;
            e.preventDefault();
            target.scrollIntoView();
          });
        }

        if ( this.flowDAO ) {
          let flow = await self.flowDAO.find(href);

          if ( flow ) {
            // Just load flows directly rather than changing the window hash
            // This avoids changing the FLOW_MODE and it lets flows be accessed
            // directly by their name rather than their URL
            // The href is a flow name, not a URL, so the browser must not
            // follow it: "Support and Contacts" would open a 404 page.
            self.on('click', e => {
              e.preventDefault();
              this.eval_(`load("${href}")`);
            });
          }
        }
        self.element_.setAttribute('href', href);
      });
    }
  ]
});


foam.SCRIPT({
  package: 'foam.core.reflow',
  name: 'LinkScript',
  code: function() {
    foam.__context__.registerElement(foam.core.reflow.Link, 'a');
  }
});
