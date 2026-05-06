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
    'eval_',
    'flowDAO'
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

        let flow = await self.flowDAO.find(href);

        if ( flow ) {
          // Just load flows directly rather than changing the window hash
          // This avoids changing the FLOW_MODE and it lets flows be accessed
          // directly by their name rather than their URL
          self.on('click', () => {
            this.eval_(`load("${href}")`);
          });
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
