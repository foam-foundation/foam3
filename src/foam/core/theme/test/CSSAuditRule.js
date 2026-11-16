/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.theme.test',
  name: 'CSSAuditRule',

  documentation: `
    One row of CSSAuditTest's rules: where to look, which names, what is
    allowed there, and what to say when it is not.
  `,

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'where',
      value: 'declaration',
      documentation: `
        'declaration': match is tested against a declaration's property name.
        'selector': match is tested against a rule's selectors.
      `
    },
    {
      class: 'String',
      name: 'match',
      documentation: 'A regular expression, found anywhere unless anchored.'
    },
    {
      class: 'StringArray',
      name: 'allow',
      documentation: `
        What a declaration's value may hold: token, var, placeholder, url,
        percent, or keyword:<regexp> for an identifier or a unitless number.
      `
    },
    {
      class: 'String',
      name: 'literalIs',
      documentation: `
        Empty: every part of the value has to be allowed. 'colour': only a
        colour literal (a hex, a colour function, a named colour, also inside a
        gradient) breaks the rule. 'font': only a single font keyword is
        allowed besides allow:.
      `
    },
    {
      class: 'String',
      name: 'outside',
      documentation: 'A path prefix, from project.home, where the rule does not apply.'
    },
    {
      class: 'String',
      name: 'advice',
      documentation: 'Printed after the declaration or selector that breaks the rule.'
    },
    {
      class: 'String',
      name: 'level',
      value: 'error',
      documentation: "'error' fails the test; 'warn' only logs a warning."
    }
  ]
});
