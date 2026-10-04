/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSElevationTokensJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The $shadow-* scale resolves and gets a stronger value in dark mode.`,

  methods: [
    async function runTest(x) {
      const T   = foam.u2.CSSTokens;
      const val = t => foam.CSS.returnTokenValue(t, T, x);

      // The test context inherits the browser's colour scheme through
      // foam.lang.Window, so pin each assertion to an explicit variant set.
      const light = x.createSubContext({ theme: { activeVariants: {} } });
      const dark  = x.createSubContext({ theme: { activeVariants: { color: 'dark' } } });

      x.test(val('$shadow-none') === '0 0 #0000', '$shadow-none is transparent');
      x.test(foam.CSS.returnTokenValue('$shadow-md', T, light).startsWith('0 4px 6px -1px rgb(0 0 0 / 0.1)'),
        '$shadow-md is the light recipe');
      x.test(foam.CSS.returnTokenValue('$shadow-md', T, dark).startsWith('0 4px 6px -1px rgb(0 0 0 / 0.4)'),
        '$shadow-md is stronger in dark mode');
      x.test(T.SHADOW_MD.variantKey === 'color', '$shadow-* carry variantKey color so the dark variant applies');
    }
  ]
});
