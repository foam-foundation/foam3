/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'FSMTestSupport',

  documentation: 'Shared helpers for FSM/FSMDAO regression tests.',

  requires: [
    'foam.dao.MDAO'
  ],

  static: [
    function inMemoryDAOFor(of) {
      return foam.dao.MDAO.create({ of: of });
    },

    function assertHistoryEquals(x, history, expectedFromTos, label) {
      x.test(history.length === expectedFromTos.length,
        (label || 'history') + ': length ' + expectedFromTos.length + ', got ' + history.length);
      for ( var i = 0 ; i < expectedFromTos.length ; i++ ) {
        var pair = expectedFromTos[i];
        x.test(history[i].from === pair[0] && history[i].to === pair[1],
          (label || 'history') + '[' + i + ']: ' + pair[0] + '→' + pair[1] +
          ', got ' + history[i].from + '→' + history[i].to);
      }
    }
  ]
});
