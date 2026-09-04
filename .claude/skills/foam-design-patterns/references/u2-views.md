# u2 views

Tokens, scoping, reactivity, and lifecycle. A view is reusable only if it sets its own internals
and nothing about its host.

| Principle | One-line test |
|---|---|
| Colours from CSS tokens, never a literal | `grep '#[0-9a-f]\{3,6\}' <view>` returns nothing |
| Scope every class with `myClass()` | any bare `.class-name` in `css:`? |
| Class toggle before slot before `dynamic()` | does the DOM structure change, or only a value? |
| Wrap every `sub()` in `onDetach` | count `sub(` vs `onDetach(` |
| PropertyBorder owns label, visibility, errors | does the view read `controllerMode` or render a label by hand? |

### Colours come from tokens; never a literal
A literal cannot be themed and does not follow dark mode; named colours (`blue`, `red`) are literals too.
Don't: `color: #1e40af`, `color: blue`, `background: rgb(...)`, `.style({ color: 'red' })`
Do:    `color: $primary500` or `$textBrand`; inside `style()`: `foam.CSS.returnTokenValue('$primary500', this.cls_, this.__subContext__)`
Review asked: "Please use CSSTokens for all colors." (PR #3946); "You should always use colours as listed in foam.u2.CSSTokens"

### Scope every class with `myClass()`; set internals, never footprint
An unscoped class collides with `Fonts.js`; a root `height`/`width` on a reusable view forces every embedder to fight it.
Don't: `.row { ... }`; `^ { width: 100%; height: 300px; }` on a shared view; `!important`
Do:    `^row { ... }` with `addClass(this.myClass('row'))`; `^pos > * { height: 100% }`; the embedder sets the footprint

### `rem` over `px`; Fonts classes over `h3`; ThemeGlyphs over a new SVG
FOAM sets `1rem = 10px` so everything scales with font size; glyphs are already inlined.
Don't: `width: 12px`; `<h3>` for a title; a new `icon.svg`
Do:    `width: 1.2rem`; `addClass('h300')` from Fonts.js; `themeIcon: 'dropdown'`

### Toggle a class or bind a slot before reaching for `dynamic()`
Each step up the ladder rebuilds more DOM; `dynamic()` is for structure changes only, and it builds into `this`.
Don't: `this.slot(function(x) { return this.E().add(x); })`; a `dynamic()` around a whole table when one cell changes; `add(function() {...})` without `dynamic`
Do:    `.enableClass('open', this.open$)` · `.add(this.title$)` · `.show(cond$)` · `this.dynamic(function(items) { ... })` around the block whose children are replaced
Review asked: "keep dynamic() only around the elements whose structure actually changes." (`doc/guides/ReactiveUI.md:212`)

### Wrap every `sub()` in `onDetach`, on the view that made it
A bare subscription outlives the view; registering it on the data it watches leaks when the data outlives the view.
Don't: `this.data.x$.sub(this.onX)`; `data.onDetach(sub)`
Do:    `this.onDetach(this.data.x$.sub(this.onX))`; or a `listeners:` axiom, which self-detaches
Review asked: "Two bare sub() calls were the entire U3 leak" (foam3 `7d7feed235`)

### PropertyBorder owns label, units, visibility, errors, help
A property view that renders its own label or reads `controllerMode` duplicates the border and fights it.
Don't: `start('label').add(prop.label)`; `if ( this.controllerMode == 'VIEW' ) ...` in a property view
Do:    `tag(prop.__)`; `visibility:` on the property; `startContext({ controllerMode: ... })` in the container
Review asked: "Never set controllerMode directly on a view as a property. It is context-driven." (`doc/guides/ControllerModeAndVisibility.md:125`)

### Never mutate the shared Property axiom from a view
`this.data.POSTAL_CODE` is one object for every instance of the class.
Don't: `this.data.POSTAL_CODE.label = 'ZIP'`
Do:    `.tag(this.data.POSTAL_CODE.__, { config: { label$: this.zipLabel$ } })`

### Optional imports get `?`, a `?.` call, and a real default
A framework view must render outside its usual host; a missing import must not throw or warn.
Don't: `imports: ['stack']` then `this.stack.push(...)`
Do:    `imports: ['stack?']` then `this.stack?.push(...)`; or a property with `factory: function() { return this.__context__.x || NullX.create(); }`

### URL state is a `memorable: true` property; navigate through the router
Hand-managed `memento.head` and hand-built `StackBlock` configs bypass the routing the framework already owns.
Don't: `this.memento_.head = ...`; `stack.push(StackBlock.create({ view: {...} }))`
Do:    `{ name: 'tab', memorable: true }`; `this.routeTo(...)` / `routeToDAO(...)`

### Declare an action's confirmation
A hand-rolled modal plus a second "confirm" action duplicates what `confirmationRequired` already does.
Don't: `actions: [ delete, confirmDelete ]` with a custom popup
Do:    `{ name: 'delete', confirmationRequired: true, code: ... }`

### Import the exported function, never `ctrl`
`ctrl` exists for debugging and only in apps with the standard controller.
Don't: `imports: ['ctrl']`, `this.ctrl.pushMenu(...)`
Do:    `imports: ['pushMenu', 'routeTo', 'notify', 'currentMenu?']`
