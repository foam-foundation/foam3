<flow name="be:CSSTokens" category="DOC/EXAMPLES" spid="foam" description="Live examples of CSSTokens, FOAM's class-scoped CSS variable system: semantic tokens, theming, dark mode and token best practices." keywords="csstokens,css,tokens,semantic tokens,theming,dark mode,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM CSS Tokens By Example

<term term="CSSTokens"></term> are FOAM's CSS variable system, similar to SASS or LESS variables but automatically scoped to the class they're used in. Tokens enable consistent theming, dark mode support, and maintainable styles across your application.

<toc></toc>

## Overview

**Best practices for styling FOAM Views:**
- Use tokens wherever possible, specifically <term term="semantic tokens"></term>
- Use <term term="ColorToken"></term> to simplify setting various visible states of UI elements
- Default to base tokens for consistency; add custom tokens only for exceptional cases

### Token Types

| Type | Description | Example |
|------|-------------|---------|
| **Atomic** | Raw color values | `$red500`, `$blue400`, `$primary400` |
| **Semantic** | Purpose-based aliases | `$backgroundBrand`, `$textDefault` |
| **ColorToken** | Auto-generates state variants | `$myColor$hover`, `$myColor$foreground` |
| **Function** | Computed values | `e.LIGHTEN(e.TOKEN('$color'), -20)` |

## Using Tokens in an Element

Any CSS value that begins with `$` is considered a token and is replaced when the CSS is added to the DOM.

<example id="basic-tokens">
foam.CLASS({
  name: 'Example',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      name: 'color',
      value: 'red'
    },
    {
      name: 'fontSize',
      value: '2rem'
    }
  ],
  css: `
    ^ {
      color: $color;
      font-size: $fontSize;
    }
  `,
  methods: [
    function render() {
      this.addClass().add('Hello World!');
    }
  ]
});

tag({class: 'Example'});
</example>

---

## How Tokens Work

CSSTokens are processed when an element's CSS is added to the DOM. The process:

1. `foam.u2.CSS.expandCSS()` calls `foam.CSS.returnTokens` on the CSS property
2. `returnTokens` finds all tokens and replaces them with appropriate values
3. For every token, `returnTokenValue` is called

This code is in `stdlib.js` → `foam.CSS` LIB. You can use `returnTokenValue` directly, which is especially useful for slotting tokens.

> **Note:** Setting the token value in your code does nothing and will not change the value in the CSS.

<example id="programmatic-tokens">
foam.CLASS({
  name: 'ProgramaticTokenValues',
  extends: 'foam.u2.Element',
  cssTokens: [
    { name: 'color1', value: 'red' },
    { name: 'color2', value: 'blue' }
  ],
  properties: [
    { class: 'Boolean', name: 'isRed' }
  ],
  methods: [
    function render() {
      let colorSlot = this.isRed$.map(v =>
        foam.CSS.returnTokenValue(
          v ? '$color1' : '$color2',
          this.cls_,
          this.__subContext__
        )
      );
      this
        .startContext({ data: this }).tag(this.IS_RED.__).endContext()
        .start()
          .style({ color: colorSlot })
          .add('My color is:', colorSlot)
        .end();
    }
  ]
});

tag({class: 'ProgramaticTokenValues'});
</example>

---

## Inheriting Tokens

Tokens can be inherited by subclasses and overridden. Changes in subclasses do not affect the parent class.

<example id="inheriting-tokens">
foam.CLASS({
  name: 'Example2',
  extends: 'Example',
  cssTokens: [
    {
      name: 'color',
      value: 'blue'
    }
  ]
});

tag({class: 'Example'});
tag({class: 'Example2'});
</example>

---

## Referencing Tokens

Tokens can point to other tokens to get their values using the `$ClassName.tokenName` syntax.

<example id="referencing-tokens">
foam.CLASS({
  name: 'Example3',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      name: 'myColor',
      value: '$Example.color'
    }
  ],
  css: `
    ^ {
      background-color: $myColor;
    }
  `,
  methods: [
    function render() {
      this.addClass().add('This text has a background from another class');
    }
  ]
});

tag({class: 'Example3'});
</example>

---

## Providing Fallbacks

Tokens that reference other tokens can provide fallback values if the referenced token is not found.

<example id="fallback-tokens">
foam.CLASS({
  name: 'Example4',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      name: 'myColor',
      value: '$invalidToken',
      fallback: 'pink'
    }
  ],
  css: `
    ^ {
      background-color: $myColor;
    }
  `,
  methods: [
    function render() {
      this
        .addClass()
        .add('This text has a background from another class')
        .br()
        .add('Value for invalidToken: ',
          String(foam.CSS.returnTokenValue('$invalidToken', this.cls_, this.__subContext__)));
    }
  ]
});

tag({class: 'Example4'});
</example>

---

## Base Tokens

FOAM provides base CSS tokens for theming in `CSSTokens.js`. Most FOAM views reference these tokens, so refining this class will re-theme the entire app.

Unlike referencing cssTokens from other classes, base tokens can be referenced without the full path — use `$green500` instead of `$foam.u2.CSSTokens.green500`.

<example id="base-tokens">
foam.CLASS({
  name: 'Example5',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      name: 'color',
      value: '$green500'
    }
  ],
  css: `
    ^ {
      color: $color;
    }
    .foam-u2-dialog-StyledModal-wrapper {
      width: 100%;
    }
  `,
  methods: [
    function render() {
      this.addClass().add('Hello World!').br().tag(this.SHOW_ALL);
    }
  ],
  actions: [
    {
      name: 'showAll',
      label: 'Show All Base Tokens',
      buttonStyle: 'LINK',
      size: 'SMALL',
      code: function(X) {
        let a = foam.dao.ArrayDAO.create({
          array: foam.u2.CSSTokens.getAxiomsByClass(foam.u2.CSSToken),
          of: 'foam.u2.CSSToken'
        }, this);
        let b = foam.u2.table.TableView.create({
          data: a,
          of: 'foam.u2.CSSToken',
          selectedColumnNames: ['name', 'value', 'description']
        }, this);
        let popup = foam.u2.dialog.StyledModal.create({
          title: 'Base Tokens',
          maxWidth: '75vw'
        }, this);
        popup.tag(b);
        popup.open();
      }
    }
  ]
});

tag({class: 'Example5'});
</example>

---

## Overriding Tokens with CSSTokenOverrideService

While refining `CSSTokens` is the simplest way to theme a FOAM app, it's not ideal for apps with multiple service providers and themes.

The preferred method for complex apps is using <term term="CSSTokenOverride"></term> and <term term="CSSTokenOverrideService"></term>. This allows changing token values per theme.

> **Note:** While it's possible to override with `theme = ''`, it's not recommended as it creates a global override across themes.

<example id="token-override">
foam.CLASS({
  name: 'TokenOverrideExample',
  extends: 'foam.u2.Element',

  imports: ['ctrl?'],

  exports: [
    'tokenDAO as cssTokenOverrideDAO',
    'tokenService as cssTokenOverrideService'
  ],

  css: `
    ^test1 {
      color: $test1;
    }
  `,

  cssTokens: [
    { name: 'test1', value: 'red' }
  ],

  properties: [
    'color',
    { class: 'Boolean', name: 'disabled' },
    { class: 'Boolean', name: 'loading' },
    { class: 'Enum', of: 'foam.u2.ButtonStyle', name: 'style' },
    {
      name: 'tokenDAO',
      factory: function() {
        return foam.dao.EasyDAO.create({
          of: foam.core.theme.customisation.CSSTokenOverride,
          daoType: 'MDAO'
        }, this);
      }
    },
    {
      name: 'tokenService',
      factory: function() {
        return foam.core.theme.customisation.CSSTokenOverrideService.create({}, this);
      }
    }
  ],

  methods: [
    function init() {
      this.tokenService.sub('cacheUpdated', () => {
        if ( this.ctrl ) return;
        foam.u2.CSS.reloadStyles(this.__subContext__);
      });
    },
    function render() {
      this
        .start()
          .addClass(this.myClass('test1'))
          .add('Token test1 as background')
        .end()
        .br().br()
        .startContext({ data: this })
          .tag(this.COLOR.__, { config: { label: 'Color for test1 token' } })
          .tag(this.SAVE)
        .endContext();
    }
  ],

  actions: [
    {
      name: 'save',
      code: function(X) {
        X.cssTokenOverrideService.currentCache = '';
        X.cssTokenOverrideDAO.put(
          foam.core.theme.customisation.CSSTokenOverride.create({
            theme: X.theme.id,
            source: 'test1',
            target: this.color
          }, this)
        );
      }
    }
  ]
});

tag({class: 'TokenOverrideExample'});
</example>

---

## Advanced Tokens

### Function Tokens

Token values can be functions that return a valid CSS value or another token. Functions receive <term term="TokenUtilBuilder"></term> as the argument.

The various expressions available are in `TokenUtils.js` — useful for lightening, darkening, and changing hues of colors.

<example id="function-tokens">
foam.CLASS({
  name: 'Example6',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      name: 'color1',
      value: 'red'
    },
    {
      name: 'color2',
      value: function(e) { return e.LIGHTEN(e.TOKEN('$color1'), -40); }
    }
  ],
  css: `
    ^a {
      background-color: $color1;
    }
    ^b {
      background-color: $color2;
    }
  `,
  methods: [
    function render() {
      this
        .start()
          .addClass(this.myClass('a'))
          .add('This text has background color1')
        .end()
        .start()
          .addClass(this.myClass('b'))
          .add('This text has background color2 (darkened)')
        .end();
    }
  ]
});

tag({class: 'Example6'});
</example>

---

## Color Tokens

<term term="ColorToken"></term> is a subclass of CSSToken that automatically generates accompanying tokens for UI states.

| Generated Token | Purpose |
|-----------------|---------|
| `$token` | Base color |
| `$token$hover` | Slightly darker/lighter based on luminosity |
| `$token$active` | Significantly darker/lighter for active states |
| `$token$disabled` | Greyed out version |
| `$token$foreground` | Appropriate text color (black or white) |
| `$token$hover$foreground` | Foreground for hover state |

<example id="color-tokens">
foam.CLASS({
  name: 'Example7',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'color1',
      value: 'white'
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'color2',
      value: 'pink'
    }
  ],
  css: `
    ^a {
      background-color: $color1;
      color: $color1$foreground;
    }
    ^b {
      background-color: $color2;
      color: $color2$foreground;
    }
    ^b:hover {
      background-color: $color2$hover;
      color: $color2$hover$foreground;
    }
  `,
  methods: [
    function render() {
      this
        .start()
          .addClass(this.myClass('a'))
          .add('This text has background color1')
        .end()
        .start()
          .addClass(this.myClass('b'))
          .add('This text has background color2, hovering changes color')
        .end();
    }
  ]
});

tag({class: 'Example7'});
</example>

---

## Color Token Customization

ColorTokens support customization when defaults aren't suitable.

| Property | Purpose |
|----------|---------|
| `onLight` | Foreground color for light backgrounds |
| `onDark` | Foreground color for dark backgrounds |
| `hoverModifier` | Hover darkness adjustment (negative = darker) |
| `activeModifier` | Active state adjustment |
| `disabledModifier` | Disabled state adjustment |

<example id="color-token-customization">
foam.CLASS({
  name: 'Example8',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'color1',
      value: '$white',
      onLight: '$blue500',
      onDark: '$yellow200'
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'color2',
      value: 'pink',
      hoverModifier: -40  // Make hover darker (default is -20)
    }
  ],
  css: `
    ^a {
      background-color: $color1;
      color: $color1$foreground;
    }
    ^b {
      background-color: $color2;
      color: $color2$foreground;
    }
    ^b:hover {
      background-color: $color2$hover;
      color: $color2$hover$foreground;
    }
  `,
  methods: [
    function render() {
      this
        .start()
          .addClass(this.myClass('a'))
          .add('This text has background color1')
        .end()
        .start()
          .addClass(this.myClass('b'))
          .add('This text has background color2, hovering changes color')
        .end();
    }
  ]
});

tag({class: 'Example8'});
</example>

---

## Variants

<term term="Variants"></term> allow cssTokens to change values based on the app's "mode" (dark mode, high contrast, etc.). The current modes are stored in the theme's `activeVariants` map.

**To use variants, enable `useVariants` in your app's theme.** This is `true` by default for non-CORE apps and `false` for CORE apps.

To configure a token for variants:

| Property | Purpose |
|----------|---------|
| `variantKey` | Key in `activeVariants` this token listens to |
| `variants` | Map of token values for different variant values |

<example id="variants">
foam.CLASS({
  name: 'Example9',
  extends: 'foam.u2.Element',
  cssTokens: [
    {
      name: 'color',
      value: 'red',
      variantKey: 'color',  // Responds to activeVariants.color
      variants: {
        dark: {
          value: 'green'
        }
      }
    }
  ],
  css: `
    ^test {
      color: $color;
    }
  `,
  methods: [
    function render() {
      this
        .add("Current value of theme.activeVariants['color']: ",
          this.__subContext__.theme.activeVariants$.map(v => v['color'] ?? 'undefined'))
        .br().br()
        .start().addClass(this.myClass('test')).add('Hello World!').end();
    }
  ]
});

tag({class: 'Example9'});
</example>

---

## Base Tokens with Variants

Base tokens are split into two types:

| Type | Description | Examples |
|------|-------------|----------|
| **Atomic** | Building blocks | `red50-700`, `blue50-700`, `primary400` |
| **Semantic** | Consumed by views, reference atomic tokens | `backgroundBrand`, `textDefault`, `borderPrimary` |

This separation allows enabling dark mode by only setting variants on semantic tokens. App theming becomes as simple as overriding the "primary" atomic tokens and tweaking semantic token values.

<example id="base-tokens-variants">
foam.CLASS({
  name: 'BaseTokenOverrideExample',
  extends: 'foam.u2.Element',

  imports: ['ctrl?'],
  requires: ['foam.u2.ActionView'],

  exports: [
    'tokenDAO as cssTokenOverrideDAO',
    'tokenService as cssTokenOverrideService'
  ],

  properties: [
    'color',
    {
      name: 'tokenDAO',
      factory: function() {
        return foam.dao.EasyDAO.create({
          of: foam.core.theme.customisation.CSSTokenOverride,
          daoType: 'MDAO'
        }, this);
      }
    },
    {
      name: 'tokenService',
      factory: function() {
        return foam.core.theme.customisation.CSSTokenOverrideService.create({}, this);
      }
    }
  ],

  methods: [
    function init() {
      this.tokenService.sub('cacheUpdated', () => {
        if ( this.ctrl ) return;
        foam.u2.CSS.reloadStyles(this.__subContext__);
      });
    },
    function render() {
      this
        .startContext({ data: this })
          .tag(this.COLOR.__, { config: { label: 'Color for primary400 token' } })
          .tag(this.SAVE)
          .br().br()
          .start().add("This button has background set to backgroundBrand which aliases to primary400").end()
          .tag(this.TEST_BUTTON)
        .endContext();
    }
  ],

  actions: [
    {
      name: 'TestButton',
      buttonStyle: 'PRIMARY'
    },
    {
      name: 'save',
      code: function(X) {
        X.cssTokenOverrideService.currentCache = '';
        X.cssTokenOverrideDAO.put(
          foam.core.theme.customisation.CSSTokenOverride.create({
            theme: X.theme.id,
            source: 'primary400',
            target: this.color
          }, this)
        );
      }
    }
  ]
});

tag({class: 'BaseTokenOverrideExample'});
</example>

---

## When to Use Tokens

CSSTokens keep your styles DRY and maintainable.

**Use semantic tokens whenever possible** (`backgroundBrand`, `textDefault`, etc.). Semantic and base tokens are the foundation of your design system — they represent core concepts that should remain consistent. Using these tokens ensures global changes (dark mode, brand updates) propagate automatically.

**Only add new tokens when a view needs separate theming.** In rare cases, a view may need a unique look that can't be achieved with existing tokens. Reserve custom tokens for exceptional cases like one-off marketing components. When using custom tokens, try to set their default value to a semantic token and use TokenUtils to modify it.

### Token Selection Guidelines

| Situation | Approach |
|-----------|----------|
| Standard UI element | Use semantic tokens |
| Need slight color variation | Use TokenUtils (LIGHTEN, etc.) with semantic token |
| Completely unique component | Create custom token with semantic token as default |
| One-off marketing component | Custom token acceptable |

---

## Porting Old Code to Semantic Tokens

If your app uses older CSSTokens or hardcoded colors, migrate to semantic tokens for better theming support.

### Text Colors

Replace direct colors with `text`-prefixed tokens:

| Old | New |
|-----|-----|
| `color: $primary400;` | `color: $textBrand;` |
| `color: black;` | `color: $textDefault;` |
| `color: #666;` | `color: $textSecondary;` |
| `color: red;` | `color: $textDestructive;` |

### Background Colors

Replace with `background`-prefixed tokens:

| Old | New |
|-----|-----|
| `background-color: $primary400;` | `background-color: $backgroundBrand;` |
| `background-color: #406DEA;` | `background-color: $backgroundBrand;` |
| `background-color: white;` | `background-color: $backgroundDefault;` |
| `background-color: #f5f5f5;` | `background-color: $backgroundSecondary;` |

### Border Colors

Replace with `border`-prefixed tokens:

| Old | New |
|-----|-----|
| `border: 1px solid $primary400;` | `border: 1px solid $borderBrand;` |
| `border: 1px solid #ccc;` | `border: 1px solid $borderDefault;` |
| `border: 1px solid red;` | `border: 1px solid $borderDestructive;` |

Border tokens also have tonal variants: `XLight`, `Light`, `Strong`, etc.

## Quick Reference

### Semantic Token Naming Convention

| Prefix | Use For | Examples |
|--------|---------|----------|
| `text` | Text colors | `$textDefault`, `$textBrand`, `$textDestructive` |
| `background` | Background colors | `$backgroundDefault`, `$backgroundBrand` |
| `border` | Border colors | `$borderDefault`, `$borderBrand`, `$borderLight` |

### ColorToken Generated Suffixes

| Suffix | Purpose |
|--------|---------|
| (none) | Base color |
| `$hover` | Hover state (slightly darker/lighter) |
| `$active` | Active/pressed state (more contrast) |
| `$disabled` | Disabled state (greyed out) |
| `$foreground` | Text color for readability on base |
| `$hover$foreground` | Text color for hover state |

---

## See Also

- [FOAM Views By Example](be:views) — Using tokens in view CSS
- [Button.js](https://github.com/kgrgreer/foam3/blob/development/src/foam/u2/Button.js) — Complete example of ColorToken usage

<glossary>
  <def term="CSSTokens" definition="FOAM's CSS variable system, scoped to classes automatically. Values beginning with $ are replaced when CSS is added to the DOM."></def>
  <def term="semantic tokens" definition="High-level tokens that represent design concepts (backgroundBrand, textDefault). They reference atomic tokens and should be used in views."></def>
  <def term="atomic tokens" definition="Base color values like red500, blue400. Semantic tokens reference these. Rarely used directly in views."></def>
  <def term="ColorToken" definition="A CSSToken subclass that auto-generates hover, active, disabled, and foreground variants for a color."></def>
  <def term="CSSTokenOverride" definition="Model for storing token value overrides per theme in a DAO."></def>
  <def term="CSSTokenOverrideService" definition="Service that resolves token overrides from the cssTokenOverrideDAO based on current theme."></def>
  <def term="TokenUtilBuilder" definition="Utility passed to function tokens providing expressions like LIGHTEN, DARKEN, TOKEN for color manipulation."></def>
  <def term="Variants" definition="Token values that change based on app mode (dark mode, high contrast). Configured via variantKey and variants properties."></def>
  <def term="variantKey" definition="Property on a token specifying which activeVariants key triggers value changes (e.g., 'color' for dark mode)."></def>
  <def term="fallback" definition="Token property providing a default value when a referenced token is not found."></def>
  <def term="useVariants" definition="Theme boolean that enables variant support. True by default for non-CORE apps."></def>
</glossary>