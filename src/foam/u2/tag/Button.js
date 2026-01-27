/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.tag',
  name: 'Button',
  extends: 'foam.u2.View',

  documentation: 'Basic button view. Should be extended to add functionality',

  requires: [
    'foam.net.HTTPRequest',
    'foam.u2.ButtonSize',
    'foam.u2.ButtonStyle',
    'foam.u2.HTMLView',
    'foam.u2.LoadingSpinner',
    'foam.u2.tag.CircleIndicator'
  ],

  imports: [ 'theme?' ],

  cssTokens: [
    {
      name: 'buttonRadius',
      value: '4px'
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'buttonPrimaryColor',
      value: '$backgroundBrand',
      disabledModifier: 90,
      // FIX THIS FOR LINK BUTTONS
      onLight: '$grey50'
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'buttonSecondaryColor',
      value: '$backgroundDefault',
      onLight: '$textSecondary',
      disabledModifier: -10,
      hoverModifier: -5,
      activeModifier: -15
    },
    {
      name: 'buttonSecondaryBorderColor',
      variantKey: 'color',
      value: function(e) { return e.LIGHTEN(e.TOKEN('$buttonSecondaryColor'), -40) },
      variants: {
        dark: {
          value: function(e) { return e.LIGHTEN(e.TOKEN('$buttonSecondaryColor'), 40) }
        }
      }
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'buttonPrimaryLightColor',
      value: function(e) { return e.FROM_HUE(e.TOKEN('$buttonPrimaryColor'), 41, 90) },
      variants: {
        dark: {
          value: function(e) { return e.FROM_HUE(e.TOKEN('$buttonPrimaryColor'), 41, 20) }
        }
      }
    }
  ],

  css: `
    ^ {
      font: inherit;
      align-items: center;
      border: 1px solid transparent;
      border-radius: $buttonRadius;
      box-sizing: border-box;
      display: inline-flex;
      gap: 8px;
      justify-content: center;
      margin: 0;
      outline: none;
      position: relative;
      text-align: center;
    }

    ^:focus-visible {
      outline: 1px solid $borderBrandStrong;
    }

    ^iconAfter {
      flex-direction: row-reverse;
    }

    ^:hover:not(:disabled) {
      cursor: pointer;
    }

    ^:hover^:disabled {
      cursor: not-allowed;
    }

    ^unavailable {
      display: none;
    }

    ^ img {
      vertical-align: middle;
    }

    ^ svg {
      width: 100%;
      max-height: 100%;
      vertical-align: middle;
    }

    ^.material-icons {
      cursor: pointer;
    }

    /* Unstyled */
    ^unstyled {
      background: none;
      border: none;
      color: inherit;
    }

    /* Primary */
    ^primary{
      background-color: $buttonPrimaryColor;
      box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
      color: $buttonPrimaryColor$foreground;
    }

    ^primary svg {
      fill: currentColor;
    }

    ^primary:hover:not(:disabled) {
      background-color: $buttonPrimaryColor$hover;
    }

    ^primary:active:not(:disabled) {
      background-color: $buttonPrimaryColor$active;
      border-color: $buttonPrimaryColor$hover;
    }

    ^primary:disabled {
      background-color: $buttonPrimaryColor$disabled;
      color: $buttonPrimaryColor$disabled$foreground;
    }

    /* Primary destructive */

    ^primary-destructive,^primary-destructive svg {
      background-color: $backgroundDestructive;
      color: $textOnDestructive;
    }

    ^primary-destructive:hover:not(:disabled) {
      background-color: $backgroundDestructiveSecondary;
    }

    ^primary-destructive:active:not(:disabled) {
      background-color: $backgroundDestructiveSecondary;
      border: 1px solid $backgroundDestructiveSecondary;
      box-shadow: inset 0px 2px 4px rgba(0, 0, 0, 0.06);
    }

    ^primary-destructive:disabled {
      background-color: $backgroundDestructiveTertiary;
    }


    /* Secondary */

    ^secondary{
      background-color: $buttonSecondaryColor;
      border: 1px solid $buttonSecondaryBorderColor;
      color: $buttonSecondaryColor$foreground;
    }

    ^secondary svg { fill: currentColor; }

    ^secondary:hover:not(:disabled):not(:active) {
      background-color: $buttonSecondaryColor$hover;
      color: $buttonSecondaryColor$hover$foreground;
    }

    ^secondary:active:not(:disabled) {
      color: $textBrandSecondary;
      background-color: $buttonSecondaryColor$hover;
      border: 1px solid $borderDefault;
    }

    ^secondary:disabled{
      background-color: $buttonSecondaryColor$disabled;
      border-color: $buttonSecondaryColor$disabled;
      color: $textTertiary;
    }


    /* Secondary destructive */

    ^secondary-destructive{
      background-color: $backgroundDestructive;
      border: 1px solid $backgroundDestructiveSecondary;
      color: $textDestrucitve;
    }

    ^secondary-destructive svg { fill: currentColor; }

    ^secondary-destructive:hover:not(:disabled) {
      background-color: $buttonSecondaryColor$hover;
    }

    ^secondary-destructive:active:not(:disabled) {
      background-color: $buttonSecondaryColor$hover;
      border-color: $destructive500;
    }

    ^secondary-destructive:disabled {
      background-color: $buttonSecondaryColor$hover;
      border-color: $destructive100;
      color: $destructive100;
    }

    /* Tertiary */

    ^tertiary{
      background: none;
      border: 1px solid transparent;
      color: $buttonSecondaryColor$foreground;
    }

    ^tertiary svg { fill: currentColor; }

    ^tertiary:hover:not(:disabled) {
      background-color: $buttonSecondaryColor$hover;
    }

    ^tertiary:active:not(:disabled) {
      background-color: $buttonSecondaryColor$hover;
      color: $textBrandSecondary;
    }

    ^tertiary:disabled {
      color: $textBrandTertiary;
    }

    /* Tertiary destructive */

    ^tertiary-destructive{
      background-color: transparent;
      border-color: transparent;
      color: $destructive400;
    }

    ^tertiary-destructive svg { fill: currentColor; }

    ^tertiary-destructive:hover:not(:disabled):not(:active) {
      background-color: $buttonSecondaryColor$hover;
    }

    ^tertiary-destructive:active:not(:disabled) {
      background-color: $buttonSecondaryColor$hover;
      color: $red400;
    }

    ^tertiary-destructive:disabled {
      color: $buttonSecondaryColor$disabled;
    }

    /* Link */

    ^link,^link svg {
      background: none;
      color: $buttonSecondaryColor$foreground;
      fill: currentColor;
    }

    ^link:hover:not(:disabled):not(:active),^link:hover:not(:disabled):not(:active) svg {
      text-decoration: underline;
      color: $buttonSecondaryColor$active$foreground;
    }

    ^link:active:not(:disabled),^link:active:not(:disabled) svg {
      color: $buttonPrimaryColor;
      text-decoration: underline;
    }

     /* Black */

    ^black{
      background: none;
      border: 1px solid transparent;
      color: $textDefault;
    }

    ^black svg { fill: currentColor; }

    ^black:hover:not(:disabled) {
      background-color: $buttonPrimaryLightColor;
      color: $textDefault;
    }

    ^black:active:not(:disabled) {
      background-color: $buttonPrimaryLightColor;
      border-color: $textDefault;
    }

    ^black:disabled {
      color: $buttonSecondaryColor$active;
    }

    /* Text */

    ^text{
      background: none;
      border: 1px solid transparent;
      color: $buttonPrimaryColor;
    }

    ^text svg { fill: currentColor; }

    ^text:hover:not(:disabled) {
      background-color: $buttonPrimaryLightColor;
      color: $buttonPrimaryLightColor$foreground;
    }

    ^text:active:not(:disabled) {
      background-color: $buttonPrimaryLightColor;
      border-color: $buttonPrimaryColor;
    }

    ^text:disabled {
      color: $buttonSecondaryColor$active;
    }

    /* Sizes */

    ^small {
      padding: 6px 10px;
    }

    ^medium {
      padding: 8px 12px;
    }

    ^large {
      min-width: 100px;
      padding: 12px 12px;
    }

    ^iconOnly{
      padding: 8px;
      max-height: inherit;
    }

    ^iconOnly^small {
      padding: 4px;
    }

    ^link^small,
    ^link^medium,
    ^link^large {
      padding-left: 0;
      padding-right: 0;
    }

    ^link > .foam-u2-HTMLView{
      height: 1em;
    }

    ^svgIcon {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }
    ^svgIcon svg {
      height: 100%;
    }

    /* SVGs outside themeGlyphs may have their own heights and widths,
    these ensure those are respected rather than imposing new dimensions */
    ^imgSVGIcon {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    ^imgSVGIcon svg {
      height: initial;
    }

    ^small svg,
    ^small img {
      width: 1.15em;
      height: 1.15em;
    }
    ^medium svg,
    ^medium img {
      width: 1.42em;
      height: 1.42em;
    }
    ^large svg,
    ^large img {
      width: 1.5em;
      height: 1.5em;
    }
    ^link svg, link img {
      width: 1em;
      height: 1em;
    }
    /* Loading indicator css */
    ^[data-loading] > :not(^loading),  ^[data-loading] > :not(^loading) * {
      opacity: 0;
    }
    ^loading {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    ^primary ^loading svg, ^primary:disabled > ^loading svg {
      fill: $buttonPrimaryColor$foreground;
    }
    ^secondary ^loading svg, ^tertiary ^loading svg,  ^link ^loading svg,
    ^secondary:disabled ^loading svg, ^tertiary:disabled ^loading svg,  ^link:disabled ^loading svg {
      fill: $buttonSecondaryColor$foreground;
    }
    ^text > ^loading svg, ^text:disabled > ^loading svg {
      fill: $buttonPrimaryColor;
    }
  `,

  properties: [
    'name',
    {
      class: 'GlyphProperty',
      name: 'themeIcon'
    },
    {
      class: 'URL',
      name: 'icon'
    },
    {
      class: 'Boolean',
      name: 'isIconAfter'
    },
    {
      class: 'String',
      name: 'iconFontFamily'
    },
    {
      class: 'String',
      name: 'iconFontClass'
    },
    {
      class: 'String',
      name: 'iconFontName'
    },
    [ 'nodeName', 'button' ],
    {
      name: 'label'
    },
    {
      class: 'String',
      name: 'ariaLabel'
    },
    {
      class: 'Enum',
      of: 'foam.u2.ButtonStyle',
      name: 'buttonStyle',
      value: 'SECONDARY'
    },
    {
      class: 'Boolean',
      name: 'isDestructive',
      documentation: `
        When set to true, this action should be styled in a way that indicates
        that data is deleted in some way.
      `,
      factory: function() {
        return false;
      }
    },
    {
      class: 'Enum',
      of: 'foam.u2.ButtonSize',
      name: 'size',
      value: 'MEDIUM'
    },
    {
      class: 'String',
      name: 'styleClass_',
      expression: function(isDestructive, buttonStyle) {
        var s = buttonStyle.name.toLowerCase();
        return isDestructive ? s + '-destructive' : s;
      }
    },
    [ 'loading_', false]
  ],

  methods: [
    function render() {
      this.SUPER();

      this.initCls();

      this.on('click', this.click);

      this.addContent();

      this.attrs({ name: this.name || '', 'aria-label': this.ariaLabel });

      this.addClass(this.slot(function(styleClass_) {
        return this.myClass(styleClass_);
      }));

      this.addClass(this.slot(function(size) { return this.myClass(size.label.toLowerCase()) }));
      this.enableClass(this.myClass('iconOnly'), ! (this.contents || this.label));
      this.enableClass(this.myClass('iconAfter'), this.isIconAfter$);
      this.enableClass('destructive', this.isDestructive$);
    },

    function initCls() {
      this.addClass();
    },

    async function addContent() {
      /** Add text or icon to button. **/
      var self = this;
      this.add(this.dynamic(function(themeIcon, icon) {
        if ( ( themeIcon && self.theme ) ) {
          this
            .start({ class: 'foam.u2.tag.Image', glyph: themeIcon, role: 'presentation' })
              .addClass(self.myClass('SVGIcon'))
            .end();
        } else if ( icon ) {
          this
            .start({ class: 'foam.u2.tag.Image', data: icon, role: 'presentation', embedSVG: true })
              .addClass(self.myClass('SVGIcon'), self.myClass('imgSVGIcon'))
            .end();
        // TODO: Maybe deprecate, not really used
        } else if ( self.iconFontName ) {
          this.nodeName = 'i';
          this.addClass(self.action.name);
          this.addClass(self.iconFontClass); // required by font package
          this.attr(role, 'presentation')
          this.style({ 'font-family': self.iconFontFamily });
          this.add(self.iconFontName);
        }
      }))
      this.add(this.slot(function(label) {
        let e = this.E().show(!! label).style({ display: 'contents' });
        if ( foam.String.isInstance(this.label)  ) {
          if ( this.buttonStyle == 'LINK' || this.buttonStyle == 'UNSTYLED' ) {
            e.start().addClass('p').add(this.label$).end();
          } else {
            e.start().addClass('h600').add(this.label$).end();
          }
        } else if ( foam.Object.isInstance(this.label) && ! this.label.then ) {
          e.tag(this.label);
        } else {
          e.add(this.label$);
        }
        return e;
      }))

      this.attrs({ 'data-loading': this.loading_$ })
      this.add(this.slot(function(loading_) {
        return loading_ ? this.E().tag(self.LoadingSpinner, {size: '100%'}).addClass(self.myClass('loading')) : this.E().hide();
      }));
    }
  ],

  listeners: [
    function click(e) {
      // Implemented by subclasses
      e.preventDefault();
      e.stopPropagation();
    }
  ]

});
