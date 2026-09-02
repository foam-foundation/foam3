# Design Patterns in FOAM

FOAM is built on a small number of well-known design patterns applied consistently and pervasively. Understanding which pattern underlies a given FOAM concept makes it easier to predict behaviour, extend the framework, and recognise the structure of unfamiliar code.

## Strategy

The `Sink` interface (`put`, `remove`, `error`, `eof`) and the `MDAO` index interface are classic Strategy implementations — interchangeable algorithms behind a common interface. DAOs, parsers, Actions, and Views are also Strategies, but since they each qualify as a more specialised pattern, they appear under their own headings below.

## Proxy

`ProxyDAO` is a transparent proxy for the `DAO` interface. It delegates every method call to a `delegate` DAO, making it the natural superclass for any DAO Decorator: override only the methods you care about and let the rest pass through.

```javascript
foam.CLASS({
  name: 'TimestampDAO',
  extends: 'foam.dao.ProxyDAO',
  methods: [
    function put_(x, obj) {
      obj = obj.clone();
      obj.lastModified = new Date();
      return this.delegate.put_(x, obj);
    }
  ]
});
```

`ProxySink` and `ProxyListener` play the same role for `Sink` and `Listener` respectively.

## Decorator

DAO Decorators are the primary extension mechanism for data access. Each decorator wraps a delegate DAO and adds one focused capability:

| Decorator | Capability added |
|---|---|
| `SequenceNumberDAO` | Auto-increments a numeric id property |
| `GUIDDAO` / `FUIDDAO` | Assigns UUID ids |
| `CachingDAO` / `LRUDAOManager` | Transparent read cache with optional LRU eviction |
| `CascadingRemoveDAO` | Deletes related records when a parent is removed |
| `LoggingDAO` / `TimingDAO` / `PMDAO` | Observability — logging, timing, performance metrics |
| `ValidatingDAO` | Runs `obj.validate()` before every `put` |
| `ReadOnlyDAO` | Rejects `put` and `remove` calls |
| `ContextualizingDAO` | Re-contextualises returned objects into the calling context |
| `FreezingDAO` | Freezes returned objects so callers cannot mutate shared state |

Because each decorator has exactly one responsibility and they all share the `DAO` interface, they compose freely in any order and combination. `EasyDAO` (see Facade below) handles the composition automatically for the common cases.

## Bridge

The various `DAO` implementations are a Bridge: a common interface that makes fundamentally different storage technologies appear identical to application code.

| Implementation | Storage |
|---|---|
| `MDAO` | In-memory with pluggable indexes |
| `JDAO` / `F3FileJournal` | Append-only file journal |
| `IDBDAO` | Browser IndexedDB |
| `LocalStorageDAO` | Browser `localStorage` |
| `ClientDAO` | Remote server via HTTP/WebSocket |
| `RestDAO` | RESTful HTTP backend |
| `ArrayDAO` | Plain JavaScript array |

Application code that calls `dao.where(...).select()` does not know — and does not need to know — which implementation is underneath. Switching storage is a configuration change, not a code change.

## Observer / Observable

Every `FObject` is Observable. Property changes are published automatically on the object's topic hierarchy, and any subscriber receives them:

```javascript
var inv = Invoice.create({ amount: 100 });

// Subscribe to a specific property
inv.amount$.sub(function(e, _, __, newVal) {
  console.log('amount changed to', newVal);
});

// Subscribe to any property change
inv.sub('propertyChange', function(e, _, propName, slot) {
  console.log(propName, 'changed to', slot.get());
});

inv.amount = 200;  // fires both subscribers
```

DAOs are also Observable via `listen()` and `pipe()`, which deliver ongoing `put` and `remove` events to a `Sink` as the DAO's contents change.

FOAM's topic system extends the classic Observer pattern with a hierarchical topic namespace: a subscriber on `'propertyChange'` receives all property changes; a subscriber on `['propertyChange', 'amount']` receives only `amount` changes.

Observer is one of the most frequently needed patterns in application development — responding to property changes, updating views, reacting to DAO events. In FOAM it is elevated from a manually applied recipe to a first-class language construct: the `listeners` axiom. A Listener is a pre-bound method — `this` is always correct even when the method is passed as a callback, closing the impedance mismatch between GUI event callbacks and OO methods. Listeners also support `isMerged` (collapses rapid-fire calls into one, fired after a delay) and `isFramed` (fires at most once per animation frame), which are the two event-frequency problems that arise constantly in UI code and require boilerplate to solve without them.

Most developers encounter Observer daily. Elevating it to a language construct means the common case — subscribe to a property, update something — is a one-liner, and the friction cases (binding, coalescing, cleanup) are handled unconditionally by the framework rather than left to the developer to remember.

## Composite

DAOs, Views, and Parsers all implement the Composite pattern — a uniform interface that works identically whether the instance is a leaf or a composition of other instances.

A `CompositeJournal`, for example, fans writes out to multiple underlying journals and fans reads back in, while presenting the identical `Journal` interface. Parser combinators like `seq` and `alt` compose primitive parsers into arbitrarily deep trees, all implementing the same `parse` interface.

## Interpreter

The Interpreter pattern is a specialisation of Composite. MLang predicates and expressions are a textbook implementation: each class in the tree (`EQ`, `AND`, `GT`, `SUM`, `GROUP_BY`, …) is a node that knows how to evaluate itself, and composite nodes evaluate their children recursively.

```javascript
// An MLang expression tree — each node is an Interpreter
M.AND(
  M.EQ(Invoice.STATUS, InvoiceStatus.OPEN),
  M.GT(Invoice.AMOUNT, 0),
  M.LT(Invoice.DUE_DATE, new Date())
)
```

The same tree is interpreted differently depending on context: in-memory evaluation against an `MDAO`, SQL `WHERE` clause generation in a `JDBCDAO`, or serialisation to JSON for transmission through a `ClientDAO`. Adding a new DAO backend means implementing one new interpreter for the existing predicate tree — existing predicates and existing application code change nothing.

## Command

Actions are a direct implementation of the Command pattern. An `Action` bundles an operation with its metadata — label, availability predicate, enabled predicate — and decouples the invoker (a button, a menu item, a keyboard shortcut) from the operation itself.

```javascript
actions: [
  {
    name: 'submit',
    label: 'Submit Invoice',
    isAvailable: function(paid) { return ! paid; },
    isEnabled:   function(amount) { return amount > 0; },
    code: function(X) { X.invoiceDAO.put(this); }
  }
]
```

Views render Actions as buttons automatically, and the availability and enabled state track the model reactively without any wiring code.

Command is another pattern that arises in almost every application with a user interface — any operation a user can trigger needs a label, enable/disable logic, visibility logic, and some form of invocation. In FOAM it is elevated from a manually applied recipe to a first-class language construct: the `actions` axiom. The declaration replaces a button element, an `onClick` handler, manual state toggling, a confirmation dialog, a running guard that prevents duplicate submissions while an async operation is in progress, permission checks, keyboard shortcuts, icons, tooltips, and accessibility labels — all of which the pattern requires but which developers routinely implement incompletely or inconsistently when working without framework support.

Most other design patterns — Flyweight, Interpreter, Chain of Responsibility, Memento — are genuinely useful but situational. A developer might go years without needing them. Observer and Command arise every day in any application that has a UI. Elevating precisely those two to language constructs, while leaving the rest as patterns to apply manually when needed, reflects an accurate judgement about where framework investment pays the highest return.

## Factory

The `create()` method on every FOAM class is a factory method. It accepts an optional property-value map and an optional context, and produces a correctly initialised instance with all property factories, expressions, and listeners wired up:

```javascript
var inv = Invoice.create({ amount: 100 }, X);
```

The factory is also the mechanism through which the context system provides substitutability: `this.Invoice.create()` (via `requires`) routes through the context, so the actual class created can be replaced — for testing, for platform-specific subclasses, or for multiton management — without changing the calling code.

## NullObject

`NullDAO` is a NullObject implementation of the `DAO` interface. It stores nothing and does nothing — `put` returns the object unchanged, `find` returns `null`, `select` returns immediately with an empty result. It is useful as a placeholder, a default, or a test double where no storage is needed.

## Flyweight

`MDAO` indexes are Flyweights. The index tree shares structural nodes across queries, giving the polymorphism benefits of object-oriented design without the overhead of allocating a full object for every node in the tree. Index nodes are small, immutable value objects that are freely shared rather than cloned.

## Facade

`EasyDAO` is a textbook Facade. It hides the complexity of assembling a decorated DAO stack — sequence number assignment, journalling, caching, authorisation, performance monitoring — behind a single fluent builder:

```javascript
foam.dao.EasyDAO.Builder(x)
  .setOf(Invoice.getOwnClassInfo())
  .setSeqNo(true)
  .setJournal(true)
  .setCache(true)
  .setAuthorize(true)
  .setPm(true)
  .build()
```

The resulting DAO is a composed stack of decorators. `EasyDAO` handles the ordering constraints and compatibility rules between them; the caller deals with intent, not implementation.

## Builder

The Builder pattern is used to construct complex or composite objects from a specification. This is exactly how FOAM constructs JavaScript prototypes at runtime: the `foam.CLASS({...})` declaration is the specification, and the framework's bootstrapping machinery assembles the prototype, installs axioms, generates getters and setters, and wires reactive slots from it.

`EasyDAO.Builder` (above) is a more conventional Builder, accumulating configuration through setter calls before `build()` produces the final composite object.

## Prototype

JavaScript is a prototype-based language, and FOAM works with that rather than fighting it. Every `foam.CLASS({...})` declaration produces a JavaScript prototype — an object that is the shared parent of all instances of that class. Instances are created with `create()`, which delegates to `Object.create(proto)` and then applies property initialisers.

Any modelled object can serve as a prototype for a copy via `clone()`:

```javascript
var template = Invoice.create({ status: InvoiceStatus.DRAFT, currency: 'USD' });
var newInvoice = template.clone();   // starts from template's values
```

The runtime class of any FOAM object is accessible via `obj.cls_`, which gives the full class reference including its axioms, properties, and methods — enabling the reflection-driven generic views and serialisers described in the [Key FOAM Concepts](Concepts.md) guide.

## MVC at Three Levels

FOAM is an MVC framework, and almost everything in it relates to Model, View, or Controller — but unusually, FOAM applies the pattern at three distinct levels simultaneously.

**Collections of objects.** A DAO is the Model for a collection. `DAOBrowserView` (and its controller `DAOController`) provides search, browse, create, edit, and delete for any DAO. Swap the DAO and the entire interface changes with it.

**Individual objects.** A modelled object is an Observable Model for a single entity. `DetailView` presents one object's properties for viewing or editing, automatically reflecting the model's property definitions. Because objects publish property-change events, any number of Views can stay synchronised with the same object without explicit wiring.

**Individual properties.** Each property implements the slot interface, making it the Model for a single field. `TextField`, `DateView`, `ChoiceView`, and every other single-field view bind to a property slot directly. The property's type, constraints, and metadata drive the view's behaviour without any per-field controller code.

This three-level application of MVC is what allows FOAM's generic views to work at any granularity — from a single currency field to a full multi-tab DAO browser — with no bespoke controller code at any level.

> **The four meanings of "Model" in FOAM.** Because FOAM is simultaneously an MVC framework and a modelling framework, the word "Model" is legitimately overloaded — and all four meanings are coherent:
>
> 1. **MVC Model** — any FObject used as the `data` of a View; the thing being observed and displayed. An `Invoice` instance is a Model in this sense when passed to a `DetailView`.
> 2. **Class declaration** — the object produced by `foam.CLASS({...})`; a runtime `foam.lang.Model` instance that describes a class's structure: its properties, methods, actions, and axioms.
> 3. **Domain object / instance** — a concrete object created by `Invoice.create()`; a modelled entity in the application domain. This is what most developers mean by "a model" in everyday speech.
> 4. **The meta-model** — `foam.lang.Model` itself: the FOAM class that describes all other class declarations. It is simultaneously a class declaration (sense 2) and a domain object (sense 3), and is described by itself — the meta-circular point from the [Meta-Circular](Concepts.md#meta-circular) section.
>
> Senses 2, 3, and 4 collapse cleanly: every class declaration is a domain object that is an instance of `foam.lang.Model`, which is itself described by a class declaration. The MVC sense (1) is orthogonal — any of the others can serve as an MVC Model simply by being passed as `data` to a View.
