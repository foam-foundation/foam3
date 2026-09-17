/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.theme',
  name: 'ColorSchemeToggle',
  extends: 'foam.u2.View',

  documentation: `One icon button that flips the theme between light and dark.

    It writes theme.activeVariants.color, the same key foam.lang.Window sets from
    the OS prefers-color-scheme query, so every $token with a dark variant
    re-expands through foam.u2.CSS.reloadStyles. The pick is kept in
    localStorage under 'foam.colorScheme' and read back by Window on the next
    load, so it outlives the OS setting; clearing that key returns to following
    the OS.

    Renders nothing when theme.useVariants is false: without variants there is
    nothing to switch.`,

  imports: [
    'theme',
    'window'
  ],

  messages: [
    { name: 'SWITCH_TO_DARK',  message: 'Switch to dark mode' },
    { name: 'SWITCH_TO_LIGHT', message: 'Switch to light mode' }
  ],

  constants: [
    { name: 'STORAGE_KEY', value: 'foam.colorScheme' }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'isDark',
      documentation: 'Mirrors theme.activeVariants.color === "dark".',
      factory: function() { return this.readIsDark(); }
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.onDetach(this.theme.activeVariants$.sub(function() {
        self.isDark = self.readIsDark();
      }));
      this
        .addClass(this.myClass())
        .show(this.theme.useVariants)
        .startContext({ data: this })
          .start(this.TOGGLE, {
            themeIcon$: this.isDark$.map(d => d ? 'lightMode' : 'darkMode'),
            ariaLabel$: this.isDark$.map(d => d ? self.SWITCH_TO_LIGHT : self.SWITCH_TO_DARK),
            buttonStyle: 'TERTIARY',
            size: 'SMALL'
          })
          .end()
        .endContext();
    },

    function readIsDark() {
      return this.theme.activeVariants?.color === 'dark';
    },

    function store(scheme) {
      try { this.window.localStorage.setItem(this.STORAGE_KEY, scheme); } catch (_) {}
    }
  ],

  actions: [
    {
      name: 'toggle',
      label: '',
      code: function() {
        if ( this.isDark ) {
          this.theme.activeVariants$remove('color');
          this.store('light');
        } else {
          this.theme.activeVariants$set('color', 'dark');
          this.store('dark');
        }
      }
    }
  ]
});
