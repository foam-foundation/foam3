<flow name="JavaImplementations" category="DOC/GUIDE" spid="foam" description="How to write Java logic for FOAM classes: inline javaCode vs. a pure Java file, when each is the right choice, and how to add a client-side companion when the class flows through a client DAO." keywords="java,javaCode,subclass,companion,pom,serialization,400,client dao,javaFiles"/>

# Writing Java Code in FOAM Classes

When a FOAM class needs Java logic — method bodies, custom factories, server-side processing — there are two ways to provide it: inline `javaCode` blocks inside the `foam.CLASS` declaration, or a separate `.java` file that extends the generated Java base. This guide covers both approaches, when to reach for each one, and an important consideration that applies when the class flows between the server and the browser.

---

## Client and server DAOs

Each served DAO is described by a `CSpec` entry in a `.jrl` service journal and instantiated at startup. One entry produces **two** DAO representations: a server-side chain built by `serviceScript`, and a lightweight client stub declared in `client`.

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name": "jobDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(foam.core.job.Job.getOwnClassInfo())
      .setGuid(true)
      .setRuler(true)
      .setJournalType(foam.dao.JournalType.NO_JOURNAL)
      .build();
  """,
  "client": """{ "of": "foam.core.job.Job" }"""
})
```

```
  ┌──────────────────────────────────────────────────────────┐
  │  CSpec: "jobDAO"                                         │
  │                                                          │
  │  serviceScript ──► EasyDAO chain (Java, server-side)    │
  │                    MDAO + Journal + Ruler + Auth + PM    │
  │                                                          │
  │  client ──────────► ClientDAO stub (JS, browser-side)   │
  │                     HTTP proxy to service/jobDAO         │
  └──────────────────────────────────────────────────────────┘
```

The `of` type tells both ends what class the DAO holds. The browser's `ClientDAO` uses it as the default for deserialization; the server's EasyDAO uses it for indexing and authorization.

Objects flow between the two sides as JSON. Every `FObjectProperty` value carries a `"class"` field naming the concrete type, so the receiving side can instantiate the right class. For example, a `BatchJob` whose `delegate` property holds a `FileProcessor` would arrive as:

```json
{
  "class": "foam.core.job.BatchJob",
  "delegate": {
    "class": "com.example.FileProcessor",
    "config": "/data/files"
  }
}
```

When the browser receives this, FOAM's JSON parser reads the `"class"` field on each object and calls `foam.lookup` to instantiate the right type. Both `BatchJob` and `FileProcessor` must be registered in the browser's JS class registry for this to work.

---

## Writing Java implementations

Say you have a FOAM class that declares properties and methods:

```javascript
// Processor.js
foam.CLASS({
  package: 'com.example',
  name: 'Processor',
  properties: [
    { class: 'String', name: 'config' }
  ],
  methods: [
    { name: 'process', args: 'Context x, String item', type: 'String' }
  ]
});
```

You need a Java implementation for `process`. There are two ways.

### Option A — inline javaCode

```javascript
// Processor.js  — with inline Java
foam.CLASS({
  package: 'com.example',
  name: 'Processor',

  methods: [
    {
      name: 'process',
      args: 'Context x, String item',
      type: 'String',
      javaCode: `
        return item.toUpperCase();
      `
    }
  ]
});
```

With `flags: 'js|java'` in `pom.js`, the build generates both `Processor.java` and `Processor.js`. The class is registered in both the Java server registry and the JavaScript client registry automatically.

The downside: Java editors treat `javaCode` as a string literal. No syntax highlighting, no code completion, no refactor support. For small snippets this is fine; for a full implementation with imports and helper methods it becomes awkward.

### Option B — pure Java file

Write a handwritten Java class extending the FOAM-generated `Processor.java`:

```java
// FileProcessor.java
package com.example;

public class FileProcessor extends Processor {

  public FileProcessor() {}
  public FileProcessor(X x) { super(x); }

  @Override
  public String process(foam.lang.X x, String item) {
    // full IDE support — completions, errors, refactoring
    return item.toUpperCase();
  }
}
```

The no-arg constructor is required for FOAM's JSON deserializer (`ClassInfo.newInstance()` uses Java reflection). The `(X x)` constructor chains to `super(x)` for normal creation.

If `FileProcessor` ever reaches the browser — stored in an `FObjectProperty` on a served object — add a companion `.js` so the browser can deserialize it:

```javascript
// FileProcessor.js  — registers the class name in the JS registry
foam.CLASS({
  package: 'com.example',
  name: 'FileProcessor',
  extends: 'com.example.Processor'
});
```

Register both in `pom.js`:

```javascript
foam.POM({
  name: 'process',
  files: [
    { name: 'Processor',     flags: 'js|java' },  // generates Processor.java + registers in JS
    { name: 'FileProcessor', flags: 'js' }         // companion only — no Java generation
  ],
  javaFiles: [
    { name: 'FileProcessor' }  // compiles the handwritten Java
  ]
});
```

`flags: 'js'` on the companion registers it in the client bundle without generating a Java stub. Using `flags: 'js|java'` would generate a Java stub that conflicts with the handwritten file.

| pom.js entry | JS bundle | Java server |
|---|---|---|
| `files: [{ flags: 'js' }]` + `javaFiles` | ✓ | ✓ (handwritten) |
| `files: [{ flags: 'js\|java' }]` | ✓ | ✓ (generated) |
| `javaFiles` only | — | ✓ |

This covers the common case. When `Processor` has `abstract: true`, there is more to handle — the next section covers it.

---

## When the base class is abstract

The companion pattern above assumes the FOAM base (`Processor`) is concrete — the class the browser deserializes and the class the Java implements share the same name. When the base is `abstract: true`, the browser can never instantiate it directly, and the Java side cannot either. You need a separate concrete subclass.

The FOAM convention is to prefix the abstract class with `Abstract`:

```javascript
// AbstractProcessor.js  — abstract base, flags: 'js|java'
foam.CLASS({
  package: 'com.example',
  name: 'AbstractProcessor',
  abstract: true,
  properties: [ { class: 'String', name: 'config' } ],
  methods:    [ { name: 'process', args: 'Context x, String item' } ]
});
```

The concrete implementation is a separate handwritten Java file with its own companion:

```javascript
// FileProcessor.js  — companion for the concrete Java class
foam.CLASS({
  package: 'com.example',
  name: 'FileProcessor',
  extends: 'com.example.AbstractProcessor'
});
```

```java
// FileProcessor.java
public class FileProcessor extends AbstractProcessor {

  public FileProcessor() {}
  public FileProcessor(X x) { super(x); }

  @Override public foam.lang.ClassInfo getClassInfo()    { return foam.lang.ClassInfoImpl.forClass(getClass()); }
  public static foam.lang.ClassInfo    getOwnClassInfo() { return foam.lang.ClassInfoImpl.forClass(FileProcessor.class); }

  @Override
  public void process(foam.lang.X x, String item) { ... }
}
```

The two extra members — the constructors and the ClassInfo pair — are required because of how FOAM serialization works, explained in the next section.

---

## Handwritten subclass requirements

A handwritten Java class that extends a FOAM-generated abstract base needs two things before it can round-trip through a DAO.

### Constructors

FOAM's JSON parser instantiates objects via `ClassInfo.newInstance()`, which uses Java reflection's no-arg constructor. Without one, deserialization throws `InstantiationException`. Always provide both: a no-arg constructor for the deserializer, and an `(X x)` constructor that chains to `super(x)` for normal use:

```java
public FileProcessor() {}
public FileProcessor(X x) { super(x); }
```

### ClassInfo

Every FOAM-generated class has a static `classInfo_` that records its fully-qualified name. A handwritten subclass inherits the **parent's** `classInfo_`. When FOAM serializes an instance it calls `getClassInfo().getId()` to write the `"class"` field — so without an override, every `FileProcessor` instance serializes as `"class":"com.example.AbstractProcessor"`. The server then tries to instantiate the abstract class and throws `InstantiationException`.

Use `ClassInfoImpl.forClass()`, which derives the ID from the Java class name and caches the result:

```java
@Override public foam.lang.ClassInfo getClassInfo()    { return foam.lang.ClassInfoImpl.forClass(getClass()); }
public static foam.lang.ClassInfo    getOwnClassInfo() { return foam.lang.ClassInfoImpl.forClass(FileProcessor.class); }
```

`forClass` caches by class so the `ClassInfo` is built once. The class reference in `getOwnClassInfo()` also drives parent ClassInfo discovery: `ClassInfoImpl.getParent()` reflects on `getObjClass().getSuperclass()` and calls `getOwnClassInfo()` on it, so all parent property axioms are inherited without repeating them.

### Keep properties in the FOAM model

Reserve the handwritten Java class for method implementations. New FOAM properties — anything that needs to be serialized, displayed in the UI, or round-tripped through a DAO — belong in the FOAM `.js` model. A property added to the Java class without a registered axiom on its ClassInfo is invisible to the serializer and silently dropped on every round-trip.

For internal implementation state that is intentionally not serialized — a counter, a temporary buffer, a helper object — a plain Java field is fine:

```java
private int processedCount = 0; // internal only, not in ClassInfo, never serialized
```

This is safe precisely *because* it is not in ClassInfo. The serializer ignores it, no client sees it, and there is no round-trip concern.

---

## What happens when the companion is missing

If the client side companion is absent and the class is the `of` of a served DAO, the problem is immediate: the browse view fails to render because the browser cannot instantiate the rows at all. You notice straight away.

When the class appears as a **property value** on a served object rather than the top-level `of`, the failure is much harder to spot. Consider a `BatchJob` in `jobDAO` where the `delegate` property holds a `FileProcessor`. The browser receives the `BatchJob` JSON, successfully instantiates a `BatchJob` (which *is* in the JS registry), and displays it. The view renders correctly because `BatchJob`'s own properties are all present. The missing `FileProcessor` just silently becomes `null`.

```
  Browser                                           Server
  ──────────────────────────────────────────────────────────
  ClientDAO.find(id)   ──── GET /service/jobDAO ──► MDAO
                       ◄─── JSON (with "class" fields) ───

  foam.lookup("foam.core.job.BatchJob")    → BatchJob  ✓
  foam.lookup("com.example.FileProcessor") → null      ✗
                                                  (not in JS bundle)
  obj.delegate = null   ← silent, no error
```

Nothing looks wrong. The job row is visible and the status is current. The failure surfaces only when the user triggers a write-back — an action that calls `X.jobDAO.put(this)`. The client serializes the `BatchJob` with `"delegate": null` and the server returns 400.

```
  ClientDAO.put(obj)   ──── PUT { "delegate": null } ──► 400
```

The 400 arrives far from where the class was first fetched, pointing at a write operation that looks unrelated to the missing companion.

---

## When you need a companion

A Java subclass needs a JS companion whenever an instance of that class can reach the browser:

- The class is the `of` of a served DAO.
- The class is stored in an `FObjectProperty` on an object in a served DAO.
- The class is nested inside another served object.

If the class is **entirely server-side** — a background worker, an internal pipeline stage, something a browser never touches — a `javaFiles` entry is fine.

A quick check: trace the class from the service definition inward. If any served DAO's `of` or any property on a served type transitively holds this class, it needs a companion. The companion file itself stays minimal — its only job is to register the class name so the browser can round-trip it.
