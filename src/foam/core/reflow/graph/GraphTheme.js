/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphTheme',

  documentation: `
    Resolves the canvas graph's colour and font palette from the app's CSS
    tokens (foam.u2.CSSTokens), so the graph follows the active theme,
    including light/dark variants. Re-resolves whenever the active theme's
    variants change (e.g. a dark-mode toggle).

    Semi-transparent fills used by the graph (the selection marquee, the
    dimmed state of unrelated nodes) are the caller's responsibility via
    ctx.globalAlpha or a CView's alpha property; this class only resolves
    solid token values.
  `,

  imports: [ 'theme?' ],

  properties: [
    {
      name: 'colors',
      documentation: 'Plain object of resolved colour strings, see resolve_().',
      factory: function() { return this.resolve_(); }
    },
    {
      name: 'fonts',
      documentation: 'Plain object of CSS font strings: title, body, badge, count.',
      factory: function() { return this.fontsFor_(); }
    }
  ],

  methods: [
    function init() {
      if ( this.theme && this.theme.activeVariants$ ) {
        this.onDetach(this.theme.activeVariants$.sub(this.refresh));
      }
    },

    function token_(name) {
      /* Resolves a $token to its CSS value, falling back to the raw
         token name if resolution fails. */
      var v = foam.CSS.returnTokenValue(name, null, this.__context__);
      if ( ! v || ( foam.String.isInstance(v) && v.indexOf('/* failed') === 0 ) ) {
        return name;
      }
      return v;
    },

    function fontsFor_() {
      var family = this.token_('$font1');
      return {
        title: 'bold 14px ' + family,
        body:  '12px ' + family,
        badge: 'bold 10px ' + family,
        count: 'bold 18px ' + family
      };
    },

    function resolve_() {
      return {
        canvas:   this.token_('$backgroundSecondary'),
        gridDot:  this.token_('$grey300'),

        nodeBg:     this.token_('$backgroundDefault'),
        nodeBorder: this.token_('$borderDefault'),
        silentBg:   this.token_('$backgroundSecondary'),

        text:      this.token_('$textDefault'),
        textMuted: this.token_('$textSecondary'),

        edge:         this.token_('$grey500'),
        edgeActive:   this.token_('$primary500'),
        edgeSelected: this.token_('$primary400'),

        selected:  this.token_('$primary400'),
        dependent: this.token_('$orange400'),
        error:     this.token_('$destructive400'),

        kinds: {
          dao:       this.token_('$primary400'),
          transform: this.token_('$purple400'),
          script:    this.token_('$orange400'),
          input:     this.token_('$success400'),
          doc:       this.token_('$grey500'),
          block:     this.token_('$grey500'),
          layout:    this.token_('$grey500')
        },

        containerFill:   this.token_('$backgroundTertiary'),
        containerStroke: this.token_('$borderDefault'),

        port:       this.token_('$borderDefault'),
        portActive: this.token_('$grey500'),
        renders:    this.token_('$success400'),

        marqueeFill:   this.token_('$primary400'),
        marqueeStroke: this.token_('$primary400'),

        tooltipBg:   this.token_('$grey700'),
        tooltipText: this.token_('$grey50'),

        chipBg:     this.token_('$backgroundDefault'),
        chipBorder: this.token_('$borderDefault')
      };
    }
  ],

  listeners: [
    {
      name: 'refresh',
      code: function() {
        this.colors = this.resolve_();
        this.fonts  = this.fontsFor_();
      }
    }
  ]
});
