/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'CSSStatusTokensJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `The $status* tokens keep the palette values the enum rows used in
    light mode, every text/background pair clears WCAG AA (4.5:1) in both
    schemes, every status enum row resolves to a colour, and a pill already
    rendered re-resolves its inline colours when theme.activeVariants flips.`,

  requires: [
    'foam.core.theme.Theme',
    'foam.u2.view.EnumDescriptionROView',
    'foam.u2.view.ReadOnlyEnumView'
  ],

  methods: [
    async function runTest(x) {
      const T     = foam.u2.CSSTokens;
      const ENUMS = [
        'foam.core.app.HealthStatus',
        'foam.core.approval.ApprovalStatus',
        'foam.core.auth.AgentJunctionStatus',
        'foam.core.auth.LifecycleState',
        'foam.core.boot.CSpecStatus',
        'foam.core.crunch.CapabilityGrantMode',
        'foam.core.crunch.CapabilityJunctionStatus',
        'foam.core.job.JobStatus',
        'foam.core.license.LicenseStatus',
        'foam.core.notification.email.Status',
        'foam.core.script.ScriptStatus',
        'foam.log.LogLevel'
      ];
      // WCAG 2.x relative-luminance contrast ratio of two #RRGGBB colours
      const lum = h => {
        const c = h.replace('#', '').match(/../g)
          .map(v => parseInt(v, 16) / 255)
          .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const contrast = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (hi + 0.05) / (lo + 0.05);
      };
      const theme = this.Theme.create({}, x);
      x = x.createSubContext({ theme });
      const val   = t => foam.CSS.returnTokenValue(t, T, x).toUpperCase();
      const wait  = ms => new Promise(res => setTimeout(res, ms));
      const frame = () => new Promise(res => requestAnimationFrame(() => res()));
      const dark  = () => theme.activeVariants$set('color', 'dark');
      const light = () => theme.activeVariants$remove('color');

      // Light values are the palette values the rows already used
      light();
      x.test(val('$statusSuccessText')       === '#005112', 'statusSuccessText light is $success700');
      x.test(val('$statusSuccessBackground') === '#E8FFED', 'statusSuccessBackground light is $success50');
      x.test(val('$statusDangerText')        === '#C40610', 'statusDangerText light is $destructive500');
      x.test(val('$statusDangerBackground')  === '#FFEFF0', 'statusDangerBackground light is $destructive50');
      x.test(val('$statusNeutralBackground') === '#F0F2F5', 'statusNeutralBackground light is $grey100');

      // Dark inverts the pair on the ramp
      dark();
      x.test(val('$statusSuccessText')       === '#77D98D', 'statusSuccessText dark is $success200');
      x.test(val('$statusSuccessBackground') === '#005112', 'statusSuccessBackground dark is $success700');
      x.test(val('$statusDangerText')        === '#FA9095', 'statusDangerText dark is $destructive100');
      x.test(val('$statusDangerBackground')  === '#650005', 'statusDangerBackground dark is $destructive700');
      x.test(val('$statusNeutralBackground') === '#404040', 'statusNeutralBackground dark is $neutral700');

      // Every text/background pair clears AA in both schemes
      const pairs = [
        ['$statusSuccessText', '$statusSuccessBackground'],
        ['$statusDangerText',  '$statusDangerBackground'],
        ['$textSecondary',     '$statusNeutralBackground']
      ];
      for ( const set of [light, dark] ) {
        set();
        for ( const [fg, bg] of pairs ) {
          const r = contrast(val(fg), val(bg));
          x.test(r >= 4.5, `${fg} on ${bg} ${set === dark ? 'dark' : 'light'} is ${r.toFixed(2)}:1`);
        }
      }

      // Every colour on every status enum row resolves in both schemes
      for ( const set of [light, dark] ) {
        set();
        const bad = [];
        for ( const id of ENUMS ) {
          for ( const v of x.lookup(id).VALUES ) {
            for ( const key of ['color', 'background', 'borderColor'] ) {
              const raw = v[key];
              if ( ! raw ) continue;
              const hex = foam.CSS.returnTokenValue(raw, T, x);
              if ( ! /^#[0-9a-fA-F]{6}$/.test(hex) ) bad.push(`${id}.${v.name} ${key} ${raw} -> ${hex}`);
            }
          }
        }
        x.test(bad.length === 0, `every status enum colour resolves in ${set === dark ? 'dark' : 'light'}` + (bad.length ? ': ' + bad.join('; ') : ''));
      }

      // A rendered pill follows the scheme flip (inline styles are not
      // touched by foam.u2.CSS.reloadStyles)
      const norm = hex => { const e = document.createElement('span'); e.style.color = hex; return e.style.color; };
      light();
      const pill = this.ReadOnlyEnumView.create({ data: foam.core.script.ScriptStatus.ERROR }, x);
      pill.write();
      await frame(); await wait(50);
      x.test(pill.element_.style.color === norm('#C40610'), 'pill renders light text colour ' + pill.element_.style.color);
      x.test(pill.element_.style.backgroundColor === norm('#FFEFF0'), 'pill renders light background ' + pill.element_.style.backgroundColor);
      dark();
      await frame(); await wait(50);
      x.test(pill.element_.style.color === norm('#FA9095'), 'pill text flips to dark value on activeVariants$set, got ' + pill.element_.style.color);
      x.test(pill.element_.style.backgroundColor === norm('#650005'), 'pill background flips to dark value, got ' + pill.element_.style.backgroundColor);
      x.test(pill.element_.style.borderColor === norm('#650005'), 'pill border flips with the background, got ' + pill.element_.style.borderColor);
      light();
      await frame(); await wait(50);
      x.test(pill.element_.style.color === norm('#C40610'), 'pill text returns to light on activeVariants$remove, got ' + pill.element_.style.color);
      pill.element_.remove();
      pill.detach();

      // The description card follows too
      const card = this.EnumDescriptionROView.create({ data: foam.core.script.ScriptStatus.ERROR }, x);
      card.write();
      await frame(); await wait(50);
      const cardEl = () => card.element_.querySelector('.' + card.myClass('card'));
      x.test(cardEl().style.backgroundColor === norm('#FFEFF0'), 'card renders light background ' + cardEl().style.backgroundColor);
      dark();
      await frame(); await wait(50);
      x.test(cardEl().style.backgroundColor === norm('#650005'), 'card background flips to dark value, got ' + cardEl().style.backgroundColor);
      light();
      card.element_.remove();
      card.detach();
    }
  ]
});
