/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.u2.markdown',
  name: 'HintCategory',
  documentation: 'Categories for Markdown hints',

  properties: [
    {
      class: 'String',
      name: 'cssClass',
      documentation: 'CSS class for styling the hint based on category'
    },
    {
      class: 'String',
      name: 'glyphName',
      documentation: 'Name of the glyph used for this hint category'
    }
  ],

  values: [
    {
      name: 'HINT',
      label: 'Hint',
      cssClass: 'hint',
      glyphName: 'hintInfo' 
    },
    {
      name: 'WARNING',
      label: 'Warning',
      cssClass: 'warning',
      glyphName: 'hintWarning'
    },
    {
      name: 'SUCCESS',
      label: 'Success',
      cssClass: 'success',
      glyphName: 'hintSuccess'
    },
    {
      name: 'DANGER',
      label: 'Danger',
      cssClass: 'danger',
      glyphName: 'hintDanger'
    }
  ]
});