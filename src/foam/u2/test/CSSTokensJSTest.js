/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSTokensJSTest',
  extends: 'foam.core.test.JSTest',

  requires: ['foam.lang.Latch'],

  css: `
    ^test1 {
      background: $test1;
      color: $test1$foreground;
    }
    ^test2 {
      background: $test1$hover;
      color: $test1$hover$foreground;
    }
  `,
  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'test1',
      value: '$red300' // #E93F48
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
      // console.log('CSSTokensTest a.expandCSS (initial)', expanded);
      x.installCSS(expanded);
      var color = "$green300"; // #59D374
      var result = await tokenDAO.put(foam.core.theme.customisation.CSSTokenOverride.create({ theme: '', source: 'test1', target: color }, x));
      /// console.log('CSSTokensTest override.put', result);

      await new Promise(res => setTimeout(res, 200)); // wait for reload after dao update

      expanded = a.expandCSS(this.cls_, a.code, x);
      x.test(expanded.includes("background: /*$test1*/ #59D374;"), "color $green300");
      // console.log('CSSTokensTest a.expandCSS (outer)', expanded);
    }
  ]
});
