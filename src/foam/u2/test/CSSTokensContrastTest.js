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
    Contract test for the default token set in foam.u2.CSSTokens: every
    text-on-surface pair clears WCAG AA (4.5:1) in both colour modes, the
    surface ramps keep their order, and the status colours stay readable on
    the dark surface. Resolves tokens through foam.CSS.returnTokenValue so a
    dark variant that fails to resolve fails here too.
  `,

  constants: {
    AA_TEXT: 4.5
  },

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

    async function runTest(x) {
      var cls   = foam.u2.CSSTokens;
      var modes = {
        light: x.createSubContext({ theme: { activeVariants: {} } }),
        dark:  x.createSubContext({ theme: { activeVariants: { color: 'dark' } } })
      };
      // A token that does not resolve comes back as a comment string, not a
      // colour; report that as one failed assertion and keep measuring the
      // rest instead of throwing out of luminance().
      var resolve = (token, mode) => {
        var v = foam.CSS.returnTokenValue('$' + token, cls, modes[mode]);
        if ( ! /^#[0-9a-f]{6}$/i.test(v) ) {
          x.test(false, `${mode}: ${token} resolves to a hex colour, got ${v}`);
          return null;
        }
        return v;
      };

      // Text sitting on a surface: AA text floor in both modes.
      var textPairs = [
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
      ];
      for ( var mode of Object.keys(modes) ) {
        for ( var [ fg, bg ] of textPairs ) {
          var f = resolve(fg, mode), b = resolve(bg, mode);
          if ( ! f || ! b ) continue;
          var r = this.contrast(f, b);
          x.test(r >= this.AA_TEXT,
            `${mode}: ${fg} ${f} on ${bg} ${b} is ${r.toFixed(2)}:1, floor ${this.AA_TEXT}:1`);
        }
      }

      // Status colours read as text on the dark surface.
      for ( var status of [ 'destructive', 'info', 'warn', 'success' ] ) {
        var s = resolve(status, 'dark'), bg = resolve('backgroundDefault', 'dark');
        if ( ! s || ! bg ) continue;
        var r = this.contrast(s, bg);
        x.test(r >= this.AA_TEXT,
          `dark: ${status} ${s} on backgroundDefault ${bg} is ${r.toFixed(2)}:1, floor ${this.AA_TEXT}:1`);
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
