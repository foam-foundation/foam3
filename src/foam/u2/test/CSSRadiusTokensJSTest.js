/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSRadiusTokensJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The $radius-* scale resolves.`,

  methods: [
    async function runTest(x) {
      const T   = foam.u2.CSSTokens;
      const val = t => foam.CSS.returnTokenValue(t, T, x);

      x.test(val('$radius-none') === '0',      '$radius-none is 0');
      x.test(val('$radius') === '0.4rem',      '$radius (unsuffixed) is 0.4rem');
      x.test(val('$radius-lg') === '0.8rem',   '$radius-lg is 0.8rem');
      x.test(val('$radius-full') === '9999px', '$radius-full is 9999px');
      x.test(T.RADIUS.variantKey === '',       '$radius-* carry no variantKey');
    }
  ]
});
