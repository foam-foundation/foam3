/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ColorEditView',
  extends: 'foam.u2.MultiView',

  css: `
    <<container:first-child {
      flex-grow: 1;
    }
  `,

  properties: [
    {
      name: 'views',
      factory: () => [
        { class: 'foam.u2.TextField' },
        { class: 'foam.u2.view.ColorPicker' }
      ]
    }
  ]
});
