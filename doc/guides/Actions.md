# Actions

## What Is an Action?

An Action is a method with GUI metadata. Where a plain method is a function on a class, an Action is a function *plus* a label, availability logic, enabled logic, permissions, a confirmation dialog, keyboard shortcuts, icon, tooltip, accessibility label, and more — all declared in one place, all automatically wired up by every view that renders it.

The relationship mirrors the one between a FOAM Property and a plain instance variable. A plain instance variable holds a value. A FOAM Property also holds a value, but adds type metadata, validation, change notification, serialisation, and UI rendering — all derived from the single declaration. An Action does the same for behaviour: it is still a regular method, callable from code as `obj.submit(x)`, but the extra metadata lets views render it correctly without any per-usage wiring.

FOAM has three forms of enhanced method, each solving a different friction point:

| Form | Enhancement | Problem solved |
|---|---|---|
| `methods` | None — a plain function on the prototype | General logic |
| `listeners` | Pre-bound `this`; optional merge/frame coalescing | The impedance mismatch between GUI event callbacks (which lose `this`) and OO methods; rapid-fire events that should collapse into one call |
| `actions` | GUI metadata — label, enable/disable, permissions, confirmation, icons, shortcuts | Surfacing an operation in a UI without re-declaring all its properties at every usage site |

All three are callable from code. The enhancements only add what the specific context requires: Listeners fix the callback binding problem and handle event frequency; Actions fix the UI metadata problem and handle rendering. A method that needs both could be a Listener that is also exposed as an Action — the axiom system composes freely.

```javascript
// Called from code — works exactly like a plain method
invoice.submit(x);

// Rendered in a view — all metadata applied automatically
this.add(this.SUBMIT);
```

The metadata does not change how the method works when called programmatically. It only enriches what views can do with it.

```javascript
foam.CLASS({
  name: 'Invoice',
  // ...
  actions: [
    {
      name: 'submit',
      label: 'Submit Invoice',
      toolTip: 'Send this invoice to the customer',
      isAvailable: function(status) { return status === InvoiceStatus.DRAFT; },
      isEnabled:   function(amount) { return amount > 0; },
      confirmationRequired: function() { return true; },
      code: async function(X) {
        await X.invoiceDAO.put(this);
      }
    }
  ]
});
```

This single declaration replaces a button element, an `onClick` handler, manual enable/disable toggling, a visibility check, a confirmation dialog, and a running guard — all of which you would otherwise write by hand at every usage site.

## Why Use Actions Instead of Buttons

Adding a plain `<button>` to a form is easy. A complete, production-quality interactive control is not. For every button in a real application you need:

- The button element and its label
- An `onClick` handler
- Enable/disable logic — checking model state, re-evaluating when state changes
- Show/hide logic — hiding the button when the operation doesn't apply
- A confirmation dialog for destructive operations
- A running guard — preventing the user from clicking while an async operation is in progress
- Permission checks — hiding or disabling based on user role
- A keyboard shortcut
- An icon
- A tooltip
- An accessible `aria-label`
- i18n for every string above

That is a full page of code, and it must be repeated for every button in the application. An Action declares all of it once, and every view that renders the Action gets all of it for free.

```javascript
// In a FOAM view — this is all that's needed
this.add(this.SUBMIT);   // or: this.add(Invoice.SUBMIT)
```

## What Actions Provide Automatically

### Reactive Enable and Availability

`isEnabled` and `isAvailable` are functions whose argument names are dependency properties, exactly like `expression`. They re-evaluate automatically whenever any named dependency changes:

```javascript
isAvailable: function(status) {
  return status === InvoiceStatus.DRAFT;
},
isEnabled: function(amount, lineItems) {
  return amount > 0 && lineItems.length > 0;
}
```

`isAvailable: false` hides the button entirely. `isEnabled: false` shows it but disables it. A raw button requires you to subscribe to property changes and manually toggle `hidden`/`disabled` at every call site.

### Running Guard — Automatic Debounce

When an Action's `code` returns a Promise, FOAM automatically:

1. Sets the action's running state to `true` on the object
2. **Disables the button** for that object while the promise is pending
3. Resets running state when the promise resolves or rejects

```javascript
code: async function(X) {
  await X.paymentService.process(this);   // button is disabled for this duration
}
```

If the user clicks while the action is running, the call is silently ignored and a warning is logged. This prevents duplicate submissions, double-charges, and race conditions without any manual guard code. The running state is tracked per object instance via a `WeakMap`, so concurrent actions on different objects are independent.

### Confirmation — Two Modes

**Inline double-click guard** (default when `confirmationRequired` returns true and no `confirmationView` is set):

```javascript
confirmationRequired: function() { return true; }
// or conditionally:
confirmationRequired: function(amount) { return amount > 10000; }
```

`ActionView` runs a four-state machine:

1. **CONFIRM** — button is styled as destructive, first click changes label to "Confirm" and starts a 200ms debounce
2. **DEBOUNCE** — NOP on click, transitions to ARMED after delay
3. **ARMED** — a second click fires the action
4. **Timeout** — if the user doesn't confirm within 6 seconds, the button reverts to CONFIRM

This prevents accidental double-clicks without a modal. The button itself becomes the confirmation surface.

**Modal confirmation** (when `confirmationView` is provided):

```javascript
confirmationView: function(X, data) {
  return { title: 'Delete invoice?', body: 'This cannot be undone.' };
}
// or return a custom Element for a fully custom dialog
```

FOAM renders a `ConfirmationModal` with the title defaulting to `label + toSummary() + '?'` and body text from `confirmationView`'s return value.

### Permissions

```javascript
availablePermissions:  ['invoice.submit'],
enabledPermissions:    ['invoice.submit.enabled'],
```

The action is hidden or disabled based on the current user's permissions, checked against the auth service automatically. No manual `x.auth.check(...)` calls needed at every usage site.

### i18n

`label`, `ariaLabel`, and `toolTip` all participate in FOAM's i18n system. The string extraction script automatically generates `Locale` rows for every action's label. Translations are applied at render time with no changes to the action declaration.

### Accessibility

`ariaLabel` defaults from `label` if not set, so every rendered Action button has a sensible accessible name automatically. `toolTip` and `help` text are surfaced by rendering views. In menu and overlay contexts, keyboard navigation is handled generically for any Action.

### Keyboard Shortcuts

```javascript
keyboardShortcuts: ['ctrl+s']
```

Declared once on the Action, registered globally for the view. No `addEventListener('keydown', ...)` needed.

### Icons and Styling

```javascript
icon:      'checkmark.svg',
themeIcon: 'submit',          // resolved from the active theme
buttonStyle: 'PRIMARY',
size:        'LARGE'
```

### Multi-Select

```javascript
multiSelect: true
```

The action is enabled when multiple rows are selected in a `DAOBrowserView`, and `code` receives the selection. Bulk operations with no per-operation wiring.

## The PropertyBorder Parallel

Actions and PropertyBorder (`.__`) solve the same problem at different layers.

Adding a raw `<input>` to the DOM is easy. A complete production field is not — it needs two-way data binding, an i18n label, validation with error display, permission-based visibility, display mode (CREATE vs VIEW vs EDIT), accessibility attributes, and theming. `.__` provides all of this:

```javascript
this.add(this.MY_PROPERTY.__)   // label + view + validation + permissions + a11y + theming
```

An Action does the same for operations:

```javascript
this.add(this.MY_ACTION)        // label + button + enable/disable + confirm + permissions + a11y + running guard
```

In both cases, the naive version takes one line. The complete version without FOAM takes a page, and that page must be duplicated for every field or button in the application. The difference between a quick demo and a real application is exactly this gap — the cross-cutting concerns that are invisible in a hello-world example and inescapable in production.

FOAM closes the gap by making the complete version the default. You declare what the field or operation *is*; the framework handles everything the user actually needs to see.

## Usage in Views

```javascript
// Add a single action
this.add(this.SUBMIT);

// Add multiple actions as a group (renders as a button bar)
this.add(this.SUBMIT, this.SAVE_DRAFT, this.CANCEL);

// Add all actions declared on the model
this.add(...this.cls_.getAxiomsByClass(foam.lang.Action));

// Actions also render automatically in DAOBrowserView
// and DetailView without any explicit add() call
```

## Short-Form Declaration

A plain function in the `actions` array is treated as an Action with the function's name:

```javascript
actions: [
  async function submit(X) {
    await X.invoiceDAO.put(this);
  }
]
```

This is the minimal form — no metadata, just the behaviour. Metadata can always be added later without changing any view code.

## Summary of Declared Properties

| Property | What it controls |
|---|---|
| `name` | Method name; also the constant (`Invoice.SUBMIT`) |
| `label` | Button text (i18n-able) |
| `ariaLabel` | Accessible name, defaults from `label` |
| `toolTip` | Hover tooltip |
| `help` | Extended help text |
| `icon` / `themeIcon` | Button icon |
| `buttonStyle` / `size` | Visual style |
| `isAvailable` | Show/hide the button (reactive) |
| `isEnabled` | Enable/disable the button (reactive) |
| `confirmationRequired` | Show confirmation dialog before running (reactive) |
| `confirmationView` | Custom confirmation dialog view |
| `availablePermissions` | Permissions required to see the button |
| `enabledPermissions` | Permissions required to enable the button |
| `keyboardShortcuts` | Keyboard shortcuts that trigger the action |
| `isDefault` | Marks the primary action for a view |
| `multiSelect` | Enables bulk operation in table views |
| `code` | The operation itself (sync or async) |
