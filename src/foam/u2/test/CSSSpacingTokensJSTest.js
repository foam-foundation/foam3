/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSSpacingTokensJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The $space-* scale resolves and follows theme.activeVariants.density.`,

  methods: [
    async function runTest(x) {
      const T   = foam.u2.CSSTokens;
      const val = t => foam.CSS.returnTokenValue(t, T, x);

      x.test(val('$space-0') === '0',           '$space-0 is 0');
      x.test(val('$space-px') === '1px',        '$space-px is 1px');
      x.test(val('$space-0_5') === '0.2rem',    '$space-0_5 is 0.2rem (2px on the 10px root)');
      x.test(val('$space-4') === '1.6rem',      '$space-4 is 1.6rem (16px on the 10px root)');
      x.test(val('$space-96') === '38.4rem',    '$space-96 is 38.4rem');
      x.test(T.SPACE_4.variantKey === 'density', '$space-* carry variantKey density');

      // A theme that declares a density variant on a spacing token is served that
      // value once activeVariants.density names it, same rail dark mode uses for color.
      const tok = foam.u2.CSSToken.create({
        name: 'space-4', value: '1.6rem', variantKey: 'density',
        variants: { compact: { value: '1.2rem' } }
      });
      const compact = x.createSubContext({ theme: { activeVariants: { density: 'compact' } } });
      x.test(foam.CSS.getTokenValue(['space-4', T, '', tok], compact) === '1.2rem',
        'activeVariants.density = compact serves the compact value');
      x.test(foam.CSS.getTokenValue(['space-4', T, '', tok], x) === '1.6rem',
        'no active density serves the default value');
    }
  ]
});
