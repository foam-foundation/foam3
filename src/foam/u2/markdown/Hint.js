/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Hint',
  extends: 'foam.u2.Controller',
  documentation: `
    Renders a body of text within a "hint" box
  `,

  imports: [ 'markdownContext' ],

  properties: [
    {
      class: 'String',
      name: 'hint',
      attribute: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.start('h1').add('Hint').end();
    }
  ]
});

foam.SCRIPT({
  package: 'foam.u2.markdown',
  name: 'HintTagScript',
  documentation: 'Registers hint custom elements for use in markdown',

  code: function() {
    foam.__context__.registerElement(foam.u2.markdown.Hint, 'hint'); //<hint>
  }
});