/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSTokensContrastPairsTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    An application adds a pair to CSSTokensContrastTest by adding a row to
    pairs:, and the test measures the application's own colours (its
    CSSTokenOverride rows). This test runs CSSTokensContrastTest with an added
    row and an override DAO, and reads what it reported.
  `,

  requires: [
    'foam.core.theme.customisation.CSSTokenOverride',
    'foam.u2.test.CSSTokensContrastTest',
    'foam.u2.test.ContrastPair'
  ],

  methods: [
    async function report_(x, pairs, rows) {
      // Runs the contrast test over these pairs and override rows; answers
      // the lines it reported, each { ok, msg }.
      var dao = foam.dao.EasyDAO.create({ of: this.CSSTokenOverride, daoType: 'MDAO' }, x);
      for ( var row of rows || [] ) await dao.put(this.CSSTokenOverride.create(row, x));
      var lines = [];
      var y = x.createSubContext({
        cssTokenOverrideDAO: dao,
        test: (ok, msg) => lines.push({ ok: !! ok, msg: msg })
      });
      await this.CSSTokensContrastTest.create({ pairs: pairs }, y).runTest(y);
      return lines;
    },

    function line_(lines, start) {
      return lines.find(l => l.msg.startsWith(start));
    },

    async function runTest(x) {
      var test = this.CSSTokensContrastTest.create({}, x);
      x.test(test.pairs.length === 16, 'the default pairs: 12 text pairs in both modes and 4 status colours on dark');

      var pairs = test.defaultPairs().concat([
        this.ContrastPair.create({ text: 'textDefault', background: 'backgroundDefault', modes: [ 'light' ], floor: 22 })
      ]);
      var lines = await this.report_(x, pairs);
      var added = lines.filter(l => / floor 22:1$/.test(l.msg));
      x.test(added.length === 1 && ! added[0].ok, 'an added row is measured, and a floor no pair can reach fails: ' + added.map(l => l.msg));
      x.test(this.line_(lines, 'light: textDefault') && this.line_(lines, 'light: textDefault').ok,
        'the default rows still run beside an added one');

      var modeless = await this.report_(x, [
        this.ContrastPair.create({ text: 'textDefault', background: 'backgroundDefault', modes: [ 'sepia' ] })
      ]);
      x.test(modeless.some(l => ! l.ok && /unknown mode sepia/.test(l.msg)), 'a row naming an unknown mode fails, not skipped');

      var mine = [ this.ContrastPair.create({ text: 'textDefault', background: 'backgroundDefault', modes: [ 'light' ] }) ];
      lines = await this.report_(x, mine, [ { theme: '', source: 'textDefault', target: '#EEEEEE' } ]);
      var own = this.line_(lines, 'light: textDefault');
      x.test(own && ! own.ok && / #EEEEEE /i.test(own.msg),
        "the application's override row is the colour measured: pale text on the page fails: " + (own && own.msg));

      lines = await this.report_(x, mine, [ { theme: '', source: 'textDefault', target: 'rgba(0, 0, 0, 0.5)' } ]);
      own = this.line_(lines, 'light: textDefault');
      x.test(own && /textDefault #[0-9a-f]{6} /i.test(own.msg) && ! /rgba/.test(own.msg),
        'a see-through colour is laid over the page before it is measured: ' + (own && own.msg));

      // See-through text sits on the pair's background, not on the page:
      // 60% white on #0A4AC6 is #9DB7E8 on screen, 3.69:1 (over the white page it would read 7.48:1).
      var onBrand = [ this.ContrastPair.create({ text: 'textOnBrand', background: 'backgroundBrand', modes: [ 'light' ] }) ];
      lines = await this.report_(x, onBrand, [
        { theme: '', source: 'textOnBrand',     target: 'rgba(255, 255, 255, 0.6)' },
        { theme: '', source: 'backgroundBrand', target: '#0A4AC6' }
      ]);
      own = this.line_(lines, 'light: textOnBrand');
      x.test(own && ! own.ok && / #9db7e8 /i.test(own.msg),
        "see-through text is laid over the pair's background, so faint text on brand fails: " + (own && own.msg));

      // rgb(), hsl() and hsla() are measured too, not only rgba(): hsl(220 90% 56%) is #2A6DF4 on screen.
      lines = await this.report_(x, mine, [ { theme: '', source: 'textDefault', target: 'hsl(220 90% 56%)' } ]);
      own = this.line_(lines, 'light: textDefault');
      x.test(own && / #2a6df4 /i.test(own.msg), 'an hsl() colour is measured with its hue in degrees: ' + (own && own.msg));

      lines = await this.report_(x, mine, [ { theme: '', source: 'textDefault', target: 'rgb(0, 0, 0)' } ]);
      own = this.line_(lines, 'light: textDefault');
      x.test(own && own.ok && / #000000 /i.test(own.msg), 'an rgb() colour is measured: ' + (own && own.msg));

      // A see-through hsla() is laid over what sits under it, as rgba() is: 9% of hsl(219 90% 40%) on white is #E9EFFA.
      lines = await this.report_(x, mine, [
        { theme: '', source: 'textDefault',       target: 'hsla(219 90% 40% / 0.09)' },
        { theme: '', source: 'backgroundDefault', target: '#FFFFFF' }
      ]);
      own = this.line_(lines, 'light: textDefault');
      x.test(own && / #e9effa /i.test(own.msg), 'a see-through hsla() colour is laid over its background: ' + (own && own.msg));
    }
  ]
});
