/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'ColorSchemeToggleTest',
  extends: 'foam.core.test.JSTest',

  documentation: `foam.lang.Window owns the stored colour scheme (key, write,
    re-apply) and foam.u2.theme.ColorSchemeToggle cycles it
    system -> light -> dark -> system.`,

  requires: [
    'foam.core.menu.Menu',
    'foam.core.u2.navigation.ApplicationSideNav',
    'foam.dao.MDAO',
    'foam.lang.Window',
    'foam.u2.theme.ColorSchemeToggle',
    'foam.u2.theme.StandaloneTheme'
  ],

  methods: [
    // A foam.lang.Window over a fake browser window: real document (the
    // toggle renders DOM), fake localStorage and matchMedia so the test
    // controls the stored pick and the OS preference.
    function makeWindow(x, store, osDark) {
      var real = x.window;
      var fake = {
        document:  real.document,
        console:   real.console,
        location:  real.location,
        localStorage: {
          getItem:    k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
          setItem:    (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; }
        },
        matchMedia: () => ({ matches: osDark.value, addEventListener() {}, removeEventListener() {} }),
        setTimeout:            real.setTimeout.bind(real),
        clearTimeout:          real.clearTimeout.bind(real),
        setInterval:           real.setInterval.bind(real),
        clearInterval:         real.clearInterval.bind(real),
        requestAnimationFrame: real.requestAnimationFrame.bind(real),
        cancelAnimationFrame:  real.cancelAnimationFrame.bind(real)
      };
      var theme = this.StandaloneTheme.create({ id: 'test', name: 'test', useVariants: true }, x);
      var win   = this.Window.create({ window: fake, theme: theme }, x);
      win.populateDefaultThemeVariants(theme, win.__subContext__);
      return win;
    },

    async function runTest(x) {
      var KEY  = 'foam.colorScheme';
      var wait = ms => new Promise(res => setTimeout(res, ms));

      // --- Window owns the key: read on boot -------------------------------
      var osDark = { value: true };
      var store  = {};
      var win    = this.makeWindow(x, store, osDark);
      x.test(win.COLOR_SCHEME_KEY === KEY, 'Window names the storage key');
      x.test(win.colorScheme === '', 'no stored pick reads as "" (follow the OS), got "' + win.colorScheme + '"');
      x.test(win.theme.activeVariants.color === 'dark', 'no pick + dark OS applies the dark variant');

      store = { [KEY]: 'light' };
      win   = this.makeWindow(x, store, osDark);
      x.test(win.colorScheme === 'light', 'stored light reads back as light');
      x.test(win.theme.activeVariants.color === undefined, 'stored light beats a dark OS');

      store = { [KEY]: 'sepia' };
      win   = this.makeWindow(x, store, osDark);
      x.test(win.colorScheme === '', 'an unknown stored value reads as "" (follow the OS), got "' + win.colorScheme + '"');
      x.test(win.theme.activeVariants.color === 'dark', 'an unknown stored value follows the OS');

      // --- Window owns the write and the re-apply --------------------------
      store  = {};
      osDark = { value: false };
      win    = this.makeWindow(x, store, osDark);
      x.test(win.theme.activeVariants.color === undefined, 'light OS, no pick: no colour variant');
      win.colorScheme = 'dark';
      x.test(store[KEY] === 'dark', 'setting colorScheme writes the key, got ' + store[KEY]);
      x.test(win.theme.activeVariants.color === 'dark', 'setting colorScheme re-applies the variant');
      win.colorScheme = '';
      x.test(! (KEY in store), 'clearing colorScheme removes the key, store has ' + JSON.stringify(store));
      x.test(win.theme.activeVariants.color === undefined, 'clearing colorScheme falls back to the OS');

      // --- Toggle cycles system -> light -> dark -> system -----------------
      store  = {};
      osDark = { value: true };
      win    = this.makeWindow(x, store, osDark);
      var t  = this.ColorSchemeToggle.create({}, win.__subContext__);
      t.write();
      await wait(50);
      var btn   = t.element_.querySelector('button');
      var label = () => btn.getAttribute('aria-label');
      var icon  = () => t.element_.querySelector('svg path')?.getAttribute('d') || '';
      x.test(!! btn, 'toggle renders a button');
      x.test(label() === t.SYSTEM_THEME_LABEL, 'initial label says the theme follows the system, got "' + label() + '"');
      var systemIcon = icon();

      btn.click();
      await wait(50);
      x.test(store[KEY] === 'light', 'click 1 stores light, got ' + store[KEY]);
      x.test(label() === t.LIGHT_THEME_LABEL, 'click 1 label says light, got "' + label() + '"');
      x.test(win.theme.activeVariants.color === undefined, 'click 1 applies light over a dark OS');
      var lightIcon = icon();

      btn.click();
      await wait(50);
      x.test(store[KEY] === 'dark', 'click 2 stores dark, got ' + store[KEY]);
      x.test(label() === t.DARK_THEME_LABEL, 'click 2 label says dark, got "' + label() + '"');
      x.test(win.theme.activeVariants.color === 'dark', 'click 2 applies dark');
      var darkIcon = icon();

      btn.click();
      await wait(50);
      x.test(! (KEY in store), 'click 3 removes the key, store has ' + JSON.stringify(store));
      x.test(label() === t.SYSTEM_THEME_LABEL, 'click 3 label says system again, got "' + label() + '"');
      x.test(win.theme.activeVariants.color === 'dark', 'click 3 follows the dark OS again');
      x.test(systemIcon !== lightIcon && lightIcon !== darkIcon && systemIcon !== darkIcon,
        'the three states render three different icons, got ' + JSON.stringify([ systemIcon, lightIcon, darkIcon ].map(d => d.slice(0, 12))));

      // Visible text when asked for
      var t2 = this.ColorSchemeToggle.create({ showText: true }, win.__subContext__);
      t2.write();
      await wait(50);
      x.test(t2.element_.textContent.trim() === t2.SYSTEM_THEME, 'showText renders the state name, got "' + t2.element_.textContent.trim() + '"');

      t.element_.remove();  t.detach();
      t2.element_.remove(); t2.detach();

      // --- Side nav carries the toggle for small screens -------------------
      // Minimal context: an empty menu tree is enough for the nav to render.
      var navCtx = win.__subContext__.createSubContext({
        menuDAO: this.MDAO.create({ of: this.Menu }),
        currentMenu: null,
        pushDefaultMenu: function() {},
        pushMenu: function() {},
        loginSuccess: true
      });
      // UserInfoView (the settings row) reads the page-global ctrl; stub it
      // when the runner has no app controller.
      var hadCtrl = 'ctrl' in globalThis;
      if ( ! hadCtrl ) globalThis.ctrl = { __subContext__: { auth: { getCurrentSubject: async () => null } } };
      try {
        var nav = this.ApplicationSideNav.create({}, navCtx);
        nav.write();
        await wait(100);
        var hidden = () => nav.element_.querySelector('.foam-u2-theme-ColorSchemeToggle')?.classList.contains('foam-u2-Element-hidden');
        x.test(hidden() === false, 'side nav shows the toggle in its bottom container, hidden=' + hidden());
        nav.bottomRoot_ = this.Menu.create({ id: 'settings' }, navCtx);
        await wait(50);
        x.test(hidden() === true, 'drilling into a bottom row hides the toggle, hidden=' + hidden());
        nav.bottomRoot_ = null;
        await wait(50);
        x.test(hidden() === false, 'leaving the submenu shows the toggle again, hidden=' + hidden());
        nav.element_.remove();
        nav.detach();
      } finally {
        if ( ! hadCtrl ) delete globalThis.ctrl;
      }
    }
  ]
});
