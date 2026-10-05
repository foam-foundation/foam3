/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSMotionTokensJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The $duration-* and $ease-* tokens resolve.`,

  methods: [
    async function runTest(x) {
      const T   = foam.u2.CSSTokens;
      const val = t => foam.CSS.returnTokenValue(t, T, x);

      x.test(val('$duration-150') === '150ms',  '$duration-150 is 150ms');
      x.test(val('$duration-1000') === '1000ms', '$duration-1000 is 1000ms');
      x.test(val('$ease-linear') === 'linear',  '$ease-linear is linear');
      x.test(val('$ease-in-out') === 'cubic-bezier(0.4, 0, 0.2, 1)', '$ease-in-out is the Tailwind curve');
    }
  ]
});
