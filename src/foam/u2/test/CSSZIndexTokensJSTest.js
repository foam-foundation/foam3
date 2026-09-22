/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSZIndexTokensJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The $z-* scale resolves.`,

  methods: [
    async function runTest(x) {
      const T   = foam.u2.CSSTokens;
      const val = t => foam.CSS.returnTokenValue(t, T, x);

      x.test(val('$z-0') === '0',   '$z-0 is 0');
      x.test(val('$z-50') === '50', '$z-50 is 50');
    }
  ]
});
