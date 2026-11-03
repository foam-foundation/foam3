<flow name="Themes" category="DOC/GUIDE" spid="foam" description="How a FOAM app gets its look: which Theme a user gets, CSS tokens and their dark variants, recolouring a theme with CSSTokenOverride rows, reading a token from JS, and the legacy colour macros to avoid." keywords="theme,themes,css tokens,cssTokens,ColorToken,dark mode,variants,activeVariants,useVariants,CSSTokenOverride,customise theme,ThemeDomain,colour,color,branding,knowledge"/>

# Themes

A theme is everything about how an app looks for one group of users: its colours, logo, fonts, navigation and a few behaviour switches. This guide covers how a theme is picked, how styling flows from it, and how to change colours without touching code.

Read [CSSLayout](CSSLayout.md) first if you have not: it explains what happens to a `css:` block and its `$token` references on the way to the page.

---

## 1. The pieces

| Piece | What it is | Where |
|---|---|---|
| `foam.core.theme.Theme` | One row per look: name, logo, images, navigation menus, `registrations`, the dark-mode switch | `themeDAO`, seeded from `themes.jrl` |
| `foam.core.theme.ThemeDomain` | Maps a hostname to a theme id | `themeDomainDAO`, `themeDomains.jrl` |
| `cssTokens:` | Named style values a class declares and its `css:` uses as `$name` | Any class; app-wide defaults in `foam.u2.CSSTokens` |
| `foam.core.theme.customisation.CSSTokenOverride` | A row that replaces one token's value for one theme (or all themes) | `cssTokenOverrideDAO`, journal `cssTokenOverrides` |
| `CSSTokenOverrideService` | Client cache of override rows; every `$token` lookup asks it first | `cssTokenOverrideService` in the context |

Two admin menus come with foam3: **Themes - All** (`admin.theme-all`, the Theme rows) and **Customise Theme** (`admin.customise-theme`, the override rows).

---

## 2. Which theme a user gets

`foam.core.theme.Themes.findTheme(x)` decides, on the client and on the server:

1. **Domain.** Look up the page's hostname in `themeDomainDAO`; fall back to the `localhost` row. Its `theme` id must name an **enabled** Theme.
2. **Spid.** Once a user is logged in, walk their spid from most to least specific (`acme.eu` → `acme` → `''`) and take the first enabled Theme with that `spid`.

Group and user theme merging exist in the code but are switched off (`if ( false && ... )`), so today it is domain first, then spid.

The chosen theme is `ctrl.theme` and is exported as `theme`. Setting `ctrl.theme` (the Theme row's **Preview** action does this) re-applies dark mode, reloads the override cache and publishes `themeChange`, which re-expands every installed stylesheet.

---

## 3. CSS tokens: the styling system to use

A token is a named value declared on a class and referenced from CSS with `$`.

```javascript
foam.CLASS({
  package: 'com.acme',
  name: 'Badge',
  extends: 'foam.u2.View',

  cssTokens: [
    { class: 'foam.u2.ColorToken', name: 'badgeBackground', value: '$backgroundBrandTertiary' },
    { name: 'badgeRadius', value: '$space-1' }
  ],

  css: `
    << {
      background: $badgeBackground;
      color: $badgeBackground$foreground;
      border-radius: $badgeRadius;
      padding: $space-1 $space-2;
    }
    <<:hover { background: $badgeBackground$hover; }
  `
});
```

How a `$name` is resolved, in order:

1. An enabled `CSSTokenOverride` row for the current theme, then one for all themes (section 5).
2. The token on the class that owns the CSS (`badgeBackground` above).
3. The same name on `foam.u2.CSSTokens`, the app-wide set: brand, surface, text, border and status colours, the `space-*` scale, fonts and header sizes.

A token can point at another token (`value: '$primary400'`) and that is resolved too. To use another class's token, give its full name: `$foam.u2.Tabs.tabActiveColor`.

### ColorToken and the forms it adds

`foam.u2.ColorToken` is a `CSSToken` for colours. For a token `x` it also installs:

| Token | Value |
|---|---|
| `$x$hover`, `$x$active`, `$x$disabled` | `x` lightened or darkened by `hoverModifier` (-20), `activeModifier` (-40), `disabledModifier` (60) |
| `$x$foreground`, `$x$hover$foreground`, … | `$black` or `$white`, whichever reads better on that background (`onLight` / `onDark`) |

Use `ColorToken` for anything that is a colour. A plain `CSSToken` is for sizes, fonts and keywords.

### Variants: dark mode and friends

A token can carry other values keyed by mode:

```javascript
{ class: 'foam.u2.ColorToken', name: 'panelBackground', value: '$white', variants: { dark: { value: '$grey700' } } }
```

`variantKey` names which mode axis the token follows. `ColorToken` sets `'color'` for you. A plain `CSSToken` with `variants` needs `variantKey` set explicitly, or the map is never read. foam3 warns at class load when that happens.

The active mode lives in `theme.activeVariants`, for example `{ color: 'dark' }`. Dark mode is **off unless the Theme row sets `useVariants: true`**. When it is on, `foam.lang.Window` picks `dark` or `light` from the user's stored choice (`window.colorScheme`, which `foam.u2.theme.ColorSchemeToggle` sets) or, failing that, the OS `prefers-color-scheme`. Changing it reloads styles.

### Reading a token from JavaScript

Canvas, SVG and inline values cannot use `$` syntax. Resolve the token in the view's context:

```javascript
var colour = foam.CSS.returnTokenValue('$textBrand', this.cls_, this.__subContext__);
```

This goes through the override service and the active variant, so it returns the same value the CSS got. Listen for `themeChange` (or the theme's `activeVariants`) if the drawing has to follow a change.

---

## 4. Images, navigation and other Theme fields

The Theme row also holds what is not a colour:

- **Images:** `logo`, `largeLogo`, `topNavLogo`, `loginImage`, `externalCommunicationImage`. Each is a URL or a data URI.
- **Navigation:** `navigationRootMenu`, `settingsRootMenu`, `defaultMenu`, `unauthenticatedDefaultMenu`, `sideNav`, `topNavigation`, `footerView`.
- **Application:** `appName`, `loginView`, `headConfig`, `defaultLocaleLanguage`, `supportConfig`.
- **`registrations`:** swap one class for another for this theme only. For example, every `foam.u2.PropertyBorder` becomes your own border class. No other code has to change.

---

## 5. Recolouring a theme without code: CSSTokenOverride

An override row replaces one token's value:

| Field | Meaning |
|---|---|
| `theme` | Theme id the row applies to; `''` applies to every theme |
| `source` | Token name: `primary400`, or a class-scoped `foam.u2.Tabs.tabActiveColor` |
| `target` | Replacement value, a colour or another `$token` |
| `variants` | Per-mode values, e.g. `{ "dark": "#9AB8FF" }`. A mode with an entry uses it; others use `target` |
| `enabled` | Off keeps the row but ignores it |

Rows can be seeded in a journal (`cssTokenOverrides.jrl`) or edited under **Customise Theme**:

```
p({"class":"foam.core.theme.customisation.CSSTokenOverride","theme":"acme","source":"primary400","target":"#0F766E","variants":{"dark":"#5EEAD4"}})
```

Lookup order for a token, first match wins:

1. This theme, the active mode (`source-dark`)
2. This theme, `target`
3. All themes (`''`), the active mode
4. All themes, `target`
5. The token's own value and variants

Overriding a base token such as `primary400` recolours everything built on it. That includes every `ColorToken` derived from it and its `$hover`/`$foreground` forms. Override the most general token that gives the result you want.

**After writing a row from your own view**, publish `ctrl.pub('themeChange')`. The service reloads its cache when the DAO changes, but in practice installed stylesheets were seen to keep the old value until `themeChange` re-expanded them.

`cssTokenOverrideDAO` uses a `GlobalReadAuthorizer`: every user can read the rows, and writing them needs the `csstokenoverride.*` permissions. A non-admin group also needs `service.cssTokenOverrideDAO`.

---

## 6. Legacy colour macros: do not use

`Theme` still has `primary1..5`, `secondary1..5`, `approval1..5`, `warning1..5`, `destructive1..5`, `grey1..5`, `black`, `white`, `font1` and `inputHeight`/`inputVerticalPadding`/`inputHorizontalPadding`. They belong to an older system. In it, CSS contained `/*%PRIMARY1%*/ #406DEA` and `ApplicationController.MACROS` replaced the comment with the theme field (`returnExpandedCSS`).

Almost no foam3 CSS uses these macros any more, and most of the fields are never set (issue #5617). Setting them changes nearly nothing on screen. Recolour with `CSSTokenOverride` instead. The input sizing fields map to the `inputHeight`, `inputVerticalPadding` and `inputHorizontalPadding` tokens, and `font1` to the `font1` token.

`customCSS` rides the same macro (`%CUSTOMCSS%`) and is only expanded by `foam.core.u2.navigation.Stack` and `MDStackView`.

Do not add `/*%...%*/` macros to new CSS. `/*%FILL%*/`-style comments in SVG glyphs use the same syntax for a different purpose; leave those alone.

---

## 7. Checks and gotchas

- **`CSSAuditTest`** (`./build.sh server-tests:CSSAuditTest`) fails on hard-coded colours or fonts, unknown `$tokens` and CSS syntax errors. Keep it at zero; refine its skip list in your app for vendored CSS.
- **Unknown token:** the CSS gets `/* failed token replacement name, cls */` and the property is dropped. `CSSAuditTest` catches it; the browser does not complain.
- **`variants` without `variantKey`** on a plain `CSSToken` renders the base value in every mode (class-load warning).
- **Dark mode does nothing** until the Theme row has `useVariants: true`.
- **Theme and override journals** are read at server start. JS and CSS changes need a hard reload because the dev server sends `/src/**/*.js` as immutable.
- **Tests:** the client-test page follows the OS colour scheme. Assert colours in explicit sub-contexts, e.g. `x.createSubContext({ theme: { activeVariants: { color: 'dark' } } })`, instead of assuming light.

---

## See also

- [CSSLayout](CSSLayout.md): the `css:` pipeline, `<<` and `^`, scrolling and stacking.
- [ControllerModeAndVisibility](ControllerModeAndVisibility.md): why the Theme screen is read-only until Edit.
- `src/foam/u2/CSSTokens.js`: the full list of app-wide tokens.
- `src/foam/core/theme/Theme.js`: every Theme field and its section.
