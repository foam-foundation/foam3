# DAO: Data Access Objects

A DAO (Data Access Object) is FOAM's universal interface to a collection of objects. Every DAO — regardless of whether it stores data in memory, a journal file, a SQL database, or a remote server — presents exactly the same interface to the caller. Your code works identically with any of them.

DAOs are not just for storage. They are composable: you can wrap one DAO with another to transparently add caching, authorisation, logging, sequence number assignment, and more. The caller never knows or needs to know what's underneath.

---

## Making a Class Storable

To store objects of a class in a DAO, FOAM needs to know which property (or properties) uniquely identify each object — the primary key.

The simplest approach is to name your key property `id`:

```javascript
foam.CLASS({
  package: 'fun',
  name: 'StoreMe',
  properties: [ 'id', 'name' ],
});
```

If your key property has a different name, or if you have a multi-part primary key, declare it explicitly with `ids`:

```javascript
foam.CLASS({
  name: 'OrderLine',
  ids: [ 'orderId', 'lineNumber' ],
  properties: [ 'orderId', 'lineNumber', 'product', 'quantity' ],
});
```

If you don't want to manage IDs yourself, use `foam.dao.EasyDAO` with `seqNo: true` and IDs will be assigned automatically.

## The DAO Interface

The full DAO interface is small by design.

### JavaScript

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

### Java

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

Note that `getOf()` returns the `ClassInfo` of the type of objects stored in the DAO — useful for introspection and generic DAO handling code.

---

The filtering methods (`where`, `orderBy`, `limit`, `skip`) return a new DAO that wraps the original. They don't execute anything — they just narrow the scope of the next `select` or `removeAll`. They can be chained freely:

```javascript
dao.where(EQ(Todo.IS_COMPLETED, true))  // EQ and other predicates are covered below
   .orderBy(Todo.CREATED_TIME)
   .skip(40)
   .limit(20)
   .select();
```

*(The `EQ` function used here comes from FOAM's mLang query language, explained in the [Querying with mLangs](#querying-with-mlangs) section below.)*

**Important:** filtering methods only affect `select` and `removeAll`. They have no effect on `find`, `put`, or `remove`.

---

## Single-Object Operations

### put(obj)

Inserts a new object or updates an existing one. The DAO makes no distinction — backends that care can do a `find` internally to check. The resolved value is the stored object, which may differ from what you passed in (for example, with an auto-assigned `id` or server-side defaults filled in):

```javascript
var recipe = Recipe.create({ name: 'Pancakes' });
recipe = await dao.put(recipe);
console.log(recipe.id); // now set by the DAO
```

### find(id)

Retrieves a single object by its primary key. If the object is found the promise resolves with it. If not found it resolves with `null` — it does not reject:

```javascript
var recipe = await dao.find(42);
if ( recipe === null ) console.log('not found');
```

For multi-part primary keys, pass an array:

```javascript
var line = await dao.find([orderId, lineNumber]);
```

### remove(obj)

Deletes a single object. Attempting to remove an object that does not exist is **not** an error — `remove` only rejects if it fails to reach the backend:

```javascript
await dao.remove(recipe);
```

---

## Querying with mLangs

FOAM's query language is called **mLang**. Rather than strings (like SQL), mLang queries are composable objects. This means they are injection-safe, can be serialised and sent across a network, and can be executed directly in JavaScript or compiled to SQL or other query formats depending on the backend — all transparently.

To use mLang expressions conveniently, either implement `foam.mlang.Expressions` in your class or create a singleton instance:

```javascript
// Option 1: implement in your class (recommended)
foam.CLASS({
  name: 'MyController',
  implements: [ 'foam.mlang.Expressions' ],
  methods: [
    async function loadOverdue() {
      return (await this.dao.where(
        this.LT(Invoice.DUE_DATE, new Date())
      ).select()).array;
    }
  ]
});

// Option 2: standalone singleton
var M = foam.mlang.ExpressionsSingleton.create();
dao.where(M.EQ(Todo.IS_COMPLETED, true));
```

### Common predicates

| Expression | Meaning |
|---|---|
| `EQ(prop, value)` | prop === value |
| `NEQ(prop, value)` | prop !== value |
| `GT(prop, value)` | prop > value |
| `GTE(prop, value)` | prop >= value |
| `LT(prop, value)` | prop < value |
| `LTE(prop, value)` | prop <= value |
| `IN(prop, [v1, v2])` | prop is one of the values |
| `CONTAINS(prop, str)` | prop contains str (case-sensitive) |
| `CONTAINS_IC(prop, str)` | prop contains str (case-insensitive) |
| `AND(pred1, pred2, ...)` | all predicates must match |
| `OR(pred1, pred2, ...)` | any predicate must match |
| `NOT(pred)` | negate a predicate |

For cases where no standard predicate fits, `foam.mlang.predicate.Func` lets you run an inline function. Be aware that custom functions can't be optimised by the DAO the way standard mLangs can, so prefer the standard set where possible.

### Sort order

```javascript
dao.orderBy(MyModel.NAME)                           // ascending
dao.orderBy(DESC(MyModel.CREATED_TIME))             // descending
dao.orderBy(DESC(MyModel.RANK), MyModel.LAST_NAME)  // compound
```

---

## select() and Sinks

`select(sink)` is the primary way to retrieve a collection of objects. It calls `sink.put(obj)` for each matching object, then calls `sink.eof()` when done, and resolves the returned promise with the same sink.

If no sink is provided, an `ArraySink` is used by default.

### The Sink interface

```javascript
void put(obj, sub)     // called for each object
void eof()             // called when the stream ends normally
void remove(obj, sub)  // called for each removed object (listen() only)
void reset(sub)        // called when the result set may have changed (listen() only)
```

`select()` only uses `put()` and `eof()`. The `remove()` and `reset()` methods are used by `listen()`, which delivers ongoing changes after the initial select.

The `sub` argument passed to `put()` and `remove()` is a `Detachable` — an object with a single `detach()` method. Call `sub.detach()` if you want to stop receiving further objects without waiting for `eof()`.

### Common Sinks

| Sink | Purpose | Result property |
|---|---|---|
| `ArraySink` | Collects all objects into an array | `.array` |
| `COUNT()` | Counts matching objects | `.value` |
| `SUM(prop)` | Sums a numeric property | `.value` |
| `MAX(prop)` | Finds the maximum value of a property | `.value` |
| `MIN(prop)` | Finds the minimum value of a property | `.value` |
| `GROUP_BY(prop, sink)` | Groups results by property value | `.groups` |
| `MAP(prop)` | Projects a single property from each object | `.array` |
| `UNIQUE(prop, sink)` | Passes only objects with distinct values of prop | — |

### Sink examples

```javascript
// Collect all results
var sink = await dao.select();
console.log(sink.array);

// Count
var count = await dao.select(COUNT());
console.log(count.value);

// Sum a property
var total = await dao.select(SUM(Invoice.AMOUNT));
console.log(total.value);

// Group by status
var groups = await dao.select(GROUP_BY(Invoice.STATUS, COUNT()));
console.log(groups.groups);
```

### Inline Sinks

For simple cases, pass a function directly:

```javascript
await dao.select(function(obj) {
  console.log('Got:', obj.name);
});
```

Or create a `ProxySink` for more control:

```javascript
await dao.select(foam.dao.ProxySink.create({
  delegate: {
    put: function(obj, sub) {
      if ( tooMany() ) sub.detach(); // stop early
      console.log('Got:', obj);
    },
    eof: function() { console.log('Done'); }
  }
}));
```

---

## listen()

`listen(sink)` is like `select()` but it keeps running. After delivering the current contents of the DAO via `put()`, it continues to call `sink.put()` for new objects, `sink.remove()` for deleted ones, and `sink.reset()` when the result set may have changed in a way that can't be expressed as individual puts and removes (for example, after a bulk operation).

```javascript
dao.listen(foam.dao.ProxySink.create({
  delegate: {
    put:    function(obj) { console.log('added or updated:', obj); },
    remove: function(obj) { console.log('removed:', obj);          },
    reset:  function()    { console.log('reload everything');      }
  }
}));
```

Call `sub.detach()` inside any callback to stop listening.


## removeAll()

Works like `select()` but removes matching objects instead of returning them. Use filtering first — a bare `dao.removeAll()` deletes everything:

```javascript
// Delete all completed todos
await dao.where(EQ(Todo.IS_COMPLETED, true)).removeAll();
```

---

## Error Handling

DAO operations reject their returned promise on failure. Errors fall into two categories:

| Exception | Meaning |
|---|---|
| `foam.dao.InternalException` | Transient — the operation may be retried |
| `foam.dao.ExternalException` | Permanent — the operation cannot succeed |

Both carry a `message` property. Note that `find()` returns `null` for a missing object rather than throwing — an exception from `find()` means a genuine failure to reach or query the backend, not simply that the object wasn't there.

```javascript
try {
  var obj = await dao.find(id);
  if ( obj === null ) console.log('object does not exist');
} catch (e) {
  console.log('DAO error:', e.message);
}
```

## Advanced Methods

### cmd(obj)

`cmd()` is an escape hatch for DAO-specific operations that don't belong on the universal interface. The problem it solves: a `CachingDAO` needs a way to purge its cache, but adding `purge()` to the DAO interface would force every DAO implementation to provide it, even those that have no cache. And manually walking a decorator chain to find the `CachingDAO` — assuming it even exists, and isn't on the other side of a network boundary — is fragile and couples the caller to the implementation.

Instead, each DAO decorator intercepts the commands it recognises and delegates the rest. The caller just does:

```javascript
dao.cmd(foam.dao.DAO.PURGE_CMD);
```

Every decorator in the chain sees it. The `CachingDAO` handles it; everything else passes it along. The caller doesn't need to know what decorators are present, in what order, or where they are.

Individual DAOs define their own domain-specific commands. These follow the same pattern: send the command, the right decorator handles it, the rest ignore it.

A `null` return means the command was not handled by any DAO in the chain. Most application code never needs `cmd()` directly.

### inX(x)

Returns a new DAO that runs all operations in the provided context `x`. Internally it wraps the current DAO in a `ProxyDAO` with `x` as the execution context, so every subsequent call — `put`, `find`, `select`, etc. — runs with the services, permissions, and session data bound to `x` rather than the original context.

```javascript
// Run a query as a different user / session
var scopedDAO = dao.inX(otherContext);
var results = await scopedDAO.select();
```

Typical uses include impersonating a user, switching sessions, or overriding a context-provided service for a specific set of operations. Note that `inX` is unrelated to the `IN` mlang predicate used in queries.

---

## A Note on Abstraction

You may notice that nothing above says anything about *where* the data is stored. That is intentional. The same code works whether the DAO is backed by an in-memory `MDAO`, a journalled `JDAO`, a `JDBCDAO` connected to PostgreSQL, or a `ClientDAO` talking to a remote server.

This is the point. The DAO interface is the complete contract. Code that depends on knowing the underlying storage mechanism is unnecessarily fragile — and it forfeits the caching, authorisation, audit logging, and other layers that FOAM composes transparently above any DAO.

When you find yourself asking "but what database is this DAO using?" — the answer is: it doesn't matter, and designing your code so that it doesn't matter is what makes it fast, portable, and composable.