# FOAM for LLMs

> FOAM (Feature-Oriented Active Modeller) is a model-driven, cross-platform application framework for JavaScript, Java, and Swift. Everything is a model. Everything is composable. Code is a liability; declarations are assets.

---

## 1. Why FOAM Works — Design Philosophy

Many model-driven frameworks have been attempted. Most collapse under their own weight. Understanding why FOAM is different shapes how you should write FOAM code.

**Code is a liability, not an asset.** The asset is the *feature*. Code is the maintenance burden you pay to have the feature. FOAM's goal is to minimise that burden by generating as much code as possible at build or runtime — code that is never edited and never checked in. When you find yourself writing boilerplate in FOAM, that is a signal that something should be declared or generated instead.

**Generated code is never edited.** Classic code generators produced a starting point that developers would then modify — which meant the generator and the code immediately diverged. FOAM avoids this entirely. Model definitions are the source of truth; everything derived from them is regenerated. This is the only way the model stays authoritative.

**Good design still matters.** FOAM typically generates 80–98% of the code for a feature, but the remaining few percent — custom validation, method bodies, pre/post setters — is real code embedded in the model. This code benefits from the same design discipline as any other code. FOAM uses design patterns (Decorator, Strategy, Template Method, Chain of Responsibility) precisely because they allow generated components to be extended *externally* without modifying them.

**Fine-grained components, composed by context.** Rather than generating large monolithic outputs, FOAM generates many small components and relies on context and facades (`EasyDAO` being the canonical example) to compose them. This is the Lego vs. diecast distinction: you get recomposability by default rather than having to earn it through refactoring.

**Augment, don't replace the target language.** FOAM does not try to model 100% of everything. Custom logic lives inside the model as embedded code (`javaCode:`, `code:`, `postSet:`, `validateObj:`). The model and the target language work together — FOAM calls this an "inverted internal DSL": your code is embedded in the DSL, not the other way around.

**Active Models — retained at runtime.** FOAM objects keep a reference to their class at runtime (`obj.cls_`). This makes generic, data-driven programming possible: a `DetailView`, a `TableView`, JSON serialisation, XML export, and DAO adapters all work on *any* FOAM object without knowing its type in advance, because they can reflect on its model. This is the primary alternative to code generation — and FOAM supports both.

**The model is itself modelled.** FOAM's meta-model is a FOAM model. `Model.cls_ === Model`. This self-referential bootstrapping is why FOAM is so small and uniform — the same machinery that models your `Invoice` class also models FOAM's own `Property`, `Method`, and `Axiom` classes. Meta-programming becomes regular programming.

**Models are first-class data.** Because models are themselves modelled FObjects, you can store them in DAOs, query them with MLang, send them across a network, display them in views, and refactor them with the same tools you use on application data. A refactoring tool is just an MLang query on a DAO of models.

**A small set of strong canonical interfaces.** Most of what a FOAM developer does is implement, decorate, or compose a small fixed vocabulary: `DAO`, `View`, `Sink`, `Predicate`, `Comparator`, `Action`, `Parser`, `Agent`, `Validator`, `Authenticator`. More implementations behind fewer interfaces — this is what keeps the system coherent as it grows.

---

## 2. The Core Mental Model



FOAM replaces the conventional "write implementation code" approach with "declare what things are." The framework generates getters, setters, validation, serialization, UI, storage, and reactive bindings from declarations.

**Key principle:** When you see a FOAM class, read it as a *specification* of intent, not an implementation. The framework handles the "how."

---

## 2. Defining a Class

```javascript
foam.CLASS({
  package: 'com.example',
  name:    'Invoice',
  extends: 'foam.nanos.fo.FObject',   // optional; FObject is the default root

  documentation: 'Represents a customer invoice.',

  requires: [
    'com.example.LineItem',           // makes this.LineItem available; provides creation context
    'com.example.Status as InvStatus' // aliased with `as`
  ],

  imports: [
    'invoiceDAO',                     // pulled from the context (X) into this.invoiceDAO
    'currentUser?'                    // optional import; no warning if absent
  ],

  exports: [
    'invoiceId as activeInvoiceId'    // publishes to sub-context so children can import it
  ],

  constants: {
    MAX_LINE_ITEMS: 100
  },

  properties: [ /* see Section 3 */ ],
  methods:    [ /* see Section 4 */ ],
  listeners:  [ /* see Section 5 */ ],
  actions:    [ /* see Section 6 */ ],
  topics:     [ 'submitted', 'cancelled' ]  // pub/sub event declarations
});
```

**Lookup / creation:**
```javascript
// By fully-qualified name
var cls = foam.lookup('com.example.Invoice');

// Creation (args are initial property values)
var inv = com.example.Invoice.create({ amount: 100 });

// Creation in a context Y
var inv = com.example.Invoice.create({ amount: 100 }, Y);

// JSON notation — equivalent to the above
var inv = foam.json.parse({ class: 'com.example.Invoice', amount: 100 });
```

---

## 3. Properties

Properties are the primary unit of data. They are declarative axioms with rich metadata.

```javascript
properties: [
  // Short-form (class defaults to 'FObject' slot, no type coercion)
  'name',

  // Typed short-form
  { class: 'String',  name: 'email' },
  { class: 'Int',     name: 'quantity', value: 1 },       // value = default
  { class: 'Float',   name: 'price' },
  { class: 'Boolean', name: 'paid', value: false },
  { class: 'Date',    name: 'dueDate' },
  { class: 'Array',   name: 'tags' },
  { class: 'Map',     name: 'metadata' },
  { class: 'EMail',   name: 'contactEmail' },
  { class: 'URL',     name: 'documentUrl' },
  { class: 'Long',    name: 'externalId' },

  // FObject reference
  { class: 'FObjectProperty', of: 'com.example.Address', name: 'billingAddress' },

  // Array of FObjects
  { class: 'FObjectArray', of: 'com.example.LineItem', name: 'lineItems' },

  // Reference to another model by ID (foreign key)
  { class: 'Reference', of: 'com.example.Customer', name: 'customerId' },

  // Computed / derived (recalculates when dependencies change)
  {
    class: 'Float',
    name: 'total',
    expression: function(lineItems) {    // arg names ARE the dependency names
      return lineItems.reduce((s, li) => s + li.price * li.qty, 0);
    }
  },

  // Lazy-initialized
  {
    name: 'helper',
    factory: function() { return this.SomeHelper.create(); }
  },

  // More specific types with built-in format validation
  { class: 'EMail',       name: 'email' },
  { class: 'Password',    name: 'password' },
  { class: 'PhoneNumber', name: 'phone' },
  { class: 'URL',         name: 'documentUrl' },
  { class: 'Website',     name: 'homepage' },
  { class: 'Currency',    name: 'amount', units: 'USD' },
  { class: 'StringArray', name: 'tags' },

  // Built-in constraints (automatically validated and shown in GUI)
  {
    class: 'String',
    name: 'code',
    required: true,
    minLength: 3,
    maxLength: 10
  },
  {
    class: 'Int',
    name: 'quantity',
    min: 1,
    max: 999
  },

  // JS-only inline validation (returns error string or nothing)
  {
    class: 'String',
    name: 'invoiceNumber',
    documentation: 'Must match format INV-XXXXXX.',
    required: true,
    validateObj: function(invoiceNumber) {
      if ( !/^INV-\d{6}$/.test(invoiceNumber) )
        return 'Invoice number must match format INV-XXXXXX';
    }
  },

  // Cross-platform validation using FScript predicates
  {
    class: 'Int',
    name: 'age',
    validationPredicates: [
      {
        query: 'age>=18&&age<=120',
        errorString: 'Age must be between 18 and 120.'
      }
    ]
  },

  // Cross-property validation lives on a separate property (or in validateObj of any property)
  // Use validateObj that references other properties via the argument list:
  {
    class: 'Date',
    name: 'endDate',
    validateObj: function(endDate, startDate) {
      if ( foam.Date.compare(endDate, startDate) < 0 )
        return 'End date cannot be before start date.';
    }
  },

  // With visibility and documentation
  {
    class: 'String',
    name: 'notes',
    label: 'Internal Notes',
    documentation: 'Visible only to staff.',
    visibility: 'HIDDEN'              // or 'RO', 'RW', 'FINAL'
  },

  // Java-specific
  {
    class: 'String',
    name: 'token',
    javaFactory: 'return java.util.UUID.randomUUID().toString();',
    javaTransient: true
  }
]
```

**Key validation rules:**
- `required: true` — property must be non-empty; enforced in GUI and on `validate()`
- `min` / `max` — numeric bounds
- `minLength` / `maxLength` — string length bounds
- `validateObj` — JS-only; argument names are dependencies (same as `expression`); return an error string or nothing
- `validationPredicates` — cross-platform FScript predicates; use `thisValue` or property name in `query`; requires `errorString` or `errorMessage` (i18n key)
- All constraints surface automatically in FOAM's detail views as inline error messages
- `obj.errors_` is a reactive property containing the current array of `[property, errorString]` pairs

**Accessing properties at runtime:**
```javascript
inv.amount          // getter
inv.amount = 200    // setter (fires property change event)
inv.amount$.sub(function(e, _, __, newVal) { ... })  // subscribe to changes
inv.slot('amount')  // returns a Slot (reactive reference)
```

**Property constants** are copied onto both class and instance:
```javascript
Invoice.AMOUNT      // the Property axiom object
inv.AMOUNT.name     // 'amount'
```

---

## 4. Methods

```javascript
methods: [
  function init() {
    // Called on create(). Call this.SUPER() to chain.
    this.SUPER();
    this.validate();
  },

  function validate() {
    if ( this.amount < 0 ) throw new Error('Amount must be non-negative');
  },

  {
    name: 'toCSV',
    documentation: 'Returns a CSV row for this invoice.',
    code: function() {
      return `${this.id},${this.amount},${this.dueDate}`;
    }
  },

  // Java implementation alongside JS
  {
    name: 'generateToken',
    type: 'String',
    javaCode: `return java.util.UUID.randomUUID().toString();`
  }
]
```

Use `this.SUPER()` for inheritance calls. Methods are normal prototype methods — call them as `obj.methodName()`.

---

## 5. Listeners

Listeners are **pre-bound** methods. Unlike regular methods, they always keep their `this` even when passed as callbacks. Use them wherever you would pass a function reference (DOM events, DAO subscriptions, timers, etc.).

```javascript
listeners: [
  function onAmountChange(e, source, prop, newVal) {
    console.log('New amount:', newVal);
  },

  // Merged: multiple rapid calls collapse into one, fired after `mergeDelay` ms
  {
    name: 'onResize',
    isMerged: true,
    mergeDelay: 100,  // ms; default 16
    code: function() { this.relayout(); }
  },

  // Framed: fires at most once per animation frame
  {
    name: 'onDataChange',
    isFramed: true,
    code: function() { this.repaint(); }
  }
]
```

**Subscribing a listener to a property change:**
```javascript
this.amount$.sub(this.onAmountChange);
```

---

## 6. Actions

Actions are methods with GUI metadata — label, availability, enablement. Views automatically render them as buttons.

```javascript
actions: [
  {
    name: 'submit',
    label: 'Submit Invoice',
    isAvailable: function(paid) { return !paid; },   // hides when paid
    isEnabled:   function(amount) { return amount > 0; },
    code: function(X) {
      this.pub('submitted');
      X.invoiceDAO.put(this);
    }
  }
]
```

---

## 7. Context (X)

The context (`X`) is FOAM's dependency-injection container — an immutable (but sub-contextable) key-value map.

```javascript
// Create a context
var Y = foam.createSubContext({
  invoiceDAO: myDAO,
  currentUser: user
});

// Create an object within that context
var inv = Invoice.create({}, Y);
// inv.invoiceDAO === myDAO  (via import)

// Objects can create sub-contexts for their children
var subY = Y.createSubContext({ theme: 'dark' });
```

The standard top-level context is `foam.__context__`. Each object's context is at `obj.__context__` (or `obj.x` if it imports `'x'`). Children created via `requires` automatically receive the parent's context.

---

## 8. DAOs (Data Access Objects)

A DAO is FOAM's universal storage interface. The same query API works against in-memory, REST, JDBC, IndexedDB, or any custom backend. DAOs are composable: wrap one DAO with another to transparently add caching, authorisation, logging, or sequence number assignment. The caller never knows what's underneath.

### Making a Class Storable

To store objects in a DAO, FOAM needs to know the primary key. Name your key property `id`, or declare it explicitly:

```javascript
foam.CLASS({
  name: 'OrderLine',
  ids: [ 'orderId', 'lineNumber' ],  // multi-part primary key
  properties: [ 'orderId', 'lineNumber', 'product', 'quantity' ]
});
```

If you don't want to manage IDs yourself, use `foam.dao.EasyDAO` with `seqNo: true` and IDs will be assigned automatically.

### The DAO Interface

#### JavaScript

```javascript
interface DAO {
  Promise<FObject>  put(FObject obj)               // insert or update; returns stored object
  Promise<FObject>  find(Object id)                // retrieve by id; returns null if not found
  Promise<FObject>  remove(FObject obj)            // delete; not an error if not found
  Promise<Sink>     select(Sink sink)              // retrieve matching objects into sink
  Promise           removeAll()                    // delete all matching objects
  Detachable        listen(Sink sink)              // receive ongoing changes; detach to stop
  void              pipe(Sink sink)                // select() then listen()
  Object            cmd(Object obj)                // send a command to the DAO (advanced)

  DAO               where(Predicate predicate)     // filter results
  DAO               orderBy(Comparator comparator) // sort results
  DAO               limit(Long count)              // cap result count
  DAO               skip(Long count)               // skip first N results
  DAO               inX(Context x)                 // return DAO running in a different context
}
```

#### Java

```java
public interface DAO {
  // Single-object operations
  FObject put(FObject obj);
  FObject find(Object id);
  FObject remove(FObject obj);

  // Collection operations
  Sink select(Sink sink);
  void removeAll();
  void listen(Sink sink, Predicate predicate);
  void pipe(Sink sink);

  // Filtering (returns a new DAO)
  DAO where(Predicate predicate);
  DAO orderBy(Comparator comparator);
  DAO skip(long count);
  DAO limit(long count);
  DAO inX(X x);

  // Escape hatch
  Object cmd(Object obj);

  // Introspection
  ClassInfo getOf();
}
```

### Single-Object Operations

```javascript
// Put — insert or update; returns the stored object (may differ from input, e.g. auto-assigned id)
var recipe = Recipe.create({ name: 'Pancakes' });
recipe = await dao.put(recipe);
console.log(recipe.id);  // now set by the DAO

// Find — returns null if not found (does not throw)
var recipe = await dao.find(42);
if ( recipe === null ) console.log('not found');

// Find with multi-part key
var line = await dao.find([orderId, lineNumber]);

// Remove — not an error if object doesn't exist
await dao.remove(recipe);
```

### Filtering Methods

The filtering methods (`where`, `orderBy`, `limit`, `skip`) return a new DAO that wraps the original. They don't execute anything — they just narrow the scope of the next `select` or `removeAll`:

```javascript
var sink = await dao
  .where(M.EQ(Invoice.PAID, false))
  .orderBy(M.DESC(Invoice.DUE_DATE))
  .skip(40)
  .limit(20)
  .select();

var results = sink.array;
```

**Important:** filtering methods only affect `select` and `removeAll`. They have no effect on `find`, `put`, or `remove`.

### select() and Sinks

`select(sink)` calls `sink.put(obj)` for each matching object, then `sink.eof()` when done, and resolves the returned promise with the same sink. If no sink is provided, an `ArraySink` is used by default.

#### The Sink Interface

```javascript
void put(obj, sub)     // called for each object
void eof()             // called when the stream ends normally
void remove(obj, sub)  // called for each removed object (listen() only)
void reset(sub)        // called when the result set may have changed (listen() only)
```

The `sub` argument is a `Detachable`. Call `sub.detach()` to stop receiving further objects without waiting for `eof()`.

#### Common Sinks

| Sink | Purpose | Result property |
|---|---|---|
| `ArraySink` | Collects all objects into an array | `.array` |
| `COUNT()` | Counts matching objects | `.value` |
| `SUM(prop)` | Sums a numeric property | `.value` |
| `MAX(prop)` | Finds the maximum value | `.value` |
| `MIN(prop)` | Finds the minimum value | `.value` |
| `GROUP_BY(prop, sink)` | Groups results by property value | `.groups` |
| `MAP(prop)` | Projects a single property from each object | `.array` |

#### Examples

```javascript
// Collect all results
var sink = await dao.select();
console.log(sink.array);

// Count
var count = await dao.select(M.COUNT());
console.log(count.value);

// Sum a property
var total = await dao.select(M.SUM(Invoice.AMOUNT));
console.log(total.value);

// Group by status
var groups = await dao.select(M.GROUP_BY(Invoice.STATUS, M.COUNT()));
console.log(groups.groups);

// Inline sink — function called for each object
await dao.select(function(obj) {
  console.log('Got:', obj.name);
});
```

### listen()

`listen(sink)` is like `select()` but keeps running. After delivering current contents via `put()`, it continues to call `sink.put()` for new objects, `sink.remove()` for deleted ones, and `sink.reset()` when the result set may have changed in bulk.

```javascript
dao.listen({
  put:    function(obj) { console.log('added or updated:', obj); },
  remove: function(obj) { console.log('removed:', obj); },
  reset:  function()    { console.log('reload everything'); }
});
```

Call `sub.detach()` inside any callback to stop listening.

### removeAll()

Works like `select()` but removes matching objects. Use filtering first — a bare `dao.removeAll()` deletes everything:

```javascript
await dao.where(M.EQ(Todo.IS_COMPLETED, true)).removeAll();
```

### Error Handling

DAO operations reject on failure. Errors fall into two categories:

| Exception | Meaning |
|---|---|
| `foam.dao.InternalException` | Transient — may be retried |
| `foam.dao.ExternalException` | Permanent — cannot succeed |

Note that `find()` returns `null` for a missing object rather than throwing — an exception means a genuine backend failure.

### inX(x)

Returns a new DAO that runs all operations in the provided context `x`. Useful for impersonating a user, switching sessions, or overriding context-provided services:

```javascript
var scopedDAO = dao.inX(otherContext);
var results = await scopedDAO.select();
```

Note that `inX` is unrelated to the `IN` mlang predicate used in queries.

### MLang — the query language

```javascript
var M = foam.mlang.ExpressionsSingleton.create();

// Comparisons
M.EQ(Invoice.AMOUNT, 100)
M.NEQ(Invoice.STATUS, 'DRAFT')
M.GT(Invoice.AMOUNT, 50)
M.GTE(Invoice.AMOUNT, 50)
M.LT(Invoice.DUE_DATE, new Date())
M.LTE(Invoice.AMOUNT, 1000)

// Membership
M.IN(Invoice.STATUS, ['OPEN','OVERDUE'])

// String matching
M.CONTAINS(Invoice.NOTES, 'urgent')
M.CONTAINS_IC(Invoice.NOTES, 'urgent')  // case-insensitive
M.STARTS_WITH(Invoice.EMAIL, 'admin')

// Logical
M.AND(M.EQ(Invoice.PAID, false), M.GT(Invoice.AMOUNT, 0))
M.OR(pred1, pred2)
M.NOT(M.EQ(Invoice.STATUS, 'DRAFT'))

// Ordering
M.DESC(Invoice.DUE_DATE)
dao.orderBy(M.DESC(Invoice.RANK), Invoice.LAST_NAME)  // compound
```

Predicates can be serialized to JSON and sent over the wire — this is how ClientDAO works.

### Common DAO Types

| Class | Purpose |
|---|---|
| `foam.dao.MDAO` | In-memory, with pluggable indexes |
| `foam.dao.EasyDAO` | Configures journal, cache, sequence, etc. with one declaration |
| `foam.dao.JDAO` | Journal (file-based persistence) wrapping another DAO |
| `foam.dao.CachingDAO` | Read cache over a slower delegate |
| `foam.dao.ClientDAO` | Proxies over the network to a server-side DAO |
| `foam.dao.LRUCachingDAO` | Bounded cache with LRU eviction |
| `foam.dao.ProxyDAO` | Base class for decorating DAOs |

### A Note on Abstraction

Nothing above says anything about *where* the data is stored. That is intentional. The same code works whether the DAO is backed by an in-memory `MDAO`, a journalled `JDAO`, a `JDBCDAO` connected to PostgreSQL, or a `ClientDAO` talking to a remote server.

The DAO interface is the complete contract. Code that depends on knowing the underlying storage mechanism forfeits the caching, authorisation, audit logging, and other layers that FOAM composes transparently above any DAO.

---

## 9. Inheritance and Mixins

```javascript
foam.CLASS({
  name: 'PremiumInvoice',
  extends: 'com.example.Invoice',   // single inheritance
  mixins:  ['foam.nanos.auth.Authorizable'], // copies axioms directly

  properties: [
    { class: 'Float', name: 'discountRate', value: 0.1 }
  ]
});
```

`implements` is like `mixins` but with proper method override semantics (override handling via `SUPER`). `mixins` does a direct axiom copy.

---

## 10. Pub/Sub

Every FObject has built-in pub/sub through a topic hierarchy.

```javascript
// Publish
obj.pub('myTopic', 'subTopic', data);

// Subscribe
var sub = obj.sub('myTopic', function(sub, topic, ...args) {
  console.log(args);
});

// Property changes are published automatically:
// obj.pub('propertyChange', 'amount', slot)
obj.sub('propertyChange', 'amount', handler);

// Unsubscribe
sub.detach();
```

---

## 11. Relationships

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.example.Customer',
  targetModel: 'com.example.Invoice',
  forwardName: 'invoices',    // Customer gets: customer.invoices → DAO
  inverseName: 'customer',    // Invoice gets: invoice.customerId (FK)
  cardinality: '1:*'
});
```

After declaration, `customer.invoices` is a DAO pre-filtered to that customer's invoices.

---

## 12. Enums

```javascript
foam.ENUM({
  package: 'com.example',
  name: 'InvoiceStatus',
  values: [
    { name: 'DRAFT',    label: 'Draft',    ordinal: 0 },
    { name: 'OPEN',     label: 'Open',     ordinal: 1 },
    { name: 'PAID',     label: 'Paid',     ordinal: 2 },
    { name: 'OVERDUE',  label: 'Overdue',  ordinal: 3 }
  ]
});

// Usage
invoice.status = com.example.InvoiceStatus.OPEN;
invoice.status.label    // 'Open'
invoice.status.ordinal  // 1
```

---

## 13. Interfaces

```javascript
foam.INTERFACE({
  package: 'com.example',
  name: 'Exportable',
  methods: [
    { name: 'toCSV',  type: 'String' },
    { name: 'toPDF',  type: 'String' }
  ]
});

foam.CLASS({
  name: 'Invoice',
  implements: ['com.example.Exportable'],
  methods: [
    function toCSV() { ... },
    function toPDF() { ... }
  ]
});
```

---

## 14. Important Patterns

### Check before accessing sub-context values
Use optional imports (`'myService?'`) when a service might not always be present.

### Prefer `expression` over `factory` for computed values
`expression` declares dependencies and auto-invalidates. `factory` only runs once.

### Use `requires` instead of direct class references
`this.Invoice.create()` uses the context; `com.example.Invoice.create()` bypasses it. Replacements, singletons, and multitons only work through `requires`.

### DAOs are composable pipelines
Chain `.where()`, `.orderBy()`, `.skip()`, `.limit()` before `.select()` — each returns a new decorated DAO, nothing executes until `select()`/`find()`/`put()`.

### `detach()` for cleanup
Subscriptions and child objects implement `Detachable`. Call `.detach()` to unsubscribe and free resources. Objects call `detach()` on all their sub-subscriptions when they are themselves detached.

### Late binding via context
When you call `this.SomeClass.create()`, the actual class may have been replaced in the context. This is intentional — it enables mocking, decoration, and platform-specific implementations transparently.

---

---

## 15. Why FOAM Maps Naturally to Natural Language

FOAM's declarative structure has an unusually small gap between how humans describe systems and how they're encoded. This is especially important when working with LLMs.

**Human:** "I need a User with email, password, and a way to check if they're an admin."

**FOAM:**
```javascript
foam.CLASS({
  name: 'User',
  properties: [
    { class: 'EMail',    name: 'email',    required: true },
    { class: 'Password', name: 'password', required: true },
    { class: 'Enum',     name: 'role',     of: 'UserRole' }
  ],
  methods: [
    function isAdmin() { return this.role === UserRole.ADMIN; }
  ]
});
```

Things the LLM does *not* need to generate: getters, setters, change notification, validation wiring, serialization, GUI components, or storage adapters. The framework provides all of them from the declaration above. This makes FOAM unusually well-suited to LLM-driven development — describe intent, receive a working specification.

---

## 16. Quick Reference: Common Mistakes to Avoid

| Wrong | Right |
|---|---|
| `new Invoice()` | `Invoice.create()` |
| `invoice.amount()` | `invoice.amount` (properties are not methods) |
| Direct class reference in `requires` | Use `this.ClassName.create()` after requiring |
| Mutating array property directly | Replace: `this.items = [...this.items, newItem]` |
| `async init()` | FOAM `init()` is synchronous; do async work in an `expression` or separate method |
| Forgetting to `detach()` listeners | Causes memory leaks; attach subs to `this.onDetach(sub)` |

---

## 16. POM — Project Object Model

A POM file (`pom.js`) is the build and project configuration for a FOAM application. It declares what source files to include, which platforms to target, sub-projects to pull in, Java dependencies, and JS libraries — for both web/Node.js JavaScript builds and server-side Java compilation.

### Basic Structure

```javascript
foam.POM({
  name:     "myapp",
  vendorId: "com.example",    // Maven groupId; defaults to name if omitted
  version:  "1.0.0",

  projects: [
    { name: "foam3/src/foam/pom" },          // FOAM core
    { name: "myapp/src/somepackage/pom" }    // sub-projects loaded before files
  ],

  files: [
    { name: "com.example.MyModel",  flags: "js|java" },
    { name: "com.example.MyView",   flags: "js" },
    { name: "com.example.MyServer", flags: "java" }
  ],

  javaDependencies: [
    "commons-net:commons-net:3.6"
  ]
});
```

### flags — Controlling What Gets Included

Every file or project entry can carry a `flags` expression that determines when it is included. This is how platform-specific code is handled — not inside the class files themselves, but at the build/load level.

```javascript
flags: "java"           // include only when building for Java
flags: "js"             // include only for JavaScript
flags: "web"            // include for web (browser) builds
flags: "node"           // include for Node.js builds
flags: "js|java"        // include for either JS or Java
flags: "web&debug"      // include only for web debug builds
flags: "java|web&debug" // & binds tighter than |
```

Default flag values (can be overridden):
```
dev: true, debug: true, java: false, js: true,
node: false, swift: false, web: true
```

Flags can be set at build time via `pmake -flags=web,java`, in a `<script>` tag: `src="foam.js" flags="u3,-debug"`, or in the URL: `?u3=true&debug=false`.

The top-level POM's `setFlags` overrides any defaults set in sub-POMs:
```javascript
setFlags: { u3: true, sql: false }
```

### Loading Stages

For web apps, source files can be split into loading stages to improve startup time. Stage 0 loads first and should contain only what's needed for the initial screen:

```javascript
defaultStage: 0,
stages: {
  1: ["foam3/src/foam/graphics/CView", "foam3/src/foam/u2/AllViews"],
  2: ["foam3/src/foam/lang/debug"]
}
```

Files not mentioned in `stages` go to `defaultStage`. The output files are named `foam-bin-{version}.js`, `foam-bin-{version}-1.js`, etc.

### JS Libraries

External JS libraries can be declared in the POM or, preferably, via `JsLib` axioms on the classes that use them (which defers loading until the component is first created):

```javascript
// In a POM (loads eagerly):
JSLibs: [
  { name: 'https://cdn.example.com/chart.js', defer: true }
]

// On a class (loads only when component is instantiated — preferred):
axioms: [
  foam.u2.JsLib.create({ src: 'https://cdn.example.com/chart.js' })
]
```

### Key Points for Code Generation

- **Platform targeting lives in the POM, not in class files.** Classes do not need `flags:` sections to conditionally include Java or JavaScript code — the POM's file entries handle inclusion. Java-specific method bodies use `javaCode:` and JS bodies use `code:` within the same class definition; the build knows which to compile.
- **Sub-projects are loaded before the parent's `files:`** entries. To control load order, split files across sub-projects.
- **`predicate:`** can replace `flags:` for complex conditional logic that `&`/`|` can't express.

---

## 17. U2/U3 — The View Layer

### Mental Model

U2 (and its successor U3) is a virtual/wrapped DOM library that replaces direct browser DOM manipulation. It provides:

- A **fluent internal DSL** for building HTML — no templates, no compiler step, just JavaScript method chains
- **Reactive/declarative data binding** — content, attributes, classes, and visibility are *slotted*, not imperatively updated
- **Scoped CSS** — each component owns its styles; no global namespace collisions
- **Security** — user input can never be injected as raw HTML; the library blocks XSS by construction and works under a strict CSP

U3 is smaller and faster than U2 (wrapped real DOM vs. virtual DOM), but U2 is what all existing code uses. Most patterns are identical between them.

### Building DOM — `start()` / `end()` / `add()`

```javascript
// start('tag')...end() === <tag>...</tag>
// start() alone defaults to <div>
this.start('ul')
  .start('li').add('Item 1').end()
  .start('li').add('Item 2').end()
.end()

// tag() is shorthand for start().end() with no children
this.tag('br');
this.tag('img', { src: this.imgUrl$ });  // slotted attribute

// add() accepts strings, numbers, slots, arrays, promises, toE()-able objects
this.add('Hello ', this.user.firstName$);  // updates reactively
```

`start(spec, args, slot)` takes a **ViewSpec** as its first argument, which can be a tag name string, a class, a JSON object `{class:'...'}`, a slot returning a ViewSpec, or any object with `create()` or `toE()`.

### Elements, Views, and Controllers

| Type | Description | Example |
|---|---|---|
| **Element** | Any U2 HTML element | `foam.u2.Element` |
| **View** | Element with a `data` property | `TextField`, `DateView`, `TableView` |
| **Controller** | Element that is its own `data` | `DAOBrowserView`, `FObjectView` |

Views bind to data via their `data` property. Controllers export themselves as `data` to their children via context.

### Reactive Slots — The Core Mechanism

Everything visual can be driven by a slot:

```javascript
// Four levels of adding a property to the DOM:
this.add(this.firstName);          // static current value — never updates
this.add(this.firstName$);         // reactive value — updates automatically
this.add(this.FIRST_NAME);         // view for editing — bound to context data
this.add(this.FIRST_NAME.__);      // PropertyBorder: view + label + validation errors + units
```

`this.FIRST_NAME` (property constant, upper-case) adds the property's configured view and auto-binds it to the current `data` in context. `.__` wraps it in a **PropertyBorder** which adds the label, unit display, visibility control, and inline validation messages.

Slots support composition:

```javascript
this.firstName$.sub(fn);              // subscribe to changes
slot1.linkFrom(slot2);                // two-way bind
this.firstName$ = view.data$;        // two-way bind (shorthand)

// ExpressionSlot — fires when any dependency changes
var fullName = this.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;
});
```

### Data Binding in Practice

```javascript
// Bind a whole object's properties to views via context
this.startContext({ data: this.user })
  .add(User.FIRST_NAME)    // auto-bound to this.user.firstName
  .add(User.LAST_NAME)
  .startContext({ data: this.user.address })
    .add(Address.STREET)   // auto-bound to this.user.address.street
  .endContext()
.endContext()

// Actions bind the same way — add() on an Action constant renders a button
this.add(EMail.SEND, EMail.REPLY, EMail.FORWARD)
```

### CSS Scoping

```javascript
foam.CLASS({
  name: 'MyView',
  extends: 'foam.u2.View',
  css: `
    ^ { padding: 16px; }          /* ^ = this component's root class */
    ^title { font-weight: bold; }
    ^:hover { background: #eee; }
  `,
  methods: [
    function render() {
      this.addClass()             // applies scoped root class
        .start().addClass('title').add('Hello').end();
    }
  ]
});
```

`^` in CSS is replaced with a unique generated class name scoped to this component. No global pollution, no naming conflicts, full inheritance.

### Visibility and ControllerMode

```javascript
// On a property definition:
{ class: 'String', name: 'id', createVisibility: 'HIDDEN', updateVisibility: 'RO' }

// DisplayMode values: RW, RO, DISABLED, HIDDEN
// ControllerMode (set on controller): CREATE, VIEW, EDIT
// ControllerMode.VIEW automatically downgrades RW → RO
```

Visibility can be a static value or a **slot** — making fields show/hide reactively without imperative DOM manipulation.

### Unsubscribing — `onDetach()`

```javascript
// Bad: subscription leaks if component is removed
this.data$.sub(this.onDataChange);

// Good: subscription is auto-cancelled when component is detached
this.onDetach(this.data$.sub(this.onDataChange));
```

Calling `.detach()` on an element cancels all subscriptions registered with `onDetach()` in O(1) — the subscription holds the reference, not the source.

### The render() Method

In U3, put all DOM-building code in `render()`, not `init()`:

```javascript
foam.CLASS({
  name: 'InvoiceView',
  extends: 'foam.u2.View',  // data property = the Invoice being displayed
  methods: [
    function render() {
      this.addClass()
        .start('h2').add(this.data.invoiceNumber$).end()
        .add(Invoice.AMOUNT.__)
        .add(Invoice.STATUS.__)
        .add(Invoice.SUBMIT);  // renders the action as a button
    }
  ]
});
```

### CRUD for Free — `DAOBrowserView`

```javascript
// A complete search/browse/create/edit/delete interface:
this.tag('foam.u2.view.DAOBrowserView', { data: this.invoiceDAO });
```

This single line produces search, filter, table with sort/pagination, detail view, create/edit forms with validation, and action buttons — driven entirely from the model's property definitions, `tableColumns`, `sections`, and `actions` declarations.

---

## 18. What to Unlearn — Thinking in FOAM

These are the instincts that produce plausible-looking but un-FOAM-like code.

**Don't manipulate the DOM imperatively.** If you find yourself calling `.style()`, `.addClass()`, or updating content inside an event handler, you're thinking in jQuery. The FOAM way is to slot the value at the point of declaration: `el.style({ color: this.errorColor$ })`. The slot drives the DOM; you never touch it again.

**Don't write your own getters and setters.** A common mistake is adding `get firstName() { return this._firstName; }` inside a FOAM class. FOAM generates all of this from the property declaration. Custom getter/setter logic belongs in `getter:`, `setter:`, `preSet:`, or `postSet:` on the property axiom — not as JavaScript class syntax alongside it.

**Don't instantiate classes with `new`.** Always use `ClassName.create()`. `new` bypasses the FOAM class system entirely — no property initialisation, no factory, no context, no reactive slots, no axiom processing.

**Don't reference other classes directly.** `com.example.Invoice.create()` bypasses context and replacement. Declare `requires: ['com.example.Invoice']` and use `this.Invoice.create()`. This is what makes mocking, testing, and class substitution work.

**Don't put async work in `init()`.** `init()` is synchronous. Use `expression:` for derived async data, or trigger async work from a listener. In U3 views, rendering belongs in `render()`, not `init()`.

**Don't write validation imperatively.** `if (!email.includes('@')) showError(...)` in an event handler is wrong. Declare `validateObj` or `validationPredicates` on the property. FOAM surfaces validation in the UI automatically, runs it on the model, and exposes it through `obj.errors_# FOAM for LLMs

> FOAM (Feature-Oriented Active Modeller) is a model-driven, cross-platform application framework for JavaScript, Java, and Swift. Everything is a model. Everything is composable. Code is a liability; declarations are assets.

---

## 1. The Core Mental Model

FOAM replaces the conventional "write implementation code" approach with "declare what things are." The framework generates getters, setters, validation, serialization, UI, storage, and reactive bindings from declarations.

**Key principle:** When you see a FOAM class, read it as a *specification* of intent, not an implementation. The framework handles the "how."

---

## 2. Defining a Class

```javascript
foam.CLASS({
  package: 'com.example',
  name:    'Invoice',
  extends: 'foam.nanos.fo.FObject',   // optional; FObject is the default root

  documentation: 'Represents a customer invoice.',

  requires: [
    'com.example.LineItem',           // makes this.LineItem available; provides creation context
    'com.example.Status as InvStatus' // aliased with `as`
  ],

  imports: [
    'invoiceDAO',                     // pulled from the context (X) into this.invoiceDAO
    'currentUser?'                    // optional import; no warning if absent
  ],

  exports: [
    'invoiceId as activeInvoiceId'    // publishes to sub-context so children can import it
  ],

  constants: {
    MAX_LINE_ITEMS: 100
  },

  properties: [ /* see Section 3 */ ],
  methods:    [ /* see Section 4 */ ],
  listeners:  [ /* see Section 5 */ ],
  actions:    [ /* see Section 6 */ ],
  topics:     [ 'submitted', 'cancelled' ]  // pub/sub event declarations
});
```

**Lookup / creation:**
```javascript
// By fully-qualified name
var cls = foam.lookup('com.example.Invoice');

// Creation (args are initial property values)
var inv = com.example.Invoice.create({ amount: 100 });

// Creation in a context Y
var inv = com.example.Invoice.create({ amount: 100 }, Y);

// JSON notation — equivalent to the above
var inv = foam.json.parse({ class: 'com.example.Invoice', amount: 100 });
```

---

## 3. Properties

Properties are the primary unit of data. They are declarative axioms with rich metadata.

```javascript
properties: [
  // Short-form (class defaults to 'FObject' slot, no type coercion)
  'name',

  // Typed short-form
  { class: 'String',  name: 'email' },
  { class: 'Int',     name: 'quantity', value: 1 },       // value = default
  { class: 'Float',   name: 'price' },
  { class: 'Boolean', name: 'paid', value: false },
  { class: 'Date',    name: 'dueDate' },
  { class: 'Array',   name: 'tags' },
  { class: 'Map',     name: 'metadata' },
  { class: 'EMail',   name: 'contactEmail' },
  { class: 'URL',     name: 'documentUrl' },
  { class: 'Long',    name: 'externalId' },

  // FObject reference
  { class: 'FObjectProperty', of: 'com.example.Address', name: 'billingAddress' },

  // Array of FObjects
  { class: 'FObjectArray', of: 'com.example.LineItem', name: 'lineItems' },

  // Reference to another model by ID (foreign key)
  { class: 'Reference', of: 'com.example.Customer', name: 'customerId' },

  // Computed / derived (recalculates when dependencies change)
  {
    class: 'Float',
    name: 'total',
    expression: function(lineItems) {    // arg names ARE the dependency names
      return lineItems.reduce((s, li) => s + li.price * li.qty, 0);
    }
  },

  // Lazy-initialized
  {
    name: 'helper',
    factory: function() { return this.SomeHelper.create(); }
  },

  // More specific types with built-in format validation
  { class: 'EMail',       name: 'email' },
  { class: 'Password',    name: 'password' },
  { class: 'PhoneNumber', name: 'phone' },
  { class: 'URL',         name: 'documentUrl' },
  { class: 'Website',     name: 'homepage' },
  { class: 'Currency',    name: 'amount', units: 'USD' },
  { class: 'StringArray', name: 'tags' },

  // Built-in constraints (automatically validated and shown in GUI)
  {
    class: 'String',
    name: 'code',
    required: true,
    minLength: 3,
    maxLength: 10
  },
  {
    class: 'Int',
    name: 'quantity',
    min: 1,
    max: 999
  },

  // JS-only inline validation (returns error string or nothing)
  {
    class: 'String',
    name: 'invoiceNumber',
    documentation: 'Must match format INV-XXXXXX.',
    required: true,
    validateObj: function(invoiceNumber) {
      if ( !/^INV-\d{6}$/.test(invoiceNumber) )
        return 'Invoice number must match format INV-XXXXXX';
    }
  },

  // Cross-platform validation using FScript predicates
  {
    class: 'Int',
    name: 'age',
    validationPredicates: [
      {
        query: 'age>=18&&age<=120',
        errorString: 'Age must be between 18 and 120.'
      }
    ]
  },

  // Cross-property validation lives on a separate property (or in validateObj of any property)
  // Use validateObj that references other properties via the argument list:
  {
    class: 'Date',
    name: 'endDate',
    validateObj: function(endDate, startDate) {
      if ( foam.Date.compare(endDate, startDate) < 0 )
        return 'End date cannot be before start date.';
    }
  },

  // With visibility and documentation
  {
    class: 'String',
    name: 'notes',
    label: 'Internal Notes',
    documentation: 'Visible only to staff.',
    visibility: 'HIDDEN'              // or 'RO', 'RW', 'FINAL'
  },

  // Java-specific
  {
    class: 'String',
    name: 'token',
    javaFactory: 'return java.util.UUID.randomUUID().toString();',
    javaTransient: true
  }
]
```

**Key validation rules:**
- `required: true` — property must be non-empty; enforced in GUI and on `validate()`
- `min` / `max` — numeric bounds
- `minLength` / `maxLength` — string length bounds
- `validateObj` — JS-only; argument names are dependencies (same as `expression`); return an error string or nothing
- `validationPredicates` — cross-platform FScript predicates; use `thisValue` or property name in `query`; requires `errorString` or `errorMessage` (i18n key)
- All constraints surface automatically in FOAM's detail views as inline error messages
- `obj.errors_` is a reactive property containing the current array of `[property, errorString]` pairs

**Accessing properties at runtime:**
```javascript
inv.amount          // getter
inv.amount = 200    // setter (fires property change event)
inv.amount$.sub(function(e, _, __, newVal) { ... })  // subscribe to changes
inv.slot('amount')  // returns a Slot (reactive reference)
```

**Property constants** are copied onto both class and instance:
```javascript
Invoice.AMOUNT      // the Property axiom object
inv.AMOUNT.name     // 'amount'
```

---

## 4. Methods

```javascript
methods: [
  function init() {
    // Called on create(). Call this.SUPER() to chain.
    this.SUPER();
    this.validate();
  },

  function validate() {
    if ( this.amount < 0 ) throw new Error('Amount must be non-negative');
  },

  {
    name: 'toCSV',
    documentation: 'Returns a CSV row for this invoice.',
    code: function() {
      return `${this.id},${this.amount},${this.dueDate}`;
    }
  },

  // Java implementation alongside JS
  {
    name: 'generateToken',
    type: 'String',
    javaCode: `return java.util.UUID.randomUUID().toString();`
  }
]
```

Use `this.SUPER()` for inheritance calls. Methods are normal prototype methods — call them as `obj.methodName()`.

---

## 5. Listeners

Listeners are **pre-bound** methods. Unlike regular methods, they always keep their `this` even when passed as callbacks. Use them wherever you would pass a function reference (DOM events, DAO subscriptions, timers, etc.).

```javascript
listeners: [
  function onAmountChange(e, source, prop, newVal) {
    console.log('New amount:', newVal);
  },

  // Merged: multiple rapid calls collapse into one, fired after `mergeDelay` ms
  {
    name: 'onResize',
    isMerged: true,
    mergeDelay: 100,  // ms; default 16
    code: function() { this.relayout(); }
  },

  // Framed: fires at most once per animation frame
  {
    name: 'onDataChange',
    isFramed: true,
    code: function() { this.repaint(); }
  }
]
```

**Subscribing a listener to a property change:**
```javascript
this.amount$.sub(this.onAmountChange);
```

---

## 6. Actions

Actions are methods with GUI metadata — label, availability, enablement. Views automatically render them as buttons.

```javascript
actions: [
  {
    name: 'submit',
    label: 'Submit Invoice',
    isAvailable: function(paid) { return !paid; },   // hides when paid
    isEnabled:   function(amount) { return amount > 0; },
    code: function(X) {
      this.pub('submitted');
      X.invoiceDAO.put(this);
    }
  }
]
```

---

## 7. Context (X)

The context (`X`) is FOAM's dependency-injection container — an immutable (but sub-contextable) key-value map.

```javascript
// Create a context
var Y = foam.createSubContext({
  invoiceDAO: myDAO,
  currentUser: user
});

// Create an object within that context
var inv = Invoice.create({}, Y);
// inv.invoiceDAO === myDAO  (via import)

// Objects can create sub-contexts for their children
var subY = Y.createSubContext({ theme: 'dark' });
```

The standard top-level context is `foam.__context__`. Each object's context is at `obj.__context__` (or `obj.x` if it imports `'x'`). Children created via `requires` automatically receive the parent's context.

---

## 8. DAOs (Data Access Objects)

A DAO is FOAM's universal storage interface. The same query API works against in-memory, REST, JDBC, IndexedDB, or any custom backend.

### Core interface

```javascript
// Put (create or update)
await dao.put(obj);

// Find by id
var obj = await dao.find(id);

// Remove by id or object
await dao.remove(obj);

// Select with optional predicate/order/skip/limit
var sink = await dao.select();            // returns ArraySink
var sink = await dao.select(M.COUNT());   // returns Count sink
var sink = await dao.where(M.EQ(Invoice.PAID, false))
                    .orderBy(M.DESC(Invoice.DUE_DATE))
                    .limit(20)
                    .select();

var results = sink.array;    // ArraySink

// Listen for changes
dao.on.put.sub(function(e, _, __, obj) { console.log('put:', obj); });
dao.on.remove.sub(function(e, _, __, obj) { });
```

### MLang — the query language

```javascript
var M = foam.mlang.ExpressionsSingleton.create();

M.EQ(Invoice.AMOUNT, 100)
M.GT(Invoice.AMOUNT, 50)
M.LT(Invoice.DUE_DATE, new Date())
M.IN(Invoice.STATUS, ['OPEN','OVERDUE'])
M.AND(M.EQ(Invoice.PAID, false), M.GT(Invoice.AMOUNT, 0))
M.OR( ... )
M.NOT(M.EQ( ... ))
M.CONTAINS(Invoice.NOTES, 'urgent')
M.STARTS_WITH(Invoice.EMAIL, 'admin')

// Aggregates as sinks
M.COUNT()
M.SUM(Invoice.AMOUNT)
M.MAX(Invoice.AMOUNT)
M.MIN(Invoice.DUE_DATE)
M.GROUP_BY(Invoice.STATUS, M.COUNT())
M.MAP(Invoice.AMOUNT, M.SUM(Invoice.AMOUNT))

// Ordering
M.DESC(Invoice.DUE_DATE)
M.THEN_BY(M.DESC(Invoice.DUE_DATE), Invoice.ID)
```

Predicates can be serialized to JSON and sent over the wire — this is how ClientDAO works.

### Common DAO types

| Class | Purpose |
|---|---|
| `foam.dao.MDAO` | In-memory, with pluggable indexes |
| `foam.dao.EasyDAO` | Configures journal, cache, sequence, etc. with one declaration |
| `foam.dao.JDAO` | Journal (file-based persistence) wrapping another DAO |
| `foam.dao.CachingDAO` | Read cache over a slower delegate |
| `foam.dao.ClientDAO` | Proxies over the network to a server-side DAO |
| `foam.dao.LRUCachingDAO` | Bounded cache with LRU eviction |
| `foam.dao.ProxyDAO` | Base class for decorating DAOs |

**Decorator chain (typical):**
```
ClientDAO → CachingDAO → MDAO
                      ↓ (server-side)
               EasyDAO(journal=true, cache=true, of=Invoice)
```

---

## 9. Inheritance and Mixins

```javascript
foam.CLASS({
  name: 'PremiumInvoice',
  extends: 'com.example.Invoice',   // single inheritance
  mixins:  ['foam.nanos.auth.Authorizable'], // copies axioms directly

  properties: [
    { class: 'Float', name: 'discountRate', value: 0.1 }
  ]
});
```

`implements` is like `mixins` but with proper method override semantics (override handling via `SUPER`). `mixins` does a direct axiom copy.

---

## 10. Pub/Sub

Every FObject has built-in pub/sub through a topic hierarchy.

```javascript
// Publish
obj.pub('myTopic', 'subTopic', data);

// Subscribe
var sub = obj.sub('myTopic', function(sub, topic, ...args) {
  console.log(args);
});

// Property changes are published automatically:
// obj.pub('propertyChange', 'amount', slot)
obj.sub('propertyChange', 'amount', handler);

// Unsubscribe
sub.detach();
```

---

## 11. Relationships

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.example.Customer',
  targetModel: 'com.example.Invoice',
  forwardName: 'invoices',    // Customer gets: customer.invoices → DAO
  inverseName: 'customer',    // Invoice gets: invoice.customerId (FK)
  cardinality: '1:*'
});
```

After declaration, `customer.invoices` is a DAO pre-filtered to that customer's invoices.

---

## 12. Enums

```javascript
foam.ENUM({
  package: 'com.example',
  name: 'InvoiceStatus',
  values: [
    { name: 'DRAFT',    label: 'Draft',    ordinal: 0 },
    { name: 'OPEN',     label: 'Open',     ordinal: 1 },
    { name: 'PAID',     label: 'Paid',     ordinal: 2 },
    { name: 'OVERDUE',  label: 'Overdue',  ordinal: 3 }
  ]
});

// Usage
invoice.status = com.example.InvoiceStatus.OPEN;
invoice.status.label    // 'Open'
invoice.status.ordinal  // 1
```

---

## 13. Interfaces

```javascript
foam.INTERFACE({
  package: 'com.example',
  name: 'Exportable',
  methods: [
    { name: 'toCSV',  type: 'String' },
    { name: 'toPDF',  type: 'String' }
  ]
});

foam.CLASS({
  name: 'Invoice',
  implements: ['com.example.Exportable'],
  methods: [
    function toCSV() { ... },
    function toPDF() { ... }
  ]
});
```

---

## 14. Important Patterns

### Check before accessing sub-context values
Use optional imports (`'myService?'`) when a service might not always be present.

### Prefer `expression` over `factory` for computed values
`expression` declares dependencies and auto-invalidates. `factory` only runs once.

### Use `requires` instead of direct class references
`this.Invoice.create()` uses the context; `com.example.Invoice.create()` bypasses it. Replacements, singletons, and multitons only work through `requires`.

### DAOs are composable pipelines
Chain `.where()`, `.orderBy()`, `.skip()`, `.limit()` before `.select()` — each returns a new decorated DAO, nothing executes until `select()`/`find()`/`put()`.

### `detach()` for cleanup
Subscriptions and child objects implement `Detachable`. Call `.detach()` to unsubscribe and free resources. Objects call `detach()` on all their sub-subscriptions when they are themselves detached.

### Late binding via context
When you call `this.SomeClass.create()`, the actual class may have been replaced in the context. This is intentional — it enables mocking, decoration, and platform-specific implementations transparently.

---

---

## 15. Why FOAM Maps Naturally to Natural Language

FOAM's declarative structure has an unusually small gap between how humans describe systems and how they're encoded. This is especially important when working with LLMs.

**Human:** "I need a User with email, password, and a way to check if they're an admin."

**FOAM:**
```javascript
foam.CLASS({
  name: 'User',
  properties: [
    { class: 'EMail',    name: 'email',    required: true },
    { class: 'Password', name: 'password', required: true },
    { class: 'Enum',     name: 'role',     of: 'UserRole' }
  ],
  methods: [
    function isAdmin() { return this.role === UserRole.ADMIN; }
  ]
});
```

Things the LLM does *not* need to generate: getters, setters, change notification, validation wiring, serialization, GUI components, or storage adapters. The framework provides all of them from the declaration above. This makes FOAM unusually well-suited to LLM-driven development — describe intent, receive a working specification.

---

## 16. Quick Reference: Common Mistakes to Avoid

| Wrong | Right |
|---|---|
| `new Invoice()` | `Invoice.create()` |
| `invoice.amount()` | `invoice.amount` (properties are not methods) |
| Direct class reference in `requires` | Use `this.ClassName.create()` after requiring |
| Mutating array property directly | Replace: `this.items = [...this.items, newItem]` |
| `async init()` | FOAM `init()` is synchronous; do async work in an `expression` or separate method |
| Forgetting to `detach()` listeners | Causes memory leaks; attach subs to `this.onDetach(sub)` |

---

.

**Don't think in REST.** When connecting to a server, don't reach for `fetch()`. Import a DAO or service from context and call it as an object. The network is an implementation detail you should never see.

**Don't manage subscriptions manually without `onDetach()`.** Any `sub()` call not wrapped in `this.onDetach(...)` is a memory leak waiting to happen when the component is removed.

**Don't use `expression:` and `factory:` interchangeably.** `factory:` runs once and is never re-evaluated. `expression:` re-evaluates whenever any named argument property changes. Using `factory:` for something that should react to changes is a common source of stale data bugs.

**Don't write separate client and server models.** One FOAM model, one property definition, one validation rule — the framework targets Java, JavaScript, and Swift from it. Duplicate models that diverge over time are a sign that FOAM's cross-platform generation isn't being used.

**The underlying principle all of these share:** FOAM wants you to declare *what things are*, not *what to do when things happen*. Whenever you find yourself writing imperative update logic, ask whether a slot, an expression property, a DAO decorator, or a validation declaration could express the same intent declaratively. It almost always can.

---

## 19. Grammars and Parsers

FOAM includes a parser combinator library and a Grammar system for building complex, readable parsers without a separate compiler step. Grammars are regular FOAM classes — they use the same modelling system as everything else.

### Why Grammars

Inline parser combinators work for simple cases but become unreadable for anything recursive or multi-part. A Grammar is a named collection of mutually recursive parsers. Names replace nesting, `sym()` replaces repetition, and the Single Responsibility Principle replaces monolithic expressions.

### Structure

```javascript
foam.CLASS({
  name: 'MyGrammar',
  extends: 'foam.parse.Grammar',
  methods: [
    function grammar(seq, str, repeat, range, literal, alt, optional, chars, sym) {
      return {
        START: /* first parser to run */,
        ruleName: /* any named sub-parser */,
        // ...
      };
    }
  ]
});
```

**Key points:**
- The `grammar` function's parameter names are the parser constructors being used. List every combinator you use (`seq`, `str`, `repeat`, `range`, `literal`, `alt`, `optional`, `chars`, `sym`). Their order doesn't matter.
- `START` is the entry point — always required.
- Named rules are referenced with `sym('ruleName')`. `sym` can reference rules defined before or after the current one (mutual recursion).
- No leading `P.` inside a grammar — the constructors are injected as parameters.

### Core Combinators

| Combinator | Meaning |
|---|---|
| `literal('x')` | Match exact string |
| `range('a','z')` | Match single character in range |
| `chars(' ,-')` | Match any single character from the set |
| `seq(a, b, c)` | Match a then b then c (all must succeed) |
| `alt(a, b)` | Match a or b (first success wins) |
| `str(p)` | Match p and return result as a string |
| `repeat(p, sep, min, max)` | Match p repeatedly; sep=separator, min/max optional |
| `optional(p, default)` | Match p if present, else return default |
| `sym('name')` | Reference a named rule in this grammar |

### Example

```javascript
foam.CLASS({
  name: 'NamePhonePlateGrammar',
  extends: 'foam.parse.Grammar',
  methods: [
    function grammar(sym, range, alt, str, seq, chars, optional, repeat) {
      return {
        START: str(seq(
          sym('fullName'), sym('separator'),
          sym('phoneNumber'), sym('separator'),
          sym('licensePlate')
        )),

        letter:    alt(range('a','z'), range('A','Z')),
        digit:     range('0','9'),

        // Recursive rule — separator calls itself to consume runs of separators
        separator: str(seq(chars(' ,-'), optional(sym('separator')))),

        areaCode:  str(seq(
          optional('(', '('),
          str(repeat(sym('digit'), null, 1, 3)),
          optional(')', ')')
        )),

        fullName:  str(seq(
          str(repeat(sym('letter'))),
          sym('separator'),
          str(repeat(sym('letter')))
        )),

        phoneNumber: str(seq(
          sym('areaCode'),
          optional(sym('separator'), ' - '),
          str(repeat(sym('digit'), null, 1, 3)),
          optional(sym('separator'), ' - '),
          str(repeat(sym('digit'), null, 1, 4))
        )),

        licensePlate: str(repeat(alt(sym('letter'), sym('digit')), null, 5, 8))
      };
    }
  ]
});
```

### Using a Grammar

```javascript
var g = MyGrammar.create();

// Parse a full string against START
var result = g.parseString('Clark Kent, 6205550145, KRYP70N');

// Access and test a named sub-rule directly
var phoneParser = g.getSymParser('phoneNumber');
phoneParser.match('(620) - 555 - 0145');     // first match
phoneParser.matchAll('call (620)-555-0145 or (201)-530-7972');  // all matches
```

### Semantic Actions

To transform parse results, add an `actions` object alongside the grammar return value (or use a separate `addActions()` call):

```javascript
function grammar(sym, seq, str, repeat, range, alt) {
  return {
    START: sym('number'),
    digit: range('0','9'),
    number: str(repeat(sym('digit'), null, 1))
  };
},

function actions() {
  return {
    number: function(v) { return parseInt(v, 10); }  // string → integer
  };
}
```

Actions receive the parse result of their named rule and return the transformed value. This is how grammars compile to ASTs, DAOs, mlangs, or any other structure.

### Design Principle

Follow the Single Responsibility Principle: each named rule handles one precise thing. Small rules (`letter`, `digit`, `separator`) compose into medium rules (`areaCode`, `word`) which compose into large rules (`phoneNumber`, `fullName`) which compose into `START`. This keeps grammars readable, testable sub-rule by sub-rule, and reusable across grammar extensions.

---

## 20. Multi-Tenancy: Service Providers and SPID

FOAM's multi-tenancy model is built around **Service Providers** (the FOAM term for tenants). Every tenant has a **SPID** (Service Provider ID).

### SPIDAware Models

Any model can opt into tenant scoping by implementing `ServiceProviderAware`:

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'Invoice',
  implements: ['foam.core.auth.ServiceProviderAware'],
  properties: [
    // spid property is added automatically by the interface
    { class: 'String', name: 'amount' }
  ]
});
```

`EasyDAO` with `authorize: true` automatically wraps the DAO with `SpidAwareDAO`, which transparently filters every `select`, `find`, `put`, and `remove` based on the SPID of the requesting user. Application code never adds `.where(EQ(Invoice.SPID, userSpid))` — the DAO layer handles it invisibly.

### Hierarchical SPIDs

SPIDs are dot-separated hierarchical strings:

```
acme
acme.canada
acme.canada.eastcoast
acme.canada.eastcoast.randd
```

A user's effective SPID access can be granted at any level. A user with `acme.canada.*` sees all data under that subtree. A user with `*` sees everything. Users always have implicit access to their home SPID (set on the `User` model). Additional SPID access is granted via the GRANT permission system.

This means data is automatically siloed — a user at `acme.canada.eastcoast.randd` cannot see data belonging to `acme.canada.westcoast` unless explicitly granted.

### The Theme Model and White-Labelling

Each Service Provider gets its own `Theme` — a FOAM model stored in `themeDAO` that drives the entire look and feel of the application for that tenant's users. The Theme model covers:

- **Identity:** app name, logos (standard, large, top-nav, login), favicon
- **Colour palette:** primary, secondary, approval, warning, destructive, and grey scales (5 shades each)
- **Typography:** fonts, input sizing
- **Navigation:** root menus, default post-login menu, unauthenticated landing
- **Application wiring:** controller class, client bundle, boot services
- **Security:** password policy, restricted capabilities, allowed domains
- **CSS:** custom CSS injection per theme
- **Class overrides:** `registrations` — an array of `XRegistration` entries that replace one FOAM class with another *for that theme only*, transparently, without changing any application code

The `registrations` mechanism is particularly powerful — a tenant can swap `foam.u2.DetailView` for a custom view globally across their instance by adding one entry to their Theme, with no code changes anywhere else.

Themes are **merged** rather than replaced. A child theme inherits from a parent and overrides only what it sets. The `Theme.merge()` method handles arrays (concatenated), maps (merged), FObjectProperties (deep merged), and scalars (overridden) — so a tenant can extend a base platform theme rather than duplicating it.

### SPID and Theme in Context

Both the current user's SPID and the resolved Theme are available through the context:

```javascript
imports: ['theme', 'subject'],
methods: [
  function init() {
    console.log(this.theme.appName);       // tenant's app name
    console.log(this.subject.user.spid);   // user's home SPID
  }
]
```

The Theme is resolved on login based on the user's SPID and the request domain, and placed into the context. All views downstream receive it automatically.

---

## 20. Infrastructure Patterns

### Authentication and Sessions

FOAM has a built-in session system based on the Box message-passing layer. The key components are:

**`SessionedMessage`** — a wrapper that pairs a `sessionId` string with a message payload. Every outbound client request is wrapped in one.

**`SessionClientBox`** — client-side Box decorator that imports `sessionID` from context and wraps each message before it hits the network. The `sessionID` is resolved from context, a URL query parameter, or `localStorage`, falling back to a generated GUID.

**`SessionServerBox`** — server-side Box decorator that unwraps messages, looks up the session in `localSessionDAO`, validates the remote IP (deletes session and forces re-auth if IP changes — session hijacking mitigation), merges the session's user context into the request context (`X`), and checks authorization via `CSpec.checkAuthorization()` before forwarding to the service.

**`SessionService`** — higher-level API for creating and expiring sessions without direct DAO access:
```java
sessionService.createSession(x, userId, agentId);
sessionService.createSessionWithTTL(x, userId, agentId, ttl);
sessionService.expireSession(x);
```

The **Subject** pattern: the session carries a `userId` (0 = anonymous). The effective context derived from the session includes the user, their group, and their resolved `PermissionSet` — all services downstream receive this context as `x` and never need to do their own auth checks.

**`SessionReplyBox`** — client-side reply handler that detects `AuthenticationException` responses and either prompts login or reloads the page. Also handles soft session timer refresh from group configuration.

For tests and DIG clients, sessions can be created directly:
```java
Session session = new Session();
session.setUserId(userId);
session.setTtl(3153600000000L);
session = (Session) ((DAO) x.get("sessionDAO")).put(session);
// The returned session.getId() is the token to pass as sessionId
```

---

### Schema Migration and JDAO Journals

FOAM's primary persistence mechanism is **JDAO** (Journalled DAO): an append-only text log that decorates an in-memory MDAO. On startup, the journal is replayed to reconstruct in-memory state.

**Journal format:**
```
p({"class":"com.example.Invoice","id":"INV-001","amount":100,"status":"OPEN"})
p({"class":"com.example.Invoice","id":"INV-001","amount":150})   // partial update — only changed fields
r({"class":"com.example.Invoice","id":"INV-001"})                // remove
// comment lines are allowed
```

Each `p()` entry is a **partial object** — only the fields present are merged onto the existing in-memory object by id. This has direct consequences for schema evolution:

- **Adding a property** — safe with no action required. Missing fields during replay use the property's `value` or `factory` default.
- **Removing a property** — safe with no action required. Unknown fields in journal entries are silently ignored during deserialization.
- **Renaming a property** — leave the old property in the model but mark it `hidden` and use its `postSet` (or `setter`) to write the new property. On journal replay the old field sets the new one automatically, migrating all data on load. Remove the shim after the journal has been compacted.
- **Changing a property's type** — use the same shim pattern: keep the old property with its original type, and in its `postSet` convert and assign to the new property. This handles format conversion (e.g. String → Date) transparently during replay.

```javascript
// Migration shim: rename 'dueDate' (String) → 'dueDateObj' (Date)
{
  class: 'String',
  name: 'dueDate',         // old name, old type
  hidden: true,            // invisible in UI
  transient: true,         // don't write back to new journals
  postSet: function(_, v) {
    this.dueDateObj = new Date(v);   // migrate on read
  }
},
{
  class: 'Date',
  name: 'dueDateObj'       // new canonical property
}
```

**Journal compaction:** periodically the live state is snapshotted as fresh `p()` entries and the old log archived. After compaction the migration shims can be removed. For SQL backends, **JDBCDAO** provides the same DAO interface; schema changes there follow standard SQL migration tooling (Liquibase, Flyway, or manual `ALTER TABLE`).

---

### Client↔Server DAO and Service Wiring

### CORE — The Application Server

CORE (Context-Oriented Runtime Environment) is FOAM's application server. It is a micro-micro-kernel: the smallest possible thing that can bootstrap everything else.

**The only thing built into CORE is one DAO: `cSpecDAO`.**

A `CSpec` (CORE Service Specification) is a descriptor for a service — it defines how to create the service and, optionally, its client-side counterpart. On boot, CORE loads the `cSpecDAO` and registers a **lazy factory** in the context for every service it finds. The service is not created until something first accesses it by name. Services marked `lazy: false` are touched immediately on startup, which causes them to initialise.

That's the entire boot sequence. Everything else — the embedded HTTP server, the logger, the auth service, all the application DAOs, the session service — is just a service defined in the `cSpecDAO`. None of it is hardwired. Remove a CSpec entry and the service doesn't exist. Replace it and a different implementation loads transparently. With a different set of CSpec entries you have a completely different server.

```
Boot sequence:
1. Load cSpecDAO (the one built-in DAO)
2. For each CSpec: register a lazy factory in context
3. For each non-lazy CSpec: touch it to force initialisation
4. Done.
```

**The client side is symmetric.**

A `ClientBuilder` runs on the client. It has one built-in client-side DAO that connects to the server's `cSpecDAO`. It downloads all the CSpec entries, reads each one's `client:` property, and registers lazy factories in the client context — exactly mirroring the server. When client code accesses a service by name, the factory builds the client agent (a network stub, a full local implementation, or anything in between) on demand.

The result is that both server and client boot from the same set of specifications. Adding a service means adding one CSpec entry. The server gets the implementation; the client gets the agent. Neither side requires any other configuration change.

**200+ services out of the box.**

The standard CORE distribution ships with more than 200 pre-defined CSpec entries covering authentication, authorisation, session management, logging, HTTP serving, DAOs, email, notifications, scheduled jobs, audit logging, and much more. The minimal kernel architecture means any of these can be removed, replaced, or supplemented — but in practice a standard FOAM application starts with a fully capable server without writing a single service definition.

**Why this matters for code generation:**

When writing FOAM server or client code, you never instantiate services directly. You access them by name through context (`x.get("myService")` in Java, or `imports: ['myService']` in JavaScript). The CSpec system is what puts them there. Writing code that bypasses context — hardcoding a `new MyServiceImpl()` or calling a constructor directly — breaks the entire substitutability model.

---

**On REST and endpoints — a design philosophy note:**

FOAM considers explicit REST endpoint management a devolution in software design. REST forces the programmer to think about transport — URL structure, HTTP verbs, serialization format, status codes — none of which is their actual problem. It also hardwires the protocol into the calling code, making it impossible to change the transport, add caching, or insert authorization without modifying clients.

FOAM's position: services and data stores should be **objects**, not endpoints. The transport is a configuration detail, not an API contract. This is what makes decorator composition — caching DAOs, authorization DAOs, throttling DAOs, logging DAOs — possible without any client code awareness.

**Boxes — the transport abstraction layer:**

A Box is a low-level FOAM abstraction — a simple "message box" interface with a single `send(envelope)` method. Different Box implementations handle different transports: HTTP, HTTPS, WebSockets, raw sockets, in-process, etc. Switching transport is a matter of swapping the Box in the service registration; no application code changes. Average FOAM developers never work with Boxes directly — they use DAOs and services, and the Box layer is wired up automatically by the framework beneath them.

**The key abstraction: programmers never deal with endpoints.**

Application code — whether JavaScript on the client or Java on the server — simply imports a DAO by name from context and uses it identically:

```javascript
// JS client
imports: ['invoiceDAO'],
methods: [
  async function loadOverdue() {
    const sink = await this.invoiceDAO
      .where(M.EQ(Invoice.STATUS, InvoiceStatus.OVERDUE))
      .select();
    return sink.array;
  }
]
```

```java
// Java server
DAO invoiceDAO = (DAO) x.get("invoiceDAO");
List results = ((ArraySink) invoiceDAO
  .where(EQ(Invoice.STATUS, InvoiceStatus.OVERDUE))
  .select(new ArraySink())).getArray();
```

The programmer has no idea — and does not need to know — whether `invoiceDAO` is a local JDAO, a JDBCDAO, a remote DAO on another server, or a decorated pipeline of all three. The DAO interface is the contract; the wiring is configuration.

**How the wiring is configured (CSpec / services journal):**

Services and DAOs are registered via `CSpec` entries in a `.jrl` journal. For a DAO, the `client` block specifies what the client-side gets; the server side is whatever is registered under that name in the server context:

```javascript
// services.jrl — server registration
p({
  "class":       "foam.dao.EasyDAO",
  "of":          "com.example.Invoice",
  "name":        "invoiceDAO",
  "seqNo":       true,
  "journal":     true,
  "cache":       true,
  "authorize":   true
});
```

The client automatically gets a `ClientDAO` proxying to the server over HTTP or WebSocket — no additional client configuration is needed for standard DAOs.

For custom RPC services, a `CSpec` wires a `Skeleton` (server) to a `Stub`-based client proxy, but the calling code still just does `this.myService.doSomething(x, arg)` — indistinguishable from a local call.

**`EasyDAO` properties:**

| Property | Effect |
|---|---|
| `seqNo: true` | Auto-incrementing integer id |
| `guid: true` | UUID id |
| `journal: true` | Wraps with JDAO for persistence |
| `cache: true` | Adds in-memory read cache |
| `authorize: true` | Enforces GRANT permissions on every operation |
| `history: true` | Journals every version of every object |
| `of` | The model class |

The full request flow, invisible to the programmer:
```
Client code (imports invoiceDAO)
  → ClientDAO (serializes over HTTP/WebSocket)
    → SessionServerBox (auth + context merge)
      → AuthorizationDAO → CachingDAO → JDAO → MDAO
```

---

## 21. Generating FOAM Code

When asked to write FOAM code, follow these conventions:

1. Every class starts with `foam.CLASS({`, indented 2 spaces inside.
2. Sections appear in order: `package`, `name`, `extends`, `implements`, `mixins`, `documentation`, `requires`, `imports`, `exports`, `constants`, `properties`, `methods`, `listeners`, `actions`, `topics`.
3. Omit any empty sections.
4. Property types are capitalized: `'String'`, `'Int'`, `'Float'`, `'Boolean'`, `'Date'`, `'Long'`.
5. Use `expression:` (not `getter:`) for derived properties that depend on other properties.
6. Use `factory:` for lazy initialization with no declared dependency.
7. Methods take no `this` argument — they use `this` internally.
8. Import DAOs from context; never instantiate DAOs inline unless in a factory or test.
9. For Java, always provide `javaCode:` on methods where needed alongside JS `code:`.
10. Favor short, composable classes over large monolithic ones — FOAM's power comes from composition.