/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSTokensContrastTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    Contract test for the token colours: every text-on-surface pair in pairs
    clears its floor (WCAG AA, 4.5:1, unless the row says otherwise) in each of
    its colour modes, the surface ramps keep their order, and the inverse
    surfaces stay on the far side of the page. Resolves tokens through
    foam.CSS.returnTokenValue, and through the application's CSSTokenOverride
    rows when the context has a cssTokenOverrideDAO, so it measures the colours
    the screens really show. A dark variant that fails to resolve fails here.

    An application adds a pair by adding a row to pairs, in a subclass:
      pairs: { factory: function() {
        return this.defaultPairs().concat([
          { text: 'statusWarnText', background: 'statusWarnBackground' }
        ]);
      } }
    See CSSTokensContrastPairsTest.
  `,

  requires: [
    'foam.core.theme.customisation.CSSTokenOverrideService',
    'foam.u2.test.ContrastPair'
  ],

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.u2.test.ContrastPair',
      name: 'pairs',
      documentation: 'What runTest measures; see the class documentation to add a row.',
      factory: function() { return this.defaultPairs(); }
    }
  ],

  methods: [
    function luminance(hex) {
      // WCAG 2.x relative luminance of an sRGB hex colour.
      var c = foam.Color.parse(hex);
      return [ c.red, c.green, c.blue ].map(v => {
        v = v / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }).reduce((acc, v, i) => acc + v * [ 0.2126, 0.7152, 0.0722 ][i], 0);
    },

    function contrast(a, b) {
      var la = this.luminance(a), lb = this.luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    },

    function defaultPairs() {
      // foam3's own pairs: text on the surfaces it is drawn on, both modes,
      // and the status colours read as text on the dark page.
      var both = [
        [ 'textOnDestructive', 'backgroundDestructive' ],
        [ 'textOnDestructive', 'backgroundDestructiveSecondary' ], // destructive button hover
        [ 'textOnBrand',       'backgroundBrand' ],
        [ 'textOnInverse',     'backgroundInverse' ],
        [ 'textOnInverse',     'backgroundInverseSecondary' ],
        [ 'textDefault',       'backgroundDefault' ],
        [ 'textDefault',       'backgroundSecondary' ],
        [ 'textDefault',       'backgroundTertiary' ],
        [ 'textSecondary',     'backgroundDefault' ],
        [ 'textTertiary',      'backgroundDefault' ],
        [ 'textBrand',         'backgroundDefault' ],
        [ 'textDestructive',   'backgroundDefault' ]
      ].map(([ text, background ]) => this.ContrastPair.create({ text, background }));
      var statusOnDark = [ 'destructive', 'info', 'warn', 'success' ].map(text =>
        this.ContrastPair.create({ text, background: 'backgroundDefault', modes: [ 'dark' ] }));
      return both.concat(statusOnDark);
    },

    async function modeContext(x, variants) {
      // A theme-like object: returnTokenValue reads only id and activeVariants.
      var y = x.createSubContext({ theme: { id: x.theme?.id || '', activeVariants: variants } });
      if ( ! x.cssTokenOverrideDAO ) return y;
      // The application's override rows, read the way its styles read them.
      var service = this.CSSTokenOverrideService.create({}, y);
      await service.initLatch;
      return y.createSubContext({ cssTokenOverrideService: service });
    },

    function blend(colour, under) {
      // A see-through colour as the eye sees it: laid over the page colour.
      var c = foam.Color.parse(colour), u = foam.Color.parse(under);
      // parse() hands alpha back as written: '0.09', '9%' or nothing.
      var a = c.alpha === undefined ? 1 : parseFloat(c.alpha) / ( /%/.test(c.alpha) ? 100 : 1 );
      var hex = v => Math.round(v).toString(16).padStart(2, '0');
      return '#' + [ 'red', 'green', 'blue' ].map(k => hex(Number(c[k]) * a + Number(u[k]) * (1 - a))).join('');
    },

    async function runTest(x) {
      var cls   = foam.u2.CSSTokens;
      var modes = {
        light: await this.modeContext(x, { color: 'light' }),
        dark:  await this.modeContext(x, { color: 'dark' })
      };
      // A token that does not resolve comes back as a comment string, not a
      // colour; report that as one failed assertion and keep measuring the
      // rest instead of throwing out of luminance().
      // An rgb(), rgba(), hsl() or hsla() colour becomes hex. An opaque one
      // needs nothing under it; a see-through one is laid over what sits
      // under it: the pair's background for text, the page for a background.
      var functional = c => /^(rgba?|hsla?)\(/i.test(c);
      var opaque     = c => functional(c) && foam.Color.parse(c).alpha === undefined ? this.blend(c, c) : c;
      var resolve = (token, mode, under) => {
        var v = foam.CSS.returnTokenValue('$' + token, cls, modes[mode]);
        if ( functional(v) ) {
          v = opaque(v);
          under = opaque(under || foam.CSS.returnTokenValue('$backgroundDefault', cls, modes[mode]));
          if ( functional(v) && /^#[0-9a-f]{6}$/i.test(under) ) v = this.blend(v, under);
        }
        if ( ! /^#[0-9a-f]{6}$/i.test(v) ) {
          x.test(false, `${mode}: ${token} resolves to a colour, got ${v}`);
          return null;
        }
        return v;
      };

      for ( var pair of this.pairs ) {
        for ( var mode of pair.modes ) {
          if ( ! modes[mode] ) {
            x.test(false, `${pair.text} on ${pair.background}: unknown mode ${mode}, use light or dark`);
            continue;
          }
          var b = resolve(pair.background, mode);
          var f = b && resolve(pair.text, mode, b);
          if ( ! f || ! b ) continue;
          var r = this.contrast(f, b);
          x.test(r >= pair.floor,
            `${mode}: ${pair.text} ${f} on ${pair.background} ${b} is ${r.toFixed(2)}:1, floor ${pair.floor}:1`);
        }
      }

      // Surface ramps keep their order. Light surfaces get darker as they rise
      // and dark surfaces get lighter; the inverse ramp runs the other way in
      // each mode (default is the strongest contrast against the page).
      var ramp = (names, mode) => names.map(n => this.luminance(resolve(n, mode) || '#000000'));
      var ordered = (arr, dir) => arr.every((v, i) => i === 0 || (dir > 0 ? v > arr[i - 1] : v < arr[i - 1]));
      var surfaces = [ 'backgroundDefault', 'backgroundSecondary', 'backgroundTertiary' ];
      var inverse  = [ 'backgroundInverse', 'backgroundInverseSecondary', 'backgroundInverseTertiary' ];
      x.test(ordered(ramp(surfaces, 'light'), -1), 'light: surfaces darken default < secondary < tertiary');
      x.test(ordered(ramp(surfaces, 'dark'),   1), 'dark: surfaces lighten default < secondary < tertiary');
      x.test(ordered(ramp(inverse, 'light'),   1), 'light: inverse steps toward the page, default < secondary < tertiary');
      x.test(ordered(ramp(inverse, 'dark'),   -1), 'dark: inverse steps toward the page, default > secondary > tertiary');

      // Ordering alone still passes when the last step crosses to the page's
      // own side; an inverse surface that is darker than a dark page (or
      // lighter than a light one) has no contrast left for what sits on it.
      for ( var mode of Object.keys(modes) ) {
        var page = resolve('backgroundDefault', mode);
        for ( var name of inverse ) {
          var v = resolve(name, mode);
          if ( ! v || ! page ) continue;
          var lighter = this.luminance(v) > this.luminance(page), r = this.contrast(v, page);
          x.test(mode === 'dark' ? lighter : ! lighter,
            `${mode}: ${name} ${v} stays on the far side of the page ${page} (${r.toFixed(2)}:1)`);
        }
      }
    }
  ]
});
