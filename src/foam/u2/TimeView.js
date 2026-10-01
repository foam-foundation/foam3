/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'TimeView',
  extends: 'foam.u2.tag.Input',

  documentation: 'View for editing Time values.',

  mixins: [ 'foam.u2.TextInputCSS' ],

  css: `
    ^:read-only:not(:disabled) { border: none; background: transparent; margin-left: -8px; }
    ^:not(:read-only) { height: $inputHeight;  min-width: 130px; }
  `,

  properties: [ ['type', 'time'] ]
});
