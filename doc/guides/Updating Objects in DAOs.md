# Updating Objects in a DAO

## Table of Contents
1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Architecture](#architecture)
4. [Key Concepts](#key-concepts)
5. [How It Works](#how-it-works)
6. [Usage](#usage)
7. [Gotchas](#gotchas)

---

## Quick Start

To change a stored object, read it, copy it, edit the copy, then write the copy back:

```javascript
var obj   = await dao.find(id);   // 1. read  (the returned object is frozen)
var clone = obj.clone();          // 2. copy  (a mutable duplicate)
clone.status = 'DONE';            // 3. edit  (set the exact property)
await dao.put(clone);             // 4. write (this is the save)
```

The `put` is the step people miss. A DAO does not watch your object for changes. It only records what you hand back to it. No `put`, no update.

---

## Overview

### What It Does

A DAO (Data Access Object) is the read/write interface to a collection of objects. Updating works the same way as creating: you call `put` with an object that carries the `id` you want to replace. The DAO overwrites the stored value with the one you pass.

The twist is that objects coming *out* of a DAO are frozen. You cannot edit them in place. You clone first, edit the clone, and put the clone back.

### Key Files

| File | Purpose |
|------|---------|
| `foam/lang/FObject.js` | Defines `clone` and `copyFrom` for the JavaScript side |
| `foam/lang/FObject.java` | Defines `fclone`; throws `Object is frozen.` from `assertNotFrozen` |
| `foam/dao/MDAO.java` | In-memory DAO; clones and freezes objects on store |
| `foam/dao/MapDAO.java` | Map-backed DAO; calls `obj.freeze()` on store |
| `foam/dao/FreezingDAO.js` | Decorator that freezes objects passing through |

---

## Architecture

A DAO is rarely a single object. It is a stack of decorators wrapping a storage core. A `put` travels down the stack, so validation, authorization, logging, and journaling all run on the object you hand in:

```
+-------------------------------------------------------------+
|                          DAO Stack                          |
|                                                             |
|   put(clone)                                                |
|      |                                                      |
|      v                                                      |
|  +-------------+   +-------------+   +-------------------+  |
|  | Validating  |-->|   Auth /    |-->|   Logging /       |  |
|  | Decorator   |   |  Permission |   |   Journaling      |  |
|  +-------------+   +-------------+   +-------------------+  |
|                                            |                |
|                                            v                |
|                                   +-----------------+       |
|                                   |  Storage Core   |       |
|                                   |  (MDAO / MapDAO)|       |
|                                   |  clone + freeze |       |
|                                   +-----------------+       |
+-------------------------------------------------------------+
```

The storage core freezes what it keeps. `MDAO.java` clones and freezes on the way in; `MapDAO.java` calls `obj.freeze()`. That frozen instance is what later `find` and `select` calls return, and it may be shared across threads, which is why mutating it is unsafe.

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| `frozen` | A stored object is read-only. Calling a setter on it fails. The DAO caches and shares these instances, so editing one would corrupt shared state. |
| `clone` / `fclone` | Produces a mutable, independent copy. `clone` is the JavaScript method; `fclone` is the Java method. |
| `copyFrom` | Bulk-applies property values from a map or another object onto a target. Useful for refreshing a live object after a write returns. |
| `put` / `put_` | Writes an object into the DAO, keyed by `id`. `put` uses the object's context; `put_(x, obj)` takes an explicit context. |
| `id` | The key that decides insert versus update. Same `id` replaces the existing row; new `id` inserts. |
| `put` return value | `put` returns the stored object (often re-frozen, sometimes enriched by decorators). Use it, do not assume your input is now the source of truth. |

---

## How It Works

### Flow for updating an Object

```
+----------+    +----------+    +-----------+    +---------+    +---------+
|  find /  |--->|  clone   |--->|  set the  |--->|  put    |--->| stored  |
|  select  |    | (mutable |    |  property |    | (clone) |    | & frozen|
| (frozen) |    |  copy)   |    |  you want |    |         |    |  again  |
+----------+    +----------+    +-----------+    +---------+    +---------+
     ^                                                              |
     |                       returns the saved object               |
     +--------------------------------------------------------------+
```

Read returns a frozen object. Clone makes it editable. You set the exact properties. Put hands the clone to the DAO stack, which validates, authorizes, journals, and stores it, re-freezing the result. The value `put` returns is the canonical stored object.

### Why the clone is required

The storage core deliberately freezes objects so they can be cached and shared safely. A getter on a frozen object works; a setter does not. On the Java side, the setter path runs `assertNotFrozen`, which throws `Object is frozen` when the object is frozen. On the JavaScript side, you would be mutating an instance the DAO still holds and shares, which silently corrupts cached state. Cloning sidesteps both problems: you own the copy outright.

### Why the put is required

Cloning and editing change nothing in storage. The clone is a private copy in your code. The DAO has no reference to it and no change listener on it. The update becomes real only when you call `put`, which sends the clone through the decorator stack down to the storage core. Treat `find` as read, `clone`/edit as staging, and `put` as commit.

---

## Usage

### JavaScript: read, clone, edit, put
   
```javascript
var fresh = await dao.find(id);   // frozen
var clone = fresh.clone();        // mutable copy
clone.status        = 'APPROVED';
clone.reviewedBy    = currentUser;
await dao.put(clone);             // committed
```

Re-reading with `find` right before the clone is a good habit. It reduces the window in which another writer changed the record between your read and your write.

### JavaScript: refresh a live object from the write result

When the same object instance must reflect what was stored (for example, a view model bound to the UI), copy the returned value back onto it:

```javascript
var saved = await dao.put(clone);
this.copyFrom(saved);   // pull stored values, including any set by decorators
```

`copyFrom` accepts either a plain map or another object and applies only the properties the two share, ignoring null and undefined values.

### Java: read, fclone, edit, put_

```java
MyModel frozen = (MyModel) dao.find(id);
MyModel clone  = (MyModel) frozen.fclone();   // mutable copy
clone.setStatus("APPROVED");
dao.put_(x, clone);                           // committed with explicit context
```

Use `put_(x, obj)` when you need to pass a specific context, such as inside a service, decorator, or rule. Use `put(obj)` when the object's own context is correct.

### Java: update many in a loop

Each object from a `select` is frozen, so clone inside the loop before editing:

```java
List<MyModel> rows = ((ArraySink) dao.select(new ArraySink())).getArray();
for ( MyModel row : rows ) {
  MyModel clone = (MyModel) row.fclone();
  clone.setProcessed(true);
  dao.put_(x, clone);
}
```

### JavaScript: update many in a loop

`select` with no sink resolves to an `ArraySink`; read its results from `.array`. Each object in that array is frozen, so clone inside the loop before editing, and `await` each `put`:

```javascript
var sink = await dao.where(M.EQ(MyModel.PROCESSED, false)).select();
for ( var row of sink.array ) {
  var clone = row.clone();   // each row from select() is frozen
  clone.processed = true;
  await dao.put(clone);
}
```

The same rule as the single-object case applies per row: clone, edit the clone, put the clone. Putting `row` directly would either fail on the frozen instance or write back an object the DAO still shares.

### Choosing find versus select

| Need | Use |
|------|-----|
| One object by `id` | `dao.find(id)` |
| One object by predicate | `dao.find(predicate)` |
| A list to iterate | `dao.select(new ArraySink())` |

