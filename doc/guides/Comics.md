# foam.comics — Context-Oriented MIcro ControllerS

## What Is Comics?

**comics** stands for **Context-Oriented MIcro ControllerS**.

The name describes the architecture. Rather than one large controller that manages an entire CRUD flow, `foam.comics.v3` composes a set of small, focused micro-controllers — one per state. Each micro-controller handles one step in the process (browse, create, view/edit) and can be swapped out independently. The whole assembly is coordinated by a top-level state machine (`DAOController`) that routes between them based on a single `route` property.

The result is that to customise one piece — say, replace the create form — you replace only that micro-controller and leave the rest untouched.

## Why This Matters

Most frameworks treat CRUD as a chore that only the "important" models deserve to have done properly. In practice this means: a handful of top-tier entities get a real UI with search, sorting, export, and column selection; everything else gets a hand-rolled table with no filtering, a hard-coded form, and a REST endpoint with no documentation. Second-class services are everywhere, because building the full stack for each model costs real time.

FOAM is egalitarian. Every model gets the same treatment. Declare one `foam.CLASS({...})` and FOAM generates, automatically and without further instruction:

- A Java class (the domain object, with typed getters/setters)
- A DAO strategy — in-memory, journalled, or database-backed
- JSON marshalling in both directions, derived from the same property definitions
- A ClientDAO that communicates with the server over HTTP/WebSocket
- A full REST API and MCP server endpoint
- A CRUD controller: table view, detail view, create form, edit form
- Search (SIMPLE or FULL mode), AQL query bar derived from the model's properties
- Sorting, column selection, import, export, caching, permission gating

The DAOController is where all of these pieces converge into one end-to-end system:

```
Model definition
  ↓ (generates)
Java class ← JSON ← Server DAO ← ClientDAO ← DAOController
                                                   ↓
                                              TableView → row click → DetailView
                                                   ↓
                                         Search / AQL query bar
```

The user sees a fully-featured CRUD UI. The developer wrote one class definition. No controller code, no REST handler, no serialiser, no table component, no form component.

This is significant because writing CRUD UIs — marshalling objects into and out of libraries, storage layers, and network protocols — is what most of the world's programmers spend most of their time doing. FOAM eliminates that work for every model, not just the ones deemed important enough to deserve it.

This also demonstrates FOAM's fine-grained component model. A monolithic code generator that produced the entire CRUD stack in one pass would create a different problem: if any part of the output was wrong for your use case, your only options would be to hand-edit the generated code — creating a *code liability*, a divergence from the generator that makes future regeneration destructive — or to do without. Neither is acceptable.

FOAM avoids this by composing small, independently replaceable pieces. The table, the detail form, the search bar, the ClientDAO, the JSON marshaller, the server DAO, the Java class — each is a distinct component. If any one of them doesn't fit your need, you replace (or decorate, or compose) just that component and leave the rest unchanged. There is no generated artifact to hand-edit and no liability to accumulate. The customisation lives cleanly alongside the framework code, and the next developer can read exactly which pieces were changed and why.

## Class Hierarchy

```
foam.comics.v3.DAOController          ← top-level state machine; exports daoController, config, click
├── foam.comics.v3.DAOView            ← Browse state: table + create/select buttons
├── foam.comics.v3.CreateView         ← Create state: empty form + Save action
└── foam.comics.v3.DetailView         ← View/Edit state: populated form + Edit/Save/Copy/Delete actions
```

Configuration for all three states lives in one shared object:

```
foam.comics.v2.DAOControllerConfig    ← all configuration, consumed by every micro-controller
```

CRUD actions can be overridden per-model via:

```
foam.comics.v3.ComicsAction           ← extends foam.lang.Action; replaces default CRUD behaviour
```

## The State Machine

`DAOController` uses a single memorable `route` property and a `dynamic()` block to switch between micro-controllers:

| `route` value | Micro-controller rendered |
|---------------|--------------------------|
| `''` (empty)  | `DAOView` — browse/list  |
| `'create'`    | `CreateView` — new object form |
| Any record ID | `DetailView` — view/edit of that record |

```javascript
// Navigating programmatically
daoController.route = '';          // go to browse
daoController.route = 'create';    // go to create form
daoController.route = obj.id;      // go to detail for this record
```

`route` is declared `memorable: true`, so it is reflected in the URL hash and survives page refreshes. The browse state also preserves filter/memento state and restores it when returning from a detail view.

### DAOController context exports

`DAOController` exports three things into its sub-context, making them available to all child views without explicit imports:

| Export | What it is |
|--------|-----------|
| `as daoController` | The controller itself — children call `daoController.route = ...` to navigate |
| `config` | The shared `DAOControllerConfig` instance |
| `click` | The row-click handler; defaults to `daoController.route = id` |

## Micro-Controllers

### DAOView — Browse state

`foam.comics.v3.DAOView` renders the list/table and the trailing Create / Select buttons in the stack header.

- The table is driven by `config.browseViews` if set; falls back to `foam.comics.v2.DAOBrowserView`.
- The **Create** button sets `daoController.route = 'create'`. It can be replaced by a model-level `ComicsAction` named `create`, or redirected to a menu via `config.createMenu`.
- The **Select** button appears only when `config.selectMode` is `true`; it publishes `config.select` when clicked.

### CreateView — Create state

`foam.comics.v3.CreateView` sets `controllerMode` to `CREATE`, renders the form specified by `config.createView`, and places a single **Save** button in the stack header.

On successful save:
1. Notifies the user (`notify`).
2. Sets `daoController.route = o.id` — navigating directly to the new record's `DetailView`.

### DetailView — View/Edit state

`foam.comics.v3.DetailView` loads the record by `idOfRecord` (derived from `daoController.route`), and manages two internal data objects:

- `data` — the last-saved version, loaded from the DAO.
- `workingData` — a clone used during editing; discarded on cancel.

It cycles between two `controllerMode` values:

| Mode | What's visible |
|------|---------------|
| `VIEW` | Edit, Copy, Delete buttons; primary model actions |
| `EDIT` | Save, Cancel buttons only |

The view form rendered is `config.detailView` (defaults to `foam.u2.detail.TabbedDetailView`).

`DetailView` exports itself as `stack`, routing sub-view pushes through its own `Stack` subclass so they stay inside the detail panel rather than replacing the whole controller.

## DAOControllerConfig

`foam.comics.v2.DAOControllerConfig` is the single configuration object consumed by all three micro-controllers. Pass it as the `config` property of `DAOController`, or let it be auto-created from the DAO.

```javascript
tag({
  class: 'foam.comics.v3.DAOController',
  data: myDAO,
  config: foam.comics.v2.DAOControllerConfig.create({
    browseTitle: 'My Records',
    tableColumns: ['name', 'email', 'active']
  })
})
```

### Display

| Property | Default | Description |
|----------|---------|-------------|
| `browseTitle` | model plural | Page title shown in breadcrumb / stack header |
| `createTitle` | `'Create a New ' + label` | Title for the create form |
| `tableColumns` | all non-hidden properties | Columns shown in the table |
| `searchColumns` | model `searchColumns` axiom | Properties searched by the query bar |
| `searchMode` | `'FULL'` | `'NONE'`, `'SIMPLE'`, or `'FULL'` filter UI |
| `minHeight` | `424` | Table minimum height in px |

### Views

| Property | Default | Description |
|----------|---------|-------------|
| `browseBorder` | `CardBorder` | Border wrapping the browse table |
| `viewBorder` | `NullBorder` | Border wrapping the detail/create form |
| `detailView` | `TabbedDetailView` | Form rendered in `DetailView` |
| `createView` | `SectionedDetailView` (inside `FObjectView`) | Form rendered in `CreateView` |
| `browseViews` | model `NamedViewCollection` axioms | Named view tabs above the table |
| `summaryView` | `TableView` | The table/list component inside `browseView` |

### CRUD Predicates

Five predicate properties control button visibility and availability. Each is a `foam.mlang.predicate.Predicate` evaluated against the current record.

| Property | Default | Controls |
|----------|---------|----------|
| `createPredicate` | `True` | CREATE button in browse view |
| `editPredicate` | `True` | EDIT button in detail view |
| `deletePredicate` | `True` | DELETE in detail overflow menu |
| `copyPredicate` | `createPredicate` | COPY in detail overflow menu |
| `refreshPredicate` | `True` | REFRESH button in browse view |

```javascript
// Disable delete entirely:
config.deletePredicate = foam.mlang.predicate.False.create();

// Only allow edit for active records:
config.editPredicate = foam.mlang.predicate.Eq.create({
  arg1: { class: '__Property__', forClass_: 'com.example.MyModel', name: 'active' },
  arg2: { class: 'foam.mlang.Constant', value: true }
});
```

### Multi-Select

```javascript
config.selectMode = true;          // enables checkbox multi-select in the table
config.selectTitle = 'Add';        // label for the Select button
// selected objects are available at config.selectedObjs (a Map of id → object)
```

### Canned Queries

Canned queries appear as filter tabs above the browse table. Declare them on the model:

```javascript
foam.CLASS({
  name: 'MyModel',
  axioms: [
    foam.comics.v2.CannedQuery.create({
      label: 'Active',
      predicateFactory: function(e) {
        return e.EQ(MyModel.ACTIVE, true);
      }
    })
  ]
});
```

Or override per-view on the config:

```javascript
config.cannedQueries = [
  foam.comics.v2.CannedQuery.create({
    label: 'Business',
    predicateFactory: function(e) {
      return e.EQ(DC.CONTACT_TYPE, 'BUSINESS');
    }
  })
];
```

### Permission-Gated CRUD (`CRUDEnabledActionsAuth`)

When `CRUDEnabledActionsAuth` is set, each CRUD button checks a permission string before enabling:

```javascript
config.CRUDEnabledActionsAuth = foam.comics.v2.CRUDEnabledActionsAuth.create({
  isEnabled: true,
  enabledActionsAuth: {
    permissionFactory: function(operation, obj) {
      return 'mymodel.' + operation.name.toLowerCase() + '.' + obj.id;
    }
  }
});
```

### Navigation Overrides

| Property | Description |
|----------|-------------|
| `createMenu` | Menu ID to push instead of the built-in CreateView |
| `createController` | ViewSpec to push onto the stack as the create view (alternative to `CreateView`) |
| `click` | Override the row-click handler; receives `(obj, id)` |
| `disableSelection` | `true` to make rows non-clickable |

---

## ComicsAction — Overriding Default CRUD Behaviour

`foam.comics.v3.ComicsAction` extends `foam.lang.Action` and is the hook for per-model customisation of comics CRUD behaviour. Any action with one of the following names, declared as a `ComicsAction` on the model, replaces the default implementation:

| Name | Default implementation |
|------|----------------------|
| `create` | `DAOView` — sets `daoController.route = 'create'` |
| `edit` | `DetailView` — sets `controllerMode = 'EDIT'` |
| `save` | `DetailView` — `config.dao.put(workingData)` |
| `delete` | `DetailView` — opens `DeleteModal`, then routes back to browse |
| `copy` | `DetailView` — clones record (clearing id), pushes `DAOCreateView` |

**Any property not explicitly set on the `ComicsAction` is copied from the default implementation.** You override only what you need.

```javascript
foam.CLASS({
  name: 'Flight',
  // ...
  actions: [
    {
      class: 'foam.comics.v3.ComicsAction',
      name: 'edit',
      // Add an extra enabled check on top of the default permission check
      isEnabled: function(isCompleted) {
        return ! isCompleted;
      },
      // Replace the default behaviour entirely
      code: function(X) {
        X.routeTo('editFlightInfo');
      }
    }
  ]
});
```

### `internalIsEnabled` / `internalIsAvailable`

`ComicsAction` adds two internal check functions that run in the context of the `DetailView` (not the data object), giving them access to `config`, `controllerMode`, and `auth`. The final enabled/available state is the AND of the internal check and any `isEnabled`/`isAvailable` declared on the override.

```javascript
internalIsEnabled: async function(config, data) {
  // `this` is DetailView; has access to this.auth, this.config, etc.
  if ( config.CRUDEnabledActionsAuth?.isEnabled ) {
    return this.auth.check(null, permissionString);
  }
  return true;
},
internalIsAvailable: function(config, controllerMode, data) {
  return controllerMode != 'EDIT' && config.editPredicate.f(data);
}
```

---

## Minimal Usage

```javascript
// Minimal — config auto-derived from the DAO's `of` class
tag({ class: 'foam.comics.v3.DAOController', data: myDAO })
```

```javascript
// Explicit config
tag({
  class: 'foam.comics.v3.DAOController',
  data: myDAO,
  config: foam.comics.v2.DAOControllerConfig.create({
    browseTitle: 'Contacts',
    tableColumns: ['name', 'email', 'active'],
    detailView: { class: 'foam.u2.detail.SectionedDetailView' }
  })
})
```

```javascript
// From a menu journal entry (menus.jrl)
p({
  "class":     "foam.core.menu.Menu",
  "id":        "contacts",
  "label":     "Contacts",
  "handler": {
    "class": "foam.core.menu.DAOMenu2",
    "config": {
      "class":    "foam.comics.v2.DAOControllerConfig",
      "daoKey":   "contactDAO",
      "browseTitle": "Contacts"
    }
  }
})
```

---

## Source Files

| File | Role |
|------|------|
| `src/foam/comics/v3/DAOController.js` | Top-level state machine |
| `src/foam/comics/v3/DAOView.js` | Browse micro-controller |
| `src/foam/comics/v3/CreateView.js` | Create micro-controller |
| `src/foam/comics/v3/DetailView.js` | View/Edit micro-controller |
| `src/foam/comics/v3/ComicsAction.js` | Per-model CRUD override hook |
| `src/foam/comics/v2/DAOControllerConfig.js` | Shared configuration object |
