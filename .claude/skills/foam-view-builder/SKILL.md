---
name: foam-view-builder
description: Use when building, designing, or modifying FOAM UI views. Triggers on mentions of views, detail views, sections, table columns, CSS, property views, formatters, tableCellFormatter, labelFormatter, reactive UI, custom views, comics, DAOController, DAOControllerConfig, DAOMenu2, faceted views, {Model}DetailView / {Model}CreateView, browseController / createController, or when user wants to create/modify a FOAM u2 view or customize a comics (DAO CRUD) screen.
---

# FOAM View Builder - Best Practices from Codebase

Build correct, production-ready FOAM views following patterns established in the codebase.

## Critical Mental Model

**FOAM views are declarative and reactive.** Properties drive the DOM. Use FOAM's slot/dynamic system for reactivity instead of manual DOM manipulation. Key principles:
- **Prefer model-level configuration over custom views** — use propertyWhitelist, visibility functions, sections, and refinements instead of writing custom View classes
- **Prefer slots over dynamic()** when only attribute values change (not DOM structure)
- **Use `start()`/`end()` chains** for DOM building — NEVER `this.E()`
- **Use CSS classes/tokens** — NEVER inline styles
- **Use `self` in closures** — capture `var self = this;` before any callback

### What "comics" is (the CRUD engine you're customizing)

**COMICS = Context-Oriented MIcro ControllerS** (per Kevin Greer). `foam.comics` turns a `daoKey` + model into a full CRUD UI (browse table / view / edit / create / search) generated from the model's properties, sections, and permissions — no hand-written screens. A `DAOMenu2` menu is a comics screen.

It is **a state machine of micro-controllers** — "a state machine before we had FSMs." `foam.comics.v3.DAOController` owns a reactive `route` property that swaps which micro-controller is mounted (`DAOController.js:113-144`):
- `route == ''` → browse table (`renderDAOView()`)
- `route == <id>` → `foam.comics.v3.DetailView` (view/edit one record)
- `route == 'create'` → `foam.comics.v3.CreateView` (new record)

**Customize by replacing pieces and keeping the rest** — three grains, smallest to largest:
1. **Inner form view** — `config.detailView` / `config.createView` (or their `viewView`).
2. **The micro-controller for one state** — `config.browseController`, `config.createController`, and the faceted `v3.DetailView` — swaps the whole state's controller (chrome + behavior). This is the "replace one panel, keep the strip" property.
3. Everything you don't touch stays generated.

The context-oriented part: config, `data$`, `auth`/permissions, `controllerMode`, and facet lookup all flow through the FOAM context `X` — hence `startContext(...)` + imports/exports drive behavior. See §3.22 for the faceted `{Model}DetailView` / `{Model}CreateView` pattern.

### The #1 Rule: Avoid Custom Views When Possible

**Before creating a custom View class, check if you can achieve the result with:**
1. `propertyWhitelist` on VerticalDetailView/SectionedDetailView (filter + configure properties)
2. `visibility: function()` on properties (conditional show/hide)
3. `sections:` with `properties:` in a refinement (reorder/group)
4. `view: function(_, X)` on properties (customize input widget)
5. `labelFormatter` / `supportingLabel` (reactive labels/help text)
6. `ExpressionSlot.create` in propertyWhitelist overrides (cross-context visibility)

**Real example**: a large custom-view surface was replaced with a single DAOMenu2 + model-level configuration using these patterns.

---

## Phase 1: Gather Requirements (ASK THESE)

Before writing any view code, clarify:

### 1.1 View Type
- **Custom standalone view?** New class extending `foam.u2.View`
- **Property view customization?** Custom `view:`, `tableCellFormatter`, `labelFormatter`
- **Section configuration?** Grouping properties into tabs
- **Table column customization?** Custom table formatting and columns
- **Reactive label?** Label that changes based on other properties
- **View customizer?** Dynamic show/hide based on program context

### 1.2 Data Dependencies
- **What model(s)?** Read the model files FIRST
- **What properties need display?** Which fields, what types
- **Cross-property dependencies?** Does one field affect another's display
- **DAO access needed?** Which DAOs for lookups (currencyDAO, userDAO, etc.)

### 1.3 Interactivity
- **Read-only or editable?** ControllerMode: VIEW vs EDIT vs CREATE
- **Conditional visibility?** Fields that show/hide based on other values
- **Confirmation modals?** Actions that need user confirmation
- **Responsive behavior?** Must work at different widths

---

## Phase 2: Read the Model (MANDATORY)

**Before writing ANY view code, read the FOAM model files for every model involved.**

1. Search for the model class in your app's `src/` and `foam3/src/foam/`
2. Catalog ALL properties (name, type, section, visibility, view config)
3. Note existing `tableCellFormatter`, `labelFormatter`, `view:` configs
4. Note sections already defined on the model
5. Check for existing views that do similar things

---

## Phase 3: Implementation Patterns

Full pattern text + code lives in [references/patterns.md](references/patterns.md). Pick by number, read only that pattern:

| # | Pattern | Reach for it when |
|---|---|---|
| 3.1 | Custom view structure | Writing any custom u2 view class |
| 3.2 | CSS best practices + 3.2.1 Fonts.js typography | Any styling; never inline styles |
| 3.3 | Reactive patterns | dynamic()/slots, deep $ chains |
| 3.4 | Section configuration | Detail tabs, section order/visibility |
| 3.5 | tableCellFormatter | Custom table cell rendering |
| 3.6 | labelFormatter | Reactive labels (one-time trap) |
| 3.7 | Property view: config | Swapping a property's view |
| 3.8 | DoubleUnitValue | Currency display in custom views |
| 3.9 | ViewCustomizer | Changing views by context at runtime |
| 3.10 | Confirmation modal from postSet | Confirm-or-revert on a property change |
| 3.11 | propertyWhitelist | Replacing a custom DetailView |
| 3.12 | ExpressionSlot | Cross-context visibility |
| 3.13 | visibility: function() | Sibling-property-driven visibility |
| 3.14 | Version counter | Nested FObjectArray reactivity |
| 3.15 | supportingLabel function | Reactive supporting text |
| 3.16 | Refinement pattern | Model config instead of custom view |
| 3.17 | labelFormatter with X.data | Parent-context reactive labels |
| 3.18 | Property metadata guide | Which axiom does what |
| 3.19 | TitledArrayView | Array display (preferred) |
| 3.20 | CitationView | Compact array rows |
| 3.21 | View decomposition | A view growing too big |
| 3.22 | Faceted DetailView | Custom row detail by class |
| 3.23 | Controller view | Shared search + selection + rendering |
| 3.24 | Opt-out knobs | Shared view consumed by many screens |
| 3.25 | Custom row wrapper | Object-level selection |
| 3.26 | Adapting framework views | Non-native contexts |
| 3.27 | Bare vs bordered property | Permission-aware property rendering |
| 3.28 | Programmatic value formatting | Inline text, not a property view |

## Phase 3b: Decision Guide — Custom View vs Model Config

| Need | Solution | Custom View? |
|------|----------|:---:|
| Show/hide property based on sibling | `visibility: function(prop) { ... }` | No |
| Show/hide child property based on parent | `ExpressionSlot.create` in propertyWhitelist | No |
| Filter which properties appear | `propertyWhitelist` (array or object) | No |
| Custom property label | `labelFormatter` or propertyWhitelist override | No |
| Custom input widget | `view:` or `view: function(_, X)` | No |
| Custom table cell formatting | `tableCellFormatter` | No |
| Reactive helper text | `supportingLabel: function(data)` | No |
| User-facing field hint | `placeholder` on property | No |
| Developer notes on field | `documentation` on property | No |
| Compact array item display | `CitationView` subclass | No |
| Regroup properties into tabs | `sections:` in refinement | No |
| Reactive DAO filtering in dropdown | `view: function(_, X)` with slot subscription | No |
| Confirmation dialog on change | `postSet` with `ConfirmationModal` | No |
| Completely custom layout/structure | Custom `foam.u2.View` class | **Yes** |
| Custom painting/canvas | Custom `foam.u2.View` class | **Yes** |
| Complex multi-model dashboard | Custom `foam.u2.View` class or Flow | **Yes** |

---

## Phase 4: Performance Patterns

### 4.1 Preventing Rerender Loops
```javascript
// Use feedback_ flag when view mutates its own data
this.feedback_ = true;
this.data = newData;
this.feedback_ = false;

// Check in subscriber
this.data$.sub(() => {
  if ( ! self.feedback_ ) self.renderData();
});
```

### 4.2 Listener Decorators
```javascript
listeners: [
  {
    name: 'onResize',
    isFramed: true,     // requestAnimationFrame — for DOM measurements
    code: function() { /* ... */ }
  },
  {
    name: 'onScroll',
    isIdled: true,      // Debounce — fires after delay of inactivity
    delay: 48,          // ~2 animation frames
    code: function() { /* ... */ }
  },
  {
    name: 'onDataChange',
    isMerged: true,     // Coalesce — fires once per delay window
    delay: 100,
    code: function() { /* ... */ }
  }
]
```

### 4.3 Declarative Listener Binding
```javascript
{
  name: 'updateWidth',
  isFramed: true,
  on: ['this.propertyChange.tableWidth_'],  // Auto-fires on property change
  code: function() {
    this.element_.style.setProperty('--table-width', this.tableWidth_);
  }
}
```

### 4.4 Reusing Reactive DOM Elements
```javascript
// Tables are inherently reactive — don't recreate them
if ( this.tableEl ) {
  this.tableEl.moveTo(e);  // Reparent instead of rebuild
  return;
}
this.tableEl = foam.u2.WrapperNode.create({}, this);
// ... build table inside wrapper
```

### 4.5 FObjectArray Smart Updates
Track objects by `$UID` and perform surgical DOM operations:
```javascript
// Add only new items, remove only deleted items
for ( let item of oldData ) {
  if ( newData.indexOf(item) === -1 ) {
    self.removeRowWithID(item.$UID);
  }
}
for ( let item of newData ) {
  if ( ! self.dataViewMap[item.$UID] ) {
    self.addRow(item);
  }
}
```

---

## Phase 5: Template Method Pattern for Extensibility

### Break render() into overridable methods
```javascript
methods: [
  function render() {
    this.SUPER();
    this.addClass();
    this.start('div')
      .call(this.renderHeader, [this])  // Template method
      .call(this.renderBody, [this])
    .end();
  },
  function renderHeader(self) {
    // 'this' = Element; 'self' = View
    this.start('h2').add(self.data.title).end();
  },
  function renderBody(self) {
    this.start('div').addClass(self.myClass('body'))
      .add(self.data.description)
    .end();
  }
]
```

### Use ViewSpec for Pluggable Sub-Views
```javascript
properties: [
  {
    class: 'foam.u2.ViewSpec',
    name: 'cardView',
    value: { class: 'foam.core.fs.fileDropZone.FileCard' }
  }
],
methods: [
  function render() {
    // Subclasses can override cardView to use a different component
    this.tag(this.cardView, { data: this.data });
  }
]
```

---

## Phase 6: Context and Dependencies

### Imports vs Requires
```javascript
// requires: for CLASS dependencies (used as this.ClassName.create())
requires: [
  'foam.u2.DetailView',
  'foam.u2.view.RichChoiceView'
],

// imports: for RUNTIME services (injected by context)
imports: [
  'currencyDAO',
  'pushMenu',         // Import specific function if exported by controller
  'currentMenu?',     // '?' = optional, won't error if not available
  'ctrl?'             // Import controller ONLY if function not exported
],
```

**Imports are read-write** — writing `this.importedProp = x` propagates through the context back to the exporter. A child view can drive parent state without manual slot plumbing. Used by the custom row wrapper pattern (§3.25) to write a selected row back to the enclosing list's `selection`; generally useful whenever a child needs to push state upward.

### Creating Sub-Contexts
```javascript
// Provide context to child views
.startContext({
  controllerMode: foam.u2.ControllerMode.VIEW,
  objData: this.data,
  customService: myService
})
  .start(this.MyChildView, { data: this.data }).end()
.endContext()
```

### Accessing Context in view: Functions
```javascript
view: function(_, X) {
  // X.data = the model instance being edited
  // X.userDAO, X.currencyDAO = context DAOs
  return {
    class: 'foam.u2.view.RichChoiceView',
    sections: [{
      heading: 'Users',
      dao: X.userDAO
    }]
  };
}
```

---

## Anti-Patterns (NEVER DO THESE)

| Anti-Pattern | Correct Pattern |
|-------------|----------------|
| Custom DetailView to filter props | `propertyWhitelist` on VerticalDetailView/SectionedDetailView |
| Custom View for conditional visibility | `visibility: function(prop)` on the property |
| Custom View for child visibility from parent | `ExpressionSlot.create` in propertyWhitelist |
| 80+ line custom CreateView/DetailView | `refines:` with `sections:` and inline property overrides |
| `this.E()` inside dynamic() | `this.start()` inside dynamic() |
| `this.myClass()` inside dynamic() | `self.myClass()` (capture self first) |
| `this.method()` inside event handler | `self.method()` |
| Inline `style="..."` | CSS classes with `^` prefix |
| Hardcoded colors (`#04338D`, `red`) | FOAM semantic tokens (`$primary500`, `$textDestructive`) — theme/dark-mode aware (3.2) |
| Raw color scale (`$blue500`) when semantic exists | Use semantic alias (`$primary500`) (3.2) |
| Hand-rolled `font-size` / `font-weight` in custom CSS | Global typography class — `addClass('h300')`, `addClass('p-bold')`, `addClass('p-label')` (3.2.1) |
| `font-weight: 600` / `font-size: 14px` literals | `$font-medium` / `$header-xxs` weight + size tokens (3.2) |
| Redefining body font / `font-family` per view | Already on `body` via `$fontFamily` (Fonts.js) — don't redeclare |
| `foam.lookup('known.Model')` | `requires: ['known.Model']` + `this.Model` |
| `imports: ['ctrl']` for exported fn | `imports: ['pushMenu']` directly |
| Return elements from dynamic() | Build via side effects, early return OK |
| Manual setAttribute in render() | `attribute: 'BOTH'` with `domName` |
| Recreating reactive views | Cache element + `moveTo()` |
| Full rerender on array change | Track by `$UID`, surgical add/remove |
| Manual `.sub()` for property changes | `on: ['this.propertyChange.prop']` on listener |
| `FObjectArrayView` for arrays | `TitledArrayView` with `valueView` + `propertyWhitelist` |
| `help:` for user-facing text | `supportingLabel` (reactive) or `placeholder` (input hint) |
| Hard-coded UI strings in render()/actions (`'.add('Justification')'`, inline titles, prefixes) | `messages:` axiom — `{ name: 'LABEL_X', message: '...' }` then `this.LABEL_X` / `self.LABEL_X`; every user-visible string, incl. concatenation prefixes |
| Monolithic custom view (200+ lines) | Decompose: model config + small focused views + Utils |
| `formatValue` on ID fields | ID fields should NOT be locale-formatted |
| Watching array ref for child changes | Version counter pattern (3.14) |
| ExpressionSlot without controllerMode$ | Always include controllerMode$ + restrictDisplayMode |
| Modal popup for row detail | Faceted DetailView wrapper (3.22) |
| `this.method` in `.sub()` callback | `.sub(this.method.bind(this))` — method refs lose `this` |
| Embedded table shows wrong columns | `config: null` in `startContext` (3.22) |
| Global localStorage overrides table columns | `columnStorage` factory returning `getItem: null` (3.22) |
| `slot()` for async content in render chain | `dynamic()` — slot can cause DOM placement issues |
| `.add(prop)` for property with `writePermissionRequired` / `readPermissionRequired` | `.tag(prop.__, { config: { label: '', reserveLabelSpace: false } })` — bare `.add` skips PropertyBorder so the auth check never runs (3.27) |
| `visibility: 'RO'` on model just to lock down a cell render | Route the cell through `prop.__` so model permission gate keeps working for admins (3.27) |

---

## Reference Files

| Pattern | Reference File |
|---------|---------------|
| **Comics (DAO CRUD engine)** | |
| DAOController — route/state machine (browse/view/create) | `foam3/src/foam/comics/v3/DAOController.js` |
| DetailView — faceted view/edit micro-controller | `foam3/src/foam/comics/v3/DetailView.js` |
| CreateView — faceted create micro-controller | `foam3/src/foam/comics/v3/CreateView.js` |
| DAOControllerConfig — the config surface (~45 knobs) | `foam3/src/foam/comics/v2/DAOControllerConfig.js` |
| DAOMenu2 — menu handler that launches a comics screen | `foam3/src/foam/core/menu/DAOMenu2.js` |
| Faceted axiom — `{Model}{Detail,Create}View` resolution | `foam3/src/foam/pattern/Faceted.js` |
| **Framework Core** | |
| Element API | `foam3/src/foam/u2/Element2.js` |
| PropertyBorder (labels) | `foam3/src/foam/u2/PropertyBorder.js` |
| CSS Tokens (colors, weights, sizes) | `foam3/src/foam/u2/CSSTokens.js` |
| Global Typography Classes (`h100…h700`, `p`, `p-*`) | `foam3/src/foam/core/controller/Fonts.js` |
| DisplayMode + restrictDisplayMode | `foam3/src/foam/u2/DisplayMode.js` |
| ExpressionSlot | `foam3/src/foam/lang/Slot.js` |
| AbstractSectionedDetailView (propertyWhitelist) | `foam3/src/foam/u2/detail/AbstractSectionedDetailView.js` |
| VerticalDetailView | `foam3/src/foam/u2/detail/VerticalDetailView.js` |
| TitledArrayView | `foam3/src/foam/u2/view/TitledArrayView.js` |
| Section definition | `foam3/src/foam/layout/Section.js` |
| SectionView | `foam3/src/foam/u2/detail/SectionView.js` |
| ModeAltView | `foam3/src/foam/u2/view/ModeAltView.js` |
| ActionView | `foam3/src/foam/u2/ActionView.js` |
| **Performance patterns** | |
| LazyScrollManager | `foam3/src/foam/u2/view/LazyScrollManager.js` |
| ArrayView (feedback) | `foam3/src/foam/u2/view/ArrayView.js` |
| FObjectArrayView (UID tracking) | `foam3/src/foam/u2/view/FObjectArrayView.js` |
| ButtonGroup (responsive) | `foam3/src/foam/u2/ButtonGroup.js` |
| PivotTableView (sticky) | `foam3/src/foam/core/reflow/PivotTableView.js` |
| FileCard (template methods) | `foam3/src/foam/core/fs/fileDropZone/FileCard.js` |
