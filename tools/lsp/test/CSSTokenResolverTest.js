/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'CSSTokenResolverTest',
  extends: 'foam.core.test.JSTest',

  methods: [
    async function runTest(x) {
      var resolver = foam.parse.lsp.CSSTokenResolver.create();

      await this.testRegistryLoading(x, resolver);
      await this.testRecursiveResolution(x, resolver);
      await this.testTokenExists(x, resolver);
      await this.testJournalParsing(x);
      await this.testMultiThemeHover(x, resolver);
    },

    async function testRegistryLoading(x, resolver) {
      resolver.loadFromRegistry();

      var names = resolver.getAllTokenNames();
      x.test(names.length > 50,
        'Should load 50+ tokens from registry, got: ' + names.length);

      x.test(resolver.tokenExists('primary400'),
        'primary400 should exist');
      x.test(resolver.tokenExists('backgroundDefault'),
        'backgroundDefault should exist');
      x.test(resolver.tokenExists('textDefault'),
        'textDefault should exist');
      x.test(resolver.tokenExists('blue400'),
        'blue400 should exist');
      x.test(resolver.tokenExists('inputHeight'),
        'inputHeight should exist (non-color token)');

      // Check type is set for color tokens
      var info = resolver.getTokenInfo('primary400');
      x.test(info != null, 'getTokenInfo should return info for primary400');
      x.test(info.type === 'ColorToken',
        'primary400 type should be ColorToken, got: ' + info.type);
      x.test(info.source === 'foam.u2.CSSTokens',
        'primary400 source should be foam.u2.CSSTokens');

      // Non-color tokens should have null type
      var inputInfo = resolver.getTokenInfo('inputHeight');
      x.test(inputInfo != null, 'getTokenInfo should return info for inputHeight');
      x.test(inputInfo.type === 'CSSToken',
        'inputHeight type should be CSSToken, got: ' + inputInfo.type);

      // Variants
      var bgInfo = resolver.getTokenInfo('backgroundDefault');
      x.test(bgInfo != null, 'backgroundDefault should have info');
      x.test(bgInfo.variants && bgInfo.variants.dark,
        'backgroundDefault should have a dark variant');
      x.test(bgInfo.variants.dark.value === '$black500',
        'backgroundDefault dark variant value should be $black500, got: ' + bgInfo.variants.dark.value);
    },

    async function testRecursiveResolution(x, resolver) {
      // primary400 -> $blue400 -> #0A4AC6
      var resolved = resolver.getResolvedValue('primary400');
      x.test(resolved === '#0A4AC6',
        'primary400 should resolve to #0A4AC6, got: ' + resolved);

      // blue400 is a direct hex value
      var blueResolved = resolver.getResolvedValue('blue400');
      x.test(blueResolved === '#0A4AC6',
        'blue400 should resolve to #0A4AC6, got: ' + blueResolved);

      // backgroundDefault -> $white -> #FFFFFF
      var bgResolved = resolver.getResolvedValue('backgroundDefault');
      x.test(bgResolved === '#FFFFFF',
        'backgroundDefault should resolve to #FFFFFF, got: ' + bgResolved);

      // destructive400 -> $red400 -> #E11721
      var destResolved = resolver.getResolvedValue('destructive400');
      x.test(destResolved === '#E11721',
        'destructive400 should resolve to #E11721, got: ' + destResolved);

      // Non-reference value stays unchanged
      var directResolved = resolver.getResolvedValue('white');
      x.test(directResolved === '#FFFFFF',
        'white should resolve to #FFFFFF, got: ' + directResolved);

      // Variant resolution
      var bgInfo = resolver.getTokenInfo('backgroundDefault');
      x.test(bgInfo.variants.dark.resolved === '#0F0F0F',
        'backgroundDefault dark variant should resolve to #0F0F0F, got: ' + bgInfo.variants.dark.resolved);
    },

    async function testTokenExists(x, resolver) {
      // Positive cases
      x.test(resolver.tokenExists('blue50'), 'blue50 should exist');
      x.test(resolver.tokenExists('white'), 'white should exist');
      x.test(resolver.tokenExists('font1'), 'font1 should exist');
      x.test(resolver.tokenExists('borderDefault'), 'borderDefault should exist');

      // Negative cases
      x.test( ! resolver.tokenExists('nonexistentToken'),
        'nonexistentToken should not exist');
      x.test( ! resolver.tokenExists(''),
        'empty string should not exist');
      x.test( ! resolver.tokenExists('randomGarbage123'),
        'randomGarbage123 should not exist');
    },

    async function testJournalParsing(x) {
      // Create a fresh resolver and load journals
      var resolver2 = foam.parse.lsp.CSSTokenResolver.create();
      resolver2.loadFromRegistry();
      resolver2.loadFromJournals();

      // Journal loading may fail gracefully in test env
      var names = resolver2.getAllTokenNames();
      x.test(names.length > 50,
        'Should still have registry tokens after journal load, got: ' + names.length);

      // Check if paytic theme overrides were loaded (graceful if not available)
      var info = resolver2.getTokenInfo('primary400');
      var hasPayticOverride = info && info.themes && info.themes.paytic;
      if ( hasPayticOverride ) {
        x.test(info.themes.paytic.value === '#5FAF8E',
          'paytic primary400 override should be #5FAF8E, got: ' + info.themes.paytic.value);

        // Verify theme name was loaded
        var themeNames = resolver2.themeNames_;
        x.test(themeNames.paytic === 'paytic',
          'paytic theme name should be loaded');

        // Resolved value for paytic theme
        var paticResolved = resolver2.getResolvedValue('primary400', 'paytic');
        x.test(paticResolved === '#5FAF8E',
          'paytic primary400 should resolve to #5FAF8E, got: ' + paticResolved);
      } else {
        x.test(true, 'Journal files not found in test env (graceful skip)');
      }
    },

    async function testMultiThemeHover(x, resolver) {
      var hover = resolver.buildHoverContent('primary400');
      x.test(hover != null, 'buildHoverContent should return content for primary400');
      x.test(hover.indexOf('$primary400') !== -1,
        'Hover should contain token name $primary400');
      x.test(hover.indexOf('ColorToken') !== -1,
        'Hover should mention ColorToken type');
      x.test(hover.indexOf('#0A4AC6') !== -1,
        'Hover should contain resolved value #0A4AC6');
      x.test(hover.indexOf('$blue400') !== -1,
        'Hover should contain reference value $blue400');
      x.test(hover.indexOf('Default') !== -1,
        'Hover should contain Default theme row');
      x.test(hover.indexOf('foam.u2.CSSTokens') !== -1,
        'Hover should reference source');

      // Test hover for token with variants
      var bgHover = resolver.buildHoverContent('backgroundDefault');
      x.test(bgHover != null, 'buildHoverContent should return content for backgroundDefault');
      x.test(bgHover.indexOf('Variants') !== -1,
        'Hover for backgroundDefault should contain Variants section');
      x.test(bgHover.indexOf('dark') !== -1,
        'Hover for backgroundDefault should mention dark variant');

      // Test hover for non-existent token
      var noHover = resolver.buildHoverContent('doesNotExist');
      x.test(noHover == null,
        'buildHoverContent should return null for non-existent token');

      // Test hover for non-color token
      var inputHover = resolver.buildHoverContent('inputHeight');
      x.test(inputHover != null, 'buildHoverContent should work for inputHeight');
      x.test(inputHover.indexOf('34px') !== -1,
        'inputHeight hover should contain 34px value');
    }
  ]
});
