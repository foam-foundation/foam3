<flow name="ControllerModeAndVisibility" category="DOC/GUIDE" spid="foam" description="Documents the ControllerMode/Visibility/DisplayMode pipeline controlling whether a property view is editable, read-only, or hidden." keywords="controllermode,visibility,displaymode,rw,ro,hidden,knowledge"/>

# Mode and Visibility Pipeline

How FOAM controls whether a property's view is editable, read-only, disabled, or hidden.

## The Three Layers

FOAM uses a three-layer system. Think of it as a funnel: broad intent at the top, specific rendering instruction at the bottom.

### Layer 1: ControllerMode — "What are we doing?"

Set once at the top of a rendering tree (a DetailView, a page, a section). Flows down through context.

| Value | Meaning | Looks at property... |
|-------|---------|---------------------|
| `CREATE` | Making a new object | `createVisibility` |
| `VIEW` | Looking at an existing object | `readVisibility` |
| `EDIT` | Modifying an existing object | `updateVisibility` |

**Source:** `foam3/src/foam/u2/ControllerMode.js`

ControllerMode is about the **page/form's intent**, not about any individual field.

### Layer 2: Visibility — "What does this property want?"

Each property declares its preference per ControllerMode:

```javascript
{
  name: 'status',
  createVisibility: 'HIDDEN',   // hide when creating
  updateVisibility: 'RO',       // read-only when editing
  readVisibility:   'RO',       // read-only when viewing
}
```

Values are DisplayMode constants: `RW`, `RO`, `DISABLED`, `HIDDEN`.

Visibility can also be a **function** for reactive/conditional visibility:

```javascript
{
  name: 'notes',
  updateVisibility: function(status) {
    return status === 'CLOSED' ? foam.u2.DisplayMode.RO : foam.u2.DisplayMode.RW;
  }
}
```

The `visibility` property is a **global override** — if set, it trumps all three mode-specific ones:

```javascript
// ControllerMode.getVisibilityValue():
return prop.visibility || prop[this.modePropertyName];
```

### Layer 3: DisplayMode — "How should the view render?"

The final instruction given to a View. Every `foam.u2.View` has a `mode` property of type DisplayMode.

| Value | Effect |
|-------|--------|
| `RW` | Fully editable (dropdown, text input, etc.) |
| `DISABLED` | Visible but non-interactive |
| `RO` | Read-only rendering (plain text) |
| `HIDDEN` | Not rendered at all |


**Source:** `foam3/src/foam/u2/DisplayMode.js`

## The Restriction Rule

Property-level visibility can be tightened by the ControllerMode but never loosened by it. Only one rewrite exists: `VIEW` turns `RW` into `RO`. Every other combination keeps the property's own value, so `VIEW` + `DISABLED` stays `DISABLED`.

### Examples

| ControllerMode | Property visibility | Result | Why |
|---|---|---|---|
| EDIT | RW | RW | EDIT doesn't restrict |
| EDIT | RO | RO | Property is more restrictive, kept |
| EDIT | HIDDEN | HIDDEN | HIDDEN always wins |
| VIEW | RW | **RO** | VIEW caps RW → RO |
| VIEW | RO | RO | Not RW, so kept |
| VIEW | HIDDEN | HIDDEN | More restrictive than RO, kept |

In `VIEW` mode no field is editable; in `CREATE` and `EDIT` the property's own visibility applies unchanged.

**Source:** `restrictDisplayMode()` in `foam3/src/foam/u2/ControllerMode.js`

## How PropertyBorder Orchestrates It

PropertyBorder is the component that ties the three layers together. When it renders a property, it:

1. **Follows** the context's `controllerMode$` (via `follow()`)
2. **Computes** a `modeSlot` by calling `prop.createVisibilityFor(data$, controllerMode$)` — which picks the right visibility for the current ControllerMode, applies the VIEW rewrite of RW to RO, and optionally combines with permission checks
3. **Passes** `mode$: modeSlot` to the inner view (EnumView, TextField, etc.)

The inner view receives `mode$` as a reactive slot. When visibility changes, the view re-renders accordingly.

**Source:** `foam3/src/foam/u2/PropertyBorder.js`, `foam3/src/foam/u2/Element2.js:1876` (`createVisibilityFor`)

## Setting ControllerMode

ControllerMode flows through **context**. Set it by wrapping a render subtree:

```javascript
// Force a section to be read-only even inside an EDIT form
this
  .tag(this.SOME_EDITABLE_FIELD)    // RW (from EDIT context)
  .startContext({ controllerMode: foam.u2.ControllerMode.VIEW })
    .tag(this.STATUS)                // forced RO
  .endContext()
```

**What sets it in practice:**
- **DetailView / SectionView** — based on whether the object is new or existing
- **DAOController** — VIEW for list, EDIT when you open a record
- **You, explicitly** — via `startContext({ controllerMode: ... })`

**With nothing in the context, the mode is `CREATE`.** An element's `controllerMode` factory reads the context and falls back to `CREATE` (`src/foam/u2/Element2.js:573`), so a property tagged outside any detail view or `startContext` is editable. Setting `controllerMode` on your own view changes that view only: `foam.u2.Element` exports just `namespace` (`Element2.js:481-483`), so children see your value only if your class lists `'controllerMode'` in `exports:`, as `foam.comics.v3.DetailView` does (`src/foam/comics/v3/DetailView.js:49-50`).

## Visibility Driven by a Parent Object

A `visibility` function's arguments are properties of the object being rendered (`Element2.js:1860-1863`). A row of an `FObjectArray` therefore cannot hide a field based on a property of the object that owns the array. Pass a Slot instead, as a `propertyWhitelist` override, built over the parent's data and the mode:

```javascript
// in the owner's FObjectArray property: view: function(_, X) { ... valueView: { ..., propertyWhitelist: {
altId: {
  visibility: foam.lang.ExpressionSlot.create({
    args: [ X.data$.dot('contactType'), X.data.__context__.controllerMode$ ],
    code: (contactType, mode) => contactType?.name === 'PERSONAL' ?
      mode.restrictDisplayMode(foam.u2.DisplayMode.RW) : foam.u2.DisplayMode.HIDDEN
  })
}
```

Include `controllerMode$` and call `restrictDisplayMode` yourself: a Slot visibility is used exactly as given, with no VIEW rewrite of `RW` to `RO` (`Element2.js:1876`), unlike a function, whose result is passed through `restrictDisplayMode` (`:1868-1871`).

Do not assign `Model.PROP.hidden` or `Model.PROP.visibility` at runtime to get the same effect: the property axiom is shared by every instance of the class, so the change applies to every record on every screen.

**Never set controllerMode directly on a view as a property.** It is context-driven.

**Pass the enum value, never the string `'VIEW'`.** `startContext()` stores values as given; nothing adapts them (`src/foam/u2/Element2.js:1269-1275`). An element's own `controllerMode` property does adapt a string, but the sectioned detail views pass the raw context slot straight on (`src/foam/u2/detail/SectionedDetailView.js:57`, `VerticalDetailView.js:50`, `TabbedDetailView.js:72`), and visibility code then calls `controllerMode.getVisibilityValue(...)` on it (`src/foam/u2/Element2.js:1841`), which a string does not have. `startContext({ controllerMode: 'VIEW' })` can work in a simple view and throw once a sectioned detail view sits underneath. The same holds for any enum or object value placed in a context.

## Propagating Mode to Custom Inner Views

When building a **wrapper view** that creates its own inner views (bypassing PropertyBorder), you must forward the mode manually. Otherwise, the inner view falls back to its default `mode` expression — which only knows about `controllerMode`, not the property's visibility settings — and ignores `updateVisibility`, `readVisibility`, etc.

### Using `.start()`

Pass `mode$` as a slot in the args object. This is the most common pattern in the FOAM codebase:

```javascript
// FormattedTextField.js, ChoiceView.js, PhoneNumberInputView.js all use this pattern
this.start(this.MyInnerView, { data$: this.data$, mode$: this.mode$ }).end()
```

Passing `mode$:` (or `data$:`) as a create argument links the child's slot to the parent's with `linkFrom()`, which is a two-way link (`foam3/src/foam/lang/Property.js`, the `$` slot setter).

**Source:** `foam3/src/foam/u2/FormattedTextField.js:99`, `foam3/src/foam/u2/view/ChoiceView.js:278`

## Key Source Files

| File | Role |
|------|------|
| `foam3/src/foam/u2/ControllerMode.js` | CREATE/VIEW/EDIT enum, `getVisibilityValue()`, `restrictDisplayMode()` |
| `foam3/src/foam/u2/DisplayMode.js` | RW/DISABLED/RO/HIDDEN enum, `restrictDisplayMode()` |
| `foam3/src/foam/u2/PropertyBorder.js` | Orchestrator: follows context, computes modeSlot, passes to inner view |
| `foam3/src/foam/u2/Element2.js` | `createVisibilityFor()`, `combineControllerModeAndVisibility_()`, View's `mode` property |
| `foam3/src/foam/lang/Slot.js` | `follow()`, `linkFrom()`, slot binding mechanics |
