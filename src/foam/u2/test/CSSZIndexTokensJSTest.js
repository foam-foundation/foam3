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

      // Page layers must keep this order: chrome under popups, popups under modals,
      // and the two body-level layers (tooltip, toast) above modals.
      const layer = n => parseInt(val('$z-' + n), 10);
      x.test(layer('nav') > layer('50'),         '$z-nav is above every local $z-*');
      x.test(layer('popup') > layer('nav'),      '$z-popup is above $z-nav');
      x.test(layer('modal') > layer('popup'),    '$z-modal is above $z-popup');
      x.test(layer('tooltip') > layer('modal'),  '$z-tooltip is above $z-modal');
      x.test(layer('toast') > layer('tooltip'),  '$z-toast is above $z-tooltip');

      // OverlayDropdown is mounted at the app root, beside any open modal, so
      // its list and its click-away layer must both clear the modal backdrop
      // and stay under tooltips.
      const D    = foam.u2.md.OverlayDropdown;
      const css  = foam.u2.CSS.create({ code: D.model_.css }, x).expandCSS(D, D.model_.css, x);
      const zOf  = sel => {
        const block = css.split(sel + ' {')[1].split('}')[0];
        const expr  = block.match(/z-index:\s*([^;]+);/)[1].replace(/\/\*[^*]*\*\//g, '');
        return expr.match(/\d+/g).reduce((a, n) => a + parseInt(n, 10), 0);
      };
      const list  = zOf('.foam-u2-md-OverlayDropdown');
      const scrim = zOf('.foam-u2-md-OverlayDropdown-overlay');
      x.test(scrim > layer('modal') && list > scrim && list < layer('tooltip'),
        'OverlayDropdown sits above $z-modal and under $z-tooltip, got list ' + list + ', scrim ' + scrim);
    }
  ]
});
