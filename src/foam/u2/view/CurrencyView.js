/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'CurrencyView',
  extends: 'foam.u2.view.ModeAltView',

  documentation: 'A view for foam.lang.Currency properties.',

  requires: [
    'foam.u2.CurrencyView'
  ],

  properties: [
    {
      name: 'readView',
      value: { class: 'foam.u2.CurrencyView' }
    },
    {
      name: 'writeView',
      value: { class: 'foam.u2.CurrencyView', hideSymbol: true }
    }
  ]
});
