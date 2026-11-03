/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSTokenVariantKeyJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A CSSToken that declares a variants map must also say which
    axis it listens to (variantKey). Without the key the map is never read, so
    the token looks themed and silently renders its base value in every mode.
    Declaring one logs a warning at class load; the class still loads and the
    token keeps rendering its base value.`,

  methods: [
    function runTest(x) {
      // The token axiom is created in the root context, whose warn() writes
      // to console.warn, so capture it there for the class definition only.
      var warnings = [];
      var origWarn = console.warn;
      console.warn = function() { warnings.push(Array.from(arguments).join(' ')); };
      var threw = null;
      try {
        foam.CLASS({
          package: 'foam.u2.test',
          name: 'CSSTokenVariantKeyBad_',
          extends: 'foam.u2.Element',
          cssTokens: [
            { name: 'panelBg', value: 'white', variants: { dark: { value: 'black' } } }
          ]
        });
        foam.u2.test.CSSTokenVariantKeyBad_.PANEL_BG;
      } catch (e) {
        threw = e;
      } finally {
        console.warn = origWarn;
      }
      x.test(! threw, 'variants without variantKey still loads the class, got: ' + (threw && threw.message));
      var hits = warnings.filter(w => /panelBg/.test(w));
      x.test(hits.length === 1 && /CSSTokenVariantKeyBad_\.panelBg/.test(hits[0]) && /variantKey/.test(hits[0]),
        'one warning names the class, the token and the missing field, got: ' + JSON.stringify(warnings));
      var B = foam.u2.test.CSSTokenVariantKeyBad_;
      var darkBadX = x.createSubContext({ theme: { activeVariants: { color: 'dark' } } });
      x.test(foam.CSS.returnTokenValue('$panelBg', B, darkBadX) === 'white',
        'the unkeyed token renders its base value in dark mode');

      threw = null;
      try {
        foam.CLASS({
          package: 'foam.u2.test',
          name: 'CSSTokenVariantKeyGood_',
          extends: 'foam.u2.Element',
          cssTokens: [
            { name: 'panelBg', value: 'white', variantKey: 'color', variants: { dark: { value: 'black' } } },
            { name: 'pad', value: '8px' }
          ]
        });
      } catch (e) {
        threw = e;
      }
      x.test(! threw, 'variants with variantKey loads, got: ' + (threw && threw.message));
      var G = foam.u2.test.CSSTokenVariantKeyGood_;
      var lightX = x.createSubContext({ theme: { activeVariants: {} } });
      var darkX  = x.createSubContext({ theme: { activeVariants: { color: 'dark' } } });
      x.test(foam.CSS.returnTokenValue('$panelBg', G, lightX) === 'white', 'light resolves the base value');
      x.test(foam.CSS.returnTokenValue('$panelBg', G, darkX) === 'black', 'dark resolves the dark variant');
      x.test(foam.CSS.returnTokenValue('$pad', G, darkX) === '8px', 'a token with no variants and no key is fine');
    }
  ]
});
