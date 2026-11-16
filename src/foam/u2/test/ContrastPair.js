/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'ContrastPair',

  documentation: `
    One row of CSSTokensContrastTest's pairs: a text colour token, the
    background token it sits on, the colour modes to measure it in, and the
    lowest contrast ratio that passes.
  `,

  properties: [
    {
      class: 'String',
      name: 'text',
      documentation: `
        A token name without the $, such as textDefault. A token a class
        declares itself takes the class too: foam.u2.tag.Button.buttonSecondaryBorderColor.
      `
    },
    {
      class: 'String',
      name: 'background',
      documentation: 'A token name without the $, such as backgroundDefault; see text.'
    },
    {
      class: 'StringArray',
      name: 'modes',
      factory: function() { return [ 'light', 'dark' ]; },
      javaFactory: 'return new String[] { "light", "dark" };'
    },
    {
      class: 'Double',
      name: 'floor',
      value: 4.5,
      documentation: `
        WCAG 2.x: 4.5 for body text, 3 for large text and for a border or an
        icon a person must see (non-text contrast).
      `
    }
  ]
});
