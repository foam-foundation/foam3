/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSTokensJSTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.lang.Latch',
    'foam.u2.tag.Button'
  ],

  css: `
    ^test1 {
      background: $test1;
      color: $test1$foreground;
    }
    ^test2 {
      background: $test1$hover;
      color: $test1$hover$foreground;
    }
    ^test3 {
      box-shadow: 0 0 6px $shadowColor !important;
    }
    ^test4 {
      box-shadow: 0 0 4px $shadowColor!important;
    }
    ^test5 {
      box-shadow: 0 0 9px $shadowColor     !important;
    }
  `,
  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'test1',
      value: '$red300' // #E93F48
    },
    {
      // A token whose name ends in a letter, used right before `!important`
      // with the idiomatic space in between. constantize() inserts an
      // underscore after a trailing-space-preceding letter, so a swallowed
      // space turns shadowColor into SHADOW_COLOR_ and the lookup fails.
      name: 'shadowColor',
      value: 'red'
    }
  ],

  methods: [
    async function runTest(x) {

      // test override service
      var tokenDAO =  foam.dao.EasyDAO.create({
        of: foam.core.theme.customisation.CSSTokenOverride,
        daoType: 'MDAO'
      });
      x = x.createSubContext({
        'cssTokenOverrideDAO': tokenDAO
      });
      var tokenService = foam.core.theme.customisation.CSSTokenOverrideService.create({}, x);
      x = x.createSubContext({
        'cssTokenOverrideService': tokenService
      });
      var a = foam.u2.CSS.create({ code: this.cls_.model_.css  }, x);
      // tokenService.sub('cacheUpdated', () => {
      //   console.log('CSSTokensTest a.expandCSS (cache)', a.expandCSS(this.cls_, a.code, x));
      // });
      var expanded = a.expandCSS(this.cls_, a.code, x);
      x.test(expanded.includes("background: /*$test1*/ #E93F48;"), "color $red300");
      // Regression: a space between a token and `!important` was swallowed into
      // the token name, so the token silently failed to resolve. Cover the three
      // spacings: none, single space, and several spaces.
      x.test(expanded.includes("box-shadow: 0 0 4px /*$shadowColor*/ red!important;"),
        "token directly before !important (no space) resolves");
      x.test(expanded.includes("box-shadow: 0 0 6px /*$shadowColor*/ red!important;"),
        "token followed by a space and !important resolves");
      x.test(expanded.includes("box-shadow: 0 0 9px /*$shadowColor*/ red!important;"),
        "token followed by several spaces and !important resolves");
      // console.log('CSSTokensTest a.expandCSS (initial)', expanded);
      x.installCSS(expanded);
      var color = "$green300"; // #59D374
      var result = await tokenDAO.put(foam.core.theme.customisation.CSSTokenOverride.create({ theme: '', source: 'test1', target: color }, x));
      /// console.log('CSSTokensTest override.put', result);

      await new Promise(res => setTimeout(res, 200)); // wait for reload after dao update

      expanded = a.expandCSS(this.cls_, a.code, x);
      x.test(expanded.includes("background: /*$test1*/ #59D374;"), "color $green300");
      // console.log('CSSTokensTest a.expandCSS (outer)', expanded);

      // Regression: Button's secondary border is LIGHTEN($buttonSecondaryColor, -40)
      // in light (#999999 on white). LIGHTEN clamps at grey 150, so on the
      // #0F0F0F dark surface no amount reaches the 3:1 floor (+40 gave
      // #171717, -40 gave #363636); dark resolves the semantic strong border.
      var border = '^ { border-color: $buttonSecondaryBorderColor; }';
      var lightX = x.createSubContext({ theme: { activeVariants: {} } });
      var darkX  = x.createSubContext({ theme: { activeVariants: { color: 'dark' } } });
      var b = foam.u2.CSS.create({ code: border }, x);
      x.test(b.expandCSS(this.Button, border, lightX).includes('rgb(153.0000,153.0000,153.0000)'),
        'secondary border on the white surface is #999999');
      x.test(b.expandCSS(this.Button, border, darkX).includes('#6B778C'),
        'secondary border on the $black500 surface is $borderStrong (#6B778C, 4.24:1)');

      // Regression: the icon shape rule (`^ svg :is(path, ...) { fill: currentColor }`)
      // must not reach the loading spinner's <path>, or the per-state
      // `^X ^loading svg { fill }` rules lose to it. A disabled text button
      // shows the difference: currentColor is $textTertiary, its spinner rule $buttonPrimaryColor.
      var btn = this.Button.create({ label: 'go', buttonStyle: 'TEXT' }, x);
      btn.write();
      btn.attrs({ disabled: true });
      btn.loading_ = true;
      await new Promise(res => setTimeout(res, 100));
      var svg  = btn.element_.querySelector('svg');
      var path = svg && svg.querySelector('path');
      x.test(!! path, 'loading spinner rendered a path');
      if ( path ) {
        var svgFill  = getComputedStyle(svg).fill;
        var pathFill = getComputedStyle(path).fill;
        x.test(pathFill === svgFill,
          'spinner path inherits the ^loading svg fill (' + svgFill + '), got ' + pathFill);
      }
      btn.element_.remove();
      btn.detach();
    }
  ]
});
