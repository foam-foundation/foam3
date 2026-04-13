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
    return status === 'CLOSED' ? 'RO' : 'RW';
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

Property-level visibility can only be **equal to or more restrictive** than what the ControllerMode allows. Never less restrictive.

The restriction order (least → most restrictive):

```
RW  →  DISABLED  →  RO  →  HIDDEN
```

### Examples

| ControllerMode | Property visibility | Result | Why |
|---|---|---|---|
| EDIT | RW | RW | EDIT doesn't restrict |
| EDIT | RO | RO | Property is more restrictive, kept |
| EDIT | HIDDEN | HIDDEN | HIDDEN always wins |
| VIEW | RW | **RO** | VIEW caps RW → RO |
| VIEW | RO | RO | Already at/below VIEW's ceiling |
| VIEW | HIDDEN | HIDDEN | More restrictive than RO, kept |

ControllerMode sets a **ceiling** on how permissive a field can be. The property can tighten further, but never loosen beyond that ceiling.

**Source:** `restrictDisplayMode()` in `foam3/src/foam/u2/ControllerMode.js`

## How PropertyBorder Orchestrates It

PropertyBorder is the component that ties the three layers together. When it renders a property, it:

1. **Follows** the context's `controllerMode$` (via `follow()`)
2. **Computes** a `modeSlot` by calling `prop.createVisibilityFor(data$, controllerMode$)` — which picks the right visibility for the current ControllerMode, applies the restriction ceiling, and optionally combines with permission checks
3. **Passes** `mode$: modeSlot` to the inner view (EnumView, TextField, etc.)

The inner view receives `mode$` as a reactive slot. When visibility changes, the view re-renders accordingly.

**Source:** `foam3/src/foam/u2/PropertyBorder.js`, `foam3/src/foam/u2/Element2.js:1844` (`createVisibilityFor`)

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

**Never set controllerMode directly on a view as a property.** It is context-driven.

## Propagating Mode to Custom Inner Views

When building a **wrapper view** that creates its own inner views (bypassing PropertyBorder), you must forward the mode manually. Otherwise, the inner view falls back to its default `mode` expression — which only knows about `controllerMode`, not the property's visibility settings — and ignores `updateVisibility`, `readVisibility`, etc.

### Using `.start()` (preferred)

Pass `mode$` as a slot in the args object. This is the most common pattern in the FOAM codebase:

```javascript
// FormattedTextField.js, ChoiceView.js, PhoneNumberInputView.js all use this pattern
this.start(this.MyInnerView, { data$: this.data$, mode$: this.mode$ }).end()
```

### Using `ViewSpec.createView` (manual wiring)

When creating views programmatically, link the mode after creation using `follow()`:

```javascript
// Inside your custom wrapper view's render():
var view = foam.u2.ViewSpec.createView(self.inputView, config, self, self.__subContext__);
view.data$.linkFrom(self.data$);     // data binding convention
view.mode$.follow(self.mode$);       // mode propagation convention
this.add(view);
```

### Convention

- `follow()` for mode / controllerMode propagation (parent → child UI state)
- `linkFrom()` for data binding (model values)

**Source:** `foam3/src/foam/u2/FormattedTextField.js:100`, `foam3/src/foam/u2/view/ChoiceView.js:278`

## Key Source Files

| File | Role |
|------|------|
| `foam3/src/foam/u2/ControllerMode.js` | CREATE/VIEW/EDIT enum, `getVisibilityValue()`, `restrictDisplayMode()` |
| `foam3/src/foam/u2/DisplayMode.js` | RW/DISABLED/RO/HIDDEN enum, `restrictDisplayMode()` |
| `foam3/src/foam/u2/PropertyBorder.js` | Orchestrator: follows context, computes modeSlot, passes to inner view |
| `foam3/src/foam/u2/Element2.js` | `createVisibilityFor()`, `combineControllerModeAndVisibility_()`, View's `mode` property |
| `foam3/src/foam/lang/Slot.js` | `follow()`, `linkFrom()`, slot binding mechanics |
