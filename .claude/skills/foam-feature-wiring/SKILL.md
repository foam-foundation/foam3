---
name: foam-feature-wiring
description: >-
  Use when adding a DAO-backed feature to a FOAM3 application — a model plus its served DAO, menu, permission grant, POM entries and tests — or when a feature compiles and boots but its menu is invisible, its DAO is missing from a picker, its journal never loads, or its test never runs. Covers the CSpec contract in `services.jrl`, the DAO-name and `lazy` defaults, what EasyDAO derives on its own, catalogue-versus-grant permissions, the POM sub-directory skip rule, and test registration. The model itself is in `foam-model-builder`; design questions are in `foam-design-patterns`.
---

# FOAM feature wiring

Adding a DAO-backed feature touches six or seven files, and most of the ways it goes wrong are
silent: the code compiles, the server boots, and the feature is invisible or unreachable. Nothing
warns, because journals are only validated at replay, permissions are only consulted per request,
and the build walk skips directories without a message.

This is the checklist plus the framework mechanics behind each item. Every claim cites
`src/...` or `tools/...` in this repository. It is deliberately silent on what the feature *does* —
the model's shape is `foam-model-builder`'s subject, and design is `foam-design-patterns`'.

## The checklist

| # | File | What goes in it |
|---|---|---|
| 1 | `<pkg>/<Model>.js` | The model — see `foam-model-builder` |
| 2 | `<pkg>/pom.js` | Model entry, usually `flags: 'js\|java'` — Java is needed for `getOwnClassInfo()` in a `serviceScript` |
| 3 | `<pkg>/services.jrl` | The CSpec that serves the DAO — **name must end in `DAO`** |
| 4 | `<pkg>/menus.jrl` | `DAOMenu2` pointing at the `daoKey`, with `parent:` set |
| 5 | `permissions.jrl` | Catalogue rows — **enforces nothing**, see below |
| 6 | A grant | Module entry or `GroupPermissionJunction` — **this is the enforced one** |
| 7 | `<pkg>/test/` | Test + its own `pom.js` + `tests.jrl`, and a `projects:` entry in the parent |

`.jrl` files auto-load from the directory containing their `pom.js` — do not list them in the POM.

## The five silent failures

### 1. A CSpec whose name does not end in `DAO` is invisible to pickers

`CSpec.SERVED_DAOS` is a canned query: `AND(EQ(SERVE, true), ENDS_WITH(NAME, 'DAO'))`
(`src/foam/core/boot/CSpec.js`, `SERVED_DAOS`, ~line 68). Every UI that offers "pick a served DAO"
is built from it. A CSpec named `customerRecords` serves correctly, is reachable by key, and never
appears in the list.

Name it `customerRecordDAO`.

### 2. `lazy` defaults to `true`

`CSpec.lazy` is `value: true` (`CSpec.js`, ~line 138). A service that must run at boot — a poller,
a listener, anything whose `COREService.start()` should fire — gets nothing until the first
`x.get(name)`. Set `lazy: false` explicitly.

### 3. A sub-directory with its own `pom.js` is skipped entirely

`tools/pmake.js`, `processDir`, ~line 82:

```javascript
if ( skipIfHasPOM && files.find(f => f.name.endsWith('pom.js')) ) {
  return;
}
```

The walk stops at any directory that has its own `pom.js`, dropping **both its sources and its
`.jrl` files**, unless the parent POM lists it in `projects:`. Two valid shapes:

```javascript
// A: sub-directory has NO pom.js — reference its files path-prefixed
files: [ { name: 'parsers/MyThing', flags: 'js' } ]

// B: sub-directory HAS a pom.js — the parent must claim it
projects: [ { name: 'parsers/pom' } ]
```

Symptom: a file you can see on disk behaves as if it does not exist, and no error names it.

### 4. The permission catalogue enforces nothing; the grant does

Two different things, and only one is consulted at request time.

- **`permissions.jrl`** holds `foam.core.auth.Permission` rows. They feed the permission-picker UI.
  Enforcement never reads them — `Group.implies` selects only from the `GroupPermissionJunction`
  DAO (`src/foam/core/auth/Group.js`, `implies`, ~line 178). Omitting a catalogue row is a
  convention miss, not a breakage.
- **The grant** — a module entry or a `GroupPermissionJunction` — is what gates access. It needs
  `menu.read.<menuId>` for the menu, **and the bare `service.<cspecName>`** for the DAO, which is
  what `CSpec` checks when `authenticate: true` (`CSpec.js`, `auth.check(x, "service." + getName())`,
  ~line 340).
- **Grant the ancestor menu too.** A leaf menu is unreachable if its parent SubMenu is not granted.

A catalogue row's id must match the menu id character-for-character — a mismatch is a permission
that can never match anything, and nothing reports it.

**Why this is invisible in development:** `admin` and `system` hold `targetId: "*"`
(`src/groupPermissionJunctions.jrl:2` and `:5`). An ungranted feature works for you and is invisible
to every ordinary user. Test as a real role, or read the grants.

### 5. A JS test without `language: 0` is handed to the wrong runner

`Script.language` defaults to `BEANSHELL` (`src/foam/core/script/Script.js`, ~line 256). A
`tests.jrl` entry for a JS test therefore states it:

```javascript
p({ "class": "com.example.MyTest", "id": "MyTest", "language": 0 })
```

The parent POM must reference the test project in **object form**, because only an object carries
flags:

```javascript
projects: [ { name: 'test/pom', flags: 'test' } ]   // carries the test flag
projects: [ 'test/pom' ]                            // a string has no flags
```

Without the flag the walk skips any directory named `test` or `tests` (`pmake.js`, ~line 94) and
`JournalMaker` skips `tests.jrl` (`tools/JournalMaker.js`, ~line 63). The test is never registered
and never reported as missing.

## `services.jrl` — the CSpec contract

Three ways to produce the service object; precedence is explicit (`CSpec.js`, ~lines 303–314):
`service` beats `serviceClass` beats `serviceScript`. `language` defaults to `BEANSHELL`.

```
p({
  "class": "foam.core.boot.CSpec",
  "name": "customerRecordDAO",
  "serve": true,
  "authenticate": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.CustomerRecord.getOwnClassInfo())
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .setJournalName("customerRecords")
      .setPm(true)
      .build();
  """,
  "client": """
    { "of": "com.example.CustomerRecord", "daoType": "CLIENT",
      "serviceName": "service/customerRecordDAO" }
  """
})
```

**The `client` block is required for anything a browser reads.** Without it the client context has
no stub for the `daoKey` the menu names, and the menu renders empty.

**`init_()` runs only on the Builder path.** It is called from exactly one place — the generated
Builder's `build()` (`src/foam/java/Builder.js:86`, `buildBody += 'obj.init_(); return obj;'`).
Both alternatives skip it: `service` is JSON-deserialized, `serviceClass` is
`Class.forName(...).newInstance()`. Converting a `serviceScript` to a `serviceClass` "because
construction is simple" silently drops the class's own initialization.

**Do not restate what `EasyDAO` derives.** Interface-implied decorators are computed from the model
— `EasyDAO.js` (~lines 870–880) sets each via a `javaFactory` returning
`getEnableInterfaceDecorators() && getOf().isAssignableTo(...)`. Forcing the flag by hand is
redundant if the model implements the interface and dead if it does not. Same for indexing the id
property: `MDAO` adds it at construction (`src/foam/dao/MDAO.js`, `addPropertyIndex`, ~line 72).
Declare the multi-column indexes your queries need instead.

## Journals: `p()` vs `c()`

`p({...})` is a partial merge across journals; `c({...})` is a full replace. A later journal that
uses `c()` on a CSpec silently clobbers every field the first journal set. Prefer `p()` unless you
intend replacement.

Editing a CSpec's `service`, `serviceClass`, or `serviceScript` at runtime calls `reload()` on a
`COREService`; editing any other CSpec field does not
(`src/foam/core/boot/CSpecFactory.java`, ~lines 185–193).

## Order of operations when debugging "it does not show up"

Work outward from the data; each step rules out one silent failure.

1. **Does the DAO exist in the context?** Look it up by key. If not, the CSpec did not load: check
   the POM claims the directory (§3) and the journal sits beside a `pom.js`.
2. **Does it appear in a served-DAO picker?** If not, the name does not end in `DAO` (§1).
3. **Does the menu render for an ordinary user?** If not, the grant is missing (§4). Check as a real
   role, never as `admin`.
4. **Does the menu render but show nothing?** The `client` block is missing.
5. **Do rows exist but not for this user?** A decorator is scoping them (a tenant or partition key
   a DAO decorator stamps) and the rows were written without that field set.
6. **Did the test not run?** `language: 0`, the object-form `projects:` entry, and the `test` flag
   (§5).
