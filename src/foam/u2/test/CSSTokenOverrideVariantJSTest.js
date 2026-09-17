/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSTokenOverrideVariantJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A CSSTokenOverride row with theme '' (every theme) and a
    variants: { dark } value must apply while activeVariants.color is dark.
    Before the fix the service only looked up '<token>-dark' under the current
    theme id, never under '', so a global dark override was silently ignored.`,

  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'surface',
      value: '#FFFFFF',
      variants: { dark: { value: '#0F0F0F' } }
    }
  ],

  methods: [
    async function runTest(x) {
      var tokenDAO = foam.dao.EasyDAO.create({
        of: foam.core.theme.customisation.CSSTokenOverride,
        daoType: 'MDAO'
      });
      var theme = foam.core.theme.Theme.create({ id: 'test-theme', activeVariants: { color: 'dark' } }, x);
      x = x.createSubContext({ cssTokenOverrideDAO: tokenDAO, theme: theme });
      var service = foam.core.theme.customisation.CSSTokenOverrideService.create({}, x);
      x = x.createSubContext({ cssTokenOverrideService: service });
      await service.initLatch;

      var val = () => foam.CSS.returnTokenValue('$surface', this.cls_, x);
      // reload is a merged listener fired by the DAO's on.put, so give it a tick.
      var settle = () => new Promise(res => setTimeout(res, 300));
      x.test(val() === '#0F0F0F', 'no override: dark variant from the token axiom');

      await tokenDAO.put(foam.core.theme.customisation.CSSTokenOverride.create({
        theme: '', source: 'surface', variants: { dark: '#202020' }
      }, x));
      await settle();
      x.test(val() === '#202020', "theme-less row's dark variant applies in dark mode");

      await tokenDAO.put(foam.core.theme.customisation.CSSTokenOverride.create({
        theme: 'test-theme', source: 'surface', variants: { dark: '#2B2B2B' }
      }, x));
      await settle();
      x.test(val() === '#2B2B2B', "current theme's dark row wins over the theme-less one");

      theme.activeVariants = {};
      x.test(val() === '#FFFFFF', 'light mode ignores both dark rows');
    }
  ]
});
