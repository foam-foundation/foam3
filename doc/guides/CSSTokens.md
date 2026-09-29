<flow name="CSSTokens" category="DOC/GUIDE" spid="foam" description="How to think about CSS tokens: where a $token's value comes from, how a value is the fallback and a mode entry wins, the color and density axes, useVariants, which token class to declare, how to add a token, and theme override rows." keywords="css tokens,cssTokens,ColorToken,variants,variantKey,activeVariants,useVariants,dark mode,density,theme,CSSTokenOverride,spacing scale,knowledge"/>

# CSS Tokens: how to think about them

A `$token` in a view's `css:` block is a name that the framework swaps for a value when the style is added to the page. This guide is the rules behind that swap, each walked on one case. The runnable examples live in the demo `src/foam/demos/examples/cssTokens.fbe`; read this page first, then run the demo.

The full token list is `src/foam/u2/CSSTokens.js`. Each rem row on the spacing and radius scales carries its px value in a comment. There is no second copy.

---

## 1. Where a token's value comes from

**How it works.** The engine reads a `$name`, finds the declaration, then asks the theme whether a row replaces it.

**One case.** `Button` says `border-radius: $buttonRadius;`.

1. Look on `Button`'s own class for a token named `buttonRadius`. Found: `4px`, declared in Button's `cssTokens:` list.
2. Not found there? Look on the shared list `foam.u2.CSSTokens`.
3. Ask the current theme for an override row whose `source` is `foam.u2.tag.Button.buttonRadius` or `buttonRadius`, in that order. A row wins over the declaration. The class-qualified form matches CSS expanded for that exact class only; a subclass expands the inherited `css:` block under its own id, so a row that must reach subclasses uses the bare name.
4. Found nowhere: the value becomes the comment `/* failed token replacement buttonRadius, <class>*/` and the browser drops that declaration. Nothing is logged in the page. The foam-lsp CSS diagnostic flags the name in the editor, and `CSSAuditTest` fails the build for it with a did-you-mean, so run the tests.

**Another class's token.** A bare `$buttonRadius` resolves only inside Button and its subclasses. From any other view, write the full class id: `$foam.u2.tag.Button.buttonRadius`. The engine splits the name at the last dot, looks the class up, and reads the token from it. `NavigationButton` does this to read `$foam.core.menu.VerticalMenu.menuBackground`.

**A value can be another token.** `backgroundBrand` is declared as `$primary400`. The engine follows the chain until it reaches a plain value.

---

## 2. A value is the fallback, a mode entry wins

**How it works.** A token has one `value` and may have a `variants` map with one entry per mode. The theme keeps a note of the current mode. The mode's entry is asked first; `value` fills any mode without an entry.

**One case.** `backgroundDefault` is `$white` with `variants: { dark: { value: '$black200' } }`.

- Light mode: no `light` entry, so the fallback `$white`.
- Dark mode: the `dark` entry, `$black200`.

**Same rule for a theme override row.** A row has a `target` and an optional `variants` map. `target` is the fallback; a mode entry wins for its mode. Every row shape, for a token whose own values are `$white` light and `$black200` dark:

| row | light | dark |
|---|---|---|
| `target: A` | A | A |
| `variants: { light: A }` | A | `$black200` |
| `variants: { dark: B }` | `$white` | B |
| `target: A, variants: { dark: B }` | A | B |
| `target: A, variants: { light: A2 }` | A2 | A |
| `target: A, variants: { light: A2, dark: B }` | A2 | B, `target` never shown |

**How to think about it.**

- `value` (token) or `target` (row) is the fallback, always.
- A mode entry under `variants` wins for its mode. Any mode without an entry gets the fallback.
- With `useVariants` off (section 4) no mode is ever named, so only the fallback is asked and `variants` is ignored.
- With `useVariants` on a mode is always named, so the mode entry is asked first, then the fallback.

**Two shapes, one idea.** A token's map holds objects, a row's map holds strings. Copying one into the other is the usual mistake.

```js
// token, in cssTokens: or CSSTokens.js
variants: { dark: { value: '$black200' } }

// override row, in a CSSTokenOverride journal
variants: { dark: '#202020' }
```

---

## 3. Axes: color, density, and the activeVariants map

**How it works.** A mode belongs to an axis. The theme's `activeVariants` map holds one current value per axis. A token names the one axis it listens to with `variantKey`, and reads only that axis.

**One case.** `activeVariants = { color: 'dark', density: 'compact' }`.

- `backgroundDefault` has `variantKey: 'color'`, so it reads `dark` and gives `$black200`.
- `space-4` has `variantKey: 'density'`, so it reads `compact` and gives its `compact` entry when one is declared.
- `buttonRadius` has no `variantKey`, so it ignores the map and gives `4px`.

The axes are independent. Dark plus compact, light plus compact, dark plus normal: every combination works, because each token reads one axis and never the other.

| axis | values | who writes it | shipped values |
|---|---|---|---|
| `color` | `light`, `dark` | `foam.lang.Window`, from the OS setting or an in-app pick | most semantic colour tokens (`$textDefault`, `$borderLight`, ...) carry a `dark` entry; palette ramps such as `$blue500` do not |
| `density` | `compact` | nothing yet (foam3 issue #5620) | none yet; every `$space-*` token has the key |

An axis is only a name in the map. A new axis costs nothing on the engine side: give the tokens the key, and write the value into `activeVariants` from wherever the app decides it. One axis per token is a design choice; a token that must react to two axes gets a function value (see "Function Tokens" in the demo) or JS in the view.

---

## 4. useVariants gates the writer, not the reader

**How it works.** `Theme.useVariants` decides whether `foam.lang.Window` writes the `color` note. Tokens always read `activeVariants`; they never check the flag.

**One case, flag off.** Window returns before writing anything. `activeVariants` stays `{}`. Every token gives its fallback. A row's `variants` map is never asked. Off is the default for a `Theme` row; the standalone theme Window uses when no app theme is loaded has it on.

**Flag on.** Window writes `activeVariants.color` as `'light'` or `'dark'`, first from the OS, then from an in-app pick when the user makes one. Every colour token now answers from its `dark` entry in dark mode. Nothing else changes.

Light is a named value, the same as dark. That is what lets a theme row change the light value alone (row 2 in the table above).

---

## 5. Which class to declare

**How it works.** Three shapes cover every token. The class is chosen by what the value is, not by what the view happens to need from it today.

| need | declare | why |
|---|---|---|
| a colour, always | `foam.u2.ColorToken` | sets `variantKey: 'color'` for you and installs `$x$hover`, `$x$active`, `$x$disabled`, `$x$foreground`; they are lazy, so an unused one costs nothing |
| anything else that flips with the colour mode: a shadow, a keyword, an image | `CSSToken` + `variantKey: 'color'` | a shadow has no hover; the key is all it needs |
| padding, radius, z-index, duration: nothing to switch | `CSSToken` with neither | no key, no map |

**One case.** `shadow-md` is a shadow that must go darker in dark mode. It contains a colour but is not one, so it is a plain `CSSToken` with `variantKey: 'color'` and a `dark` entry. Making it a `ColorToken` would install `$shadow-md$hover`, which means nothing. A border colour, on the other hand, is a colour and is a `ColorToken` even when nothing hovers over it yet: the day something does, `$x$hover` is already there and the token does not change class.

**The rule the engine enforces.** A `variants` map without a `variantKey` logs a warning at class load, and the token renders its base value in every mode. A CSS audit check that fails CI on the same case is tracked in #5614. The warning reads:

```
CSSToken foam.u2.Example.color declares variants (dark) but no variantKey;
set variantKey (for example 'color') or use foam.u2.ColorToken.
```

The engine never guesses the axis from the map's keys. `dark` is a value on the `color` axis only because the token says so.

**How ColorToken gets the derived tokens.** On the shared list, the colour block ends with `.map(v => { v.class = 'foam.u2.ColorToken'; return v; })`. That one line is what gives every token in the colour block, palette ramps included, its key and its derived forms. The spacing block ends with `.map(v => { v.variantKey = 'density'; return v; })`, the same idea for a key with no subclass.

---

## 6. Adding a token

**Where.** On the shared list when more than one view will read it. On the view's own `cssTokens:` when only that view and its subclasses care (Button's `buttonRadius`). A theme can override either by name.

**Name.** Say what the value is for, not what it is: `backgroundSecondary`, not `grey200`. The atomic tokens (`$grey200`, `$primary400`) exist so the semantic ones can point at them; views read the semantic ones.

**Value.** A token if one exists, else rem, never px. The scales below are the tokens for size-like values:

| scale | names | note |
|---|---|---|
| spacing | `$space-0`, `$space-px`, half steps `$space-0_5` … `$space-3_5`, `$space-1` … `$space-12`, then `$space-14`, `-16`, `-20`, `-24` | one unit = 4px = 0.4rem on FOAM's 10px root; `variantKey: 'density'` |
| radius | `$radius-none`, `$radius-sm`, `$radius`, `$radius-md` … `$radius-3xl`, `$radius-full` | |
| shadow | `$shadow-none`, `$shadow-sm`, `$shadow` … `$shadow-2xl`, `$shadow-inner` | each except `$shadow-none` carries a `dark` entry |
| z-index, page layers | `$z-nav` 100, `$z-popup` 200, `$z-modal` 300, `$z-tooltip` 400, `$z-toast` 500 | use these for anything that floats |
| z-index, local | `$z-0`, `$z-10` … `$z-50`, in tens | inside one component |
| motion | `$duration-75` … `$duration-1000`, `$ease-in`, `$ease-out`, `$ease-in-out`, `$ease-linear` | |

**One case, a new colour on the shared list.**

```js
{ name: 'backgroundWarning', value: '$yellow50', variants: { dark: { value: '$yellow700' } } }
```

placed inside the block that ends with the `ColorToken` stamp. It gets `variantKey: 'color'`, `$backgroundWarning$hover` and the rest from the stamp. Then run `CSSAuditTest` and the token tests.

**Checklist.**

1. Does a token already say this? Read `CSSTokens.js` first.
2. Shared list or the view's class?
3. A colour → `ColorToken`. Not a colour but flips with mode → `CSSToken` + `variantKey: 'color'`. Neither → plain.
4. A `variants` map has a `variantKey`, or the token never switches (the class logs a warning).
5. Value points at a token or is rem. Never px.
6. Dark entry present if the value is a colour.

---

## 7. Theme override rows

**How it works.** A `CSSTokenOverride` row in the `cssTokenOverrides` journal changes one token for one theme without touching the framework.

| field | meaning |
|---|---|
| `theme` | the theme id; `''` means every theme, and a theme's own row beats a `''` row |
| `source` | the token name, bare (`backgroundDefault`) or with its class (`foam.u2.tag.Button.buttonRadius`) |
| `target` | the fallback value; a plain value or another `$token` |
| `variants` | `{ dark: '…' }`, `{ light: '…' }`: a string per mode |

**One case.** Theme `mint` wants a pale green surface in light mode and the framework's dark value in dark mode:

```js
p({
  class: 'foam.core.theme.customisation.CSSTokenOverride',
  theme: 'mint',
  source: 'backgroundDefault',
  variants: { light: '#E6F4EA' }
})
```

Light reads the `light` entry. Dark finds no entry and no `target`, so it falls through any `''` row, then to the token's own `dark` value, `$black200`.

**Rows are keyed by (theme, source).** A second row for the same pair replaces the first. Put the light and dark entries on one row.

**A row is not a token.** It carries no `variantKey` of its own; it borrows the token's. And it installs no derived forms, so `$backgroundDefault$hover` still comes from the framework's `ColorToken`, shifted by `hoverModifier` from whatever the row resolved to.

---

## Where to look

- Token list: `src/foam/u2/CSSTokens.js`
- Classes: `src/foam/u2/CSSToken.js`, `src/foam/u2/ColorToken.js`
- Engine: `foam.CSS.getTokenValue` and `returnTokenAndClass` in `src/foam/lang/stdlib.js`
- Theme rows: `src/foam/core/theme/customisation/CSSTokenOverride.js` and `CSSTokenOverrideService.js`
- Mode writer: `populateDefaultThemeVariants` in `src/foam/lang/Window.js`
- Audit: `src/foam/core/theme/test/CSSAuditTest.js`
- Runnable demo: `src/foam/demos/examples/cssTokens.fbe`
