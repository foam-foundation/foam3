# Where behaviour lives

The approach rejections. A local defect costs a comment; a wrong layer costs the PR.

| Principle | One-line test |
|---|---|
| Configure the property; do not write the view | could `tag(PROP.__)` render this? |
| Choose the layer by trigger | own state → hook; served shape → decorator; after-write → rule; clock or I/O → service; named states → FSM |
| Push the concept down until one class understands it | count the classes that changed |
| A base class carries only what every subclass shares | does every subclass need this field? |
| Refine downstream; keep the core minimal | would every FOAM app want this? |

### Configure the property; do not write the view
`tag(PROP.__)` gives label, validation, visibility, i18n, permissions, and mode awareness for free.
Don't: `start('label').add('Format').end().start(this.FORMAT).end()`; a `text-muted` class for a hint
Do:    `tag(this.FORMAT.__)` with `label:` and `supportingLabel:` on the property; `startContext({ data: this })` when the property belongs to the view
Review asked: "You really shouldnt need to explictly write views a lot." (PR #3946)

### An action is declared on the model; the ActionView calls it
A hand-wired button loses i18n, a11y, theming, permissioning, debounce, and `isAvailable`/`isEnabled`.
Don't: `start('button').on('click', () => this.doIt()).end()`
Do:    `actions: [ { name: 'doIt', code: ... } ]` then `add(this.DO_IT)`

### Enum values carry their presentation and their methods
A switch on the enum, or a colour table in a view, breaks the moment a value is added.
Don't: `switch ( op )`; `status != WON && status != LOST && ...`; `mode.name === 'PRESENTATION'`
Do:    `op.createSink()` as a method on the value; `status.getIsTerminal()`; `mode == FlowMode.PRESENTATION`; `color`/`background` on the value, one generic view

### Choose the layer by trigger
Each mechanism owns one trigger; the wrong one duplicates the logic or runs it at the wrong time.
Don't: business logic in a view; an `instanceof` ladder inside a rule action; a payload assembled in each UI action
Do:    property hook → one object's own state · DAO decorator → stored shape differs from served · rule → cross-model propagation after a write, gated by an FScript predicate · `COREService` + `ContextAgent` → a clock or I/O boundary · FSM → operator- or partner-driven states, payload built in the transition
Review asked: "All the payloads can be determine during FSM state transition, and could be added there. Rather than on the actions."

### Interface plus `instanceof` over reflection or a type switch
Reflection is slow and breaks on subclasses; an interface method is polymorphic and cheap.
Don't: `getClass().getDeclaredField("delegateIsSet_")`; `sink instanceof A || sink instanceof B`
Do:    `ProxyDAO.DELEGATE.isSet(ns)`; a `Reducable` interface the sinks implement

### Push the concept down until one class understands it
Logic above the seam every caller passes through must be re-implemented by each caller.
Don't: a coverage check in `MDAO.addIndex`; a parent reading a subclass detail
Do:    the check in `AltIndex`; a named method the subclass overrides
Review asked: "would this be simpler if this code were moved into AltIndex? Then nobody outside of AltIndex would need to know?" (PR #5339)

### A base class carries only what every subclass shares
A feature-specific field on the abstract parent forces every other subclass to carry and serialize it.
Don't: `attachmentIds`, `bulkFileIds` on an abstract base when one subclass bulk-uploads
Do:    a `BulkUpload` model that references the record

### Refine downstream; keep the core minimal
A property on a core class loads for every app; a refinement loads with the feature that needs it.
Don't: a table-column flag on `foam.lang.Property`; a global config DAO in foam3
Do:    `refines: 'foam.lang.Property'` in the outputter's file; the config in the app

### Derive it; do not ask the caller to declare it
A flag the caller maintains is a second source of truth that drifts.
Don't: `navStackBottom` with a clamping `preSet`; `visible` on a block the container already tracks
Do:    `this.stack.slice(0, this.stack.pos).length < 1`; delete the property

### Delete the abstraction that does not work
A broken decorator kept "for later" collects a workaround in every caller.
Don't: a guard at each call site around a DAO whose design failed
Do:    delete the class and its config; name the replacement in the commit
