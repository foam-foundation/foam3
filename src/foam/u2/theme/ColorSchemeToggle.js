/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.theme',
  name: 'ColorSchemeToggle',
  extends: 'foam.u2.View',

  documentation: `One icon button that cycles the colour scheme:
    follow the OS -> light -> dark -> follow the OS.

    It only sets foam.lang.Window's colorScheme; Window owns the stored pick
    and turns it into theme.activeVariants.color, so every $token with a dark
    variant re-expands through foam.u2.CSS.reloadStyles. The icon shows the
    current state (sun, moon, or a half-filled ring for "following the OS")
    and the aria-label names the state and what the next press does.

    The server-rendered loading splash (foam.core.servlet.VirtualHostRoutingServlet)
    still follows the OS: its colours are static CSS keyed off
    prefers-color-scheme, and nothing in that page reads localStorage before
    the app boots, so the stored pick cannot reach it. Someone who picks light
    on a dark OS sees a dark splash until the app takes over.

    Renders nothing when theme.useVariants is false: without variants there is
    nothing to switch.`,

  imports: [
    'colorScheme',
    'theme'
  ],

  messages: [
    // Visible text (with showText) and the current-state half of the aria-label
    { name: 'SYSTEM_THEME', message: 'System theme' },
    { name: 'LIGHT_THEME',  message: 'Light theme' },
    { name: 'DARK_THEME',   message: 'Dark theme' },
    // Accessible names: the current state, then what the next press does
    { name: 'SYSTEM_THEME_LABEL', message: 'System theme. Switch to light' },
    { name: 'LIGHT_THEME_LABEL',  message: 'Light theme. Switch to dark' },
    { name: 'DARK_THEME_LABEL',   message: 'Dark theme. Follow the system' }
  ],

  constants: [
    {
      name: 'STATES',
      documentation: `Keyed by colorScheme. '' is "follow the OS" (Window clears
        the stored key for it). Each row names the glyph, the visible text, the
        accessible name, and the state the next press moves to.`,
      value: {
        '':    { next: 'light', glyph: 'systemMode', text: 'SYSTEM_THEME', label: 'SYSTEM_THEME_LABEL' },
        light: { next: 'dark',  glyph: 'lightMode',  text: 'LIGHT_THEME',  label: 'LIGHT_THEME_LABEL'  },
        dark:  { next: '',      glyph: 'darkMode',   text: 'DARK_THEME',   label: 'DARK_THEME_LABEL'   }
      }
    }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'showText',
      documentation: 'Render the state name next to the icon, for a menu row rather than a toolbar.'
    }
  ],

  methods: [
    function render() {
      var state$ = this.colorScheme$.map(s => this.STATES[s] || this.STATES['']);
      var args = {
        themeIcon$: state$.map(st => st.glyph),
        // Default (MEDIUM) size: the notification and user controls beside
        // it in the top nav are MEDIUM, so the hit box matches theirs.
        buttonStyle: 'TERTIARY'
      };
      if ( this.showText ) args.label$ = state$.map(st => this[st.text]);
      this
        .addClass(this.myClass())
        // A slot, not a one-time read: the theme is replaced after login.
        .show(this.theme$.map(t => !! t?.useVariants))
        .startContext({ data: this })
          .start(this.CYCLE, args)
            // Button reads its aria-label once in render(); bind the attribute
            // here so only this button carries a live label.
            .attrs({ 'aria-label': state$.map(st => this[st.label]) })
          .end()
        .endContext();
    }
  ],

  actions: [
    {
      name: 'cycle',
      label: '',
      code: function() {
        this.colorScheme = this.STATES[this.colorScheme].next;
      }
    }
  ]
});
