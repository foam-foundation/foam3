---
name: foam-model-builder
description: >-
  Author a FOAM model and wire it into the build — the `foam.CLASS` skeleton, choosing property classes, `id` and sequence numbers, the `services.jrl` DAO config, and the `pom.js` entry that makes it compile. Use when creating a model, adding properties to an existing one, setting up a DAO for it, or working out why a new model does not appear at runtime. Views are in `foam-view-builder`; framework-level design decisions are in the FOAM design guides.
---

# Authoring a FOAM Model

Four steps: write the model, choose property classes, register a DAO, wire it into the POM.
Skipping the last one is the usual reason a new model "does not exist" at runtime.

## 1. Model skeleton

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'Transaction',
  properties: [
    { class: 'Long', name: 'id' },
    { class: 'String', name: 'accountId', aliases: ['account_id'] }
  ],
  methods: [...]
});
```

- `package` + `name` form the class id (`com.example.Transaction`). That id is written into
  journals, `services.jrl`, and every `of:` reference — it is the model's identity on disk.
- `aliases` lets journal or upload data arrive under a different key (`account_id` →
  `accountId`) without a transform in between.

**Renaming a class breaks every existing journal.** FOAM3 has no class-alias mechanism:
`context.lookup("com.old.ClassName")` asserts if the class is not registered, and there is no
`classAliases`, no `legacyClassNames`, no `foam.registerClassAlias()`. Evolve in place — add
new properties, hide old ones, migrate values via `javaPostSet` on the deprecated property.

## 2. Property types

**Verify the exact class name in `foam3/src/foam/lang/types.js` before use.** The names are
case-sensitive and several near-misses do not exist.

Common: `String`, `Int`, `Long`, `Float`, `Double`, `Boolean`, `Date`, `DateTime`, `DateTimeUTC`.

- `DateTimeUTC` is correct (all caps); `DateTimeUtc` is not a class.
- `DateTime` renders in the viewer's local timezone; `DateTimeUTC` renders in UTC. Pick by
  what the value means, not by what looks right in your own timezone.

**Do not restate a type's own default.** `String` → `''`, `Boolean` → `false`,
`Int`/`Long`/`Float`/`Double` → `0`, `Array` → `[]`. Writing these adds noise and, for
properties where "unset" is meaningful, defeats the `propertyNameIsSet_` check.

## 3. `id` and sequence numbers

- `id` should be `Long`, not `String`: `{ class: 'Long', name: 'id' }`.
- **Never put `setSeqNo: true` on a model property.** Sequence numbers are a DAO concern —
  configure them in `services.jrl` through the EasyDAO builder:

  ```
  return new foam.dao.EasyDAO.Builder(x).setSeqNo(true).setOf(MyModel.getOwnClassInfo()).build();
  ```

- When the source data carries its own preserved identifiers, keep them and declare a
  multi-part key instead: `ids: ['seq']`.

## 4. Register the DAO in `services.jrl`

`services.jrl` defines DAO configuration — persistence, identifiers, journal file. Place it in
the same directory as the models it serves; it is picked up from there automatically.

- `.setSeqNo(true)` — auto-incrementing identifiers
- `.setPm(true)` — wrap in PMDAO for performance measurement
- `.setJournalName("filename")` — the journal file backing the DAO
- `.setOf(YourModel.getOwnClassInfo())` — binds the DAO to the model

## 5. Wire it into the POM

`pom.js` files declare projects, dependencies, and per-file flags:

```javascript
foam.POM({
  name: 'projectname',
  projects: [...],
  files: [ { name: 'MyModel', flags: 'js|java' } ],  // 'js', 'java', 'web', or combos
  javaDependencies: [...]
});
```

Add the model to the **nearest parent `pom.js`** — find it by searching for a sibling file's
name. Flags select which targets the file is generated for:

| File type | Where | Flag |
|-----------|-------|------|
| FOAM class (JS + Java) | `files:` | `"js\|java"` |
| JS only | `files:` | `"js"` |
| Java only (a real `.java` file) | `javaFiles:` | (none, or `"test"`) |
| Dual implementation (separate JS and Java files) | BOTH | `"js"` in `files:`, entry in `javaFiles:` |
| Test files | either | append `&test` |

A `.jrl` in the same directory as the `pom.js` auto-loads — do **not** add it to the POM.
`journalFiles:` is only for pulling journals in from another directory, which is rare.

## Further reading

- `foam3/doc/guides/POM.md` — the POM format in full
- `foam3/doc/guides/EasyDao.md`, `foam3/doc/guides/Services.md` — DAO configuration
- `foam3/doc/guides/PropertyGotchas.md` — when `postSet` never fires, expressions going cold,
  the `isSet` gate, what `transient` cascades into
- `foam3/doc/guides/DaoGotchas.md` — decorator ordering, frozen results, context scoping
- `foam3/doc/guides/Journals.md` — journal format and replay

## Project-specific rules

An application built on foam3 may add its own model conventions — scoping properties, required
audit fields, naming rules. Those live in that project's own `foam-model-builder` skill, which
takes precedence outside `foam3/`, or in the nearest `CLAUDE.md`. Check there before assuming
this guide is complete for the repository you are in.
