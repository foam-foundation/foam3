---
name: browser-script
description: Use when writing a script to paste into the browser console of a running FOAM app - to query or explore a DAO, count or group records, run a bulk update or removal with a dry run, export a DAO as .jrl or JSON, or diagnose data - or when the user says "browser console", "paste in console", "run it on staging/prod".
---

# Browser console scripts

A FOAM app's console has `x`, the client context with every DAO and service, and `MLang`, a ready
`foam.mlang.Expressions`, both set by `ApplicationController` (`globalThis.x`, `globalThis.MLang`).
A script reads `x.someDAO` directly and never redeclares `x`; the controller itself is `x.ctrl`.

## Before writing

- Read the model for every property the script names, and `services.jrl` for every DAO name. A DAO
  name does not always follow `<model>DAO`; a wrong one fails inside an `await` as
  `Cannot read properties of undefined`, which costs the user a paste-and-test round. A name that
  cannot be found in `services.jrl` is reported, never guessed.
- Check for an action on the model that already does the job before reimplementing it in a script.

```bash
grep -rn '"name":\s*"<daoName>"' --include="*.jrl" .                       # the DAO row
grep -rn 'setOf(.*\.<Model>\.getOwnClassInfo' --include="*.jrl" -B 5 . | grep '"name"'   # from the model
```

## Shape

Destructive: a named function with an `execute` argument, dry by default, auto-run dry on paste.
Read-only: an async IIFE.

```javascript
// [Title] - paste in the browser console on [environment]
// DRY RUN:  revertBatch()       logs what would change, changes nothing
// LIVE RUN: revertBatch(true)   does it
async function revertBatch(execute) {
  var E    = MLang;                                       // or foam.mlang.Expressions.create()
  var dry  = ! execute;
  var Row  = foam.lookup('pkg.MyModel');                  // the model behind x.myDAO
  var rows = (await x.myDAO.where(E.EQ(Row.STATUS, 'FAILED')).select()).array;

  for ( var r of rows ) {
    if ( dry ) { console.log('[DRY] would remove ' + r.id); continue; }
    try { await x.myDAO.remove(r); console.log('removed ' + r.id); }
    catch (e) { console.error(r.id, e); }                 // one failure never aborts the loop
  }

  console.log('total ' + rows.length + (dry ? ' to remove; run revertBatch(true)' : ' removed'));
}
revertBatch();
```

```javascript
(async function() {
  var Row      = foam.lookup('pkg.MyModel');
  var byStatus = await x.myDAO.select(MLang.GROUP_BY(Row.STATUS, MLang.COUNT()));
  for ( var k of byStatus.groupKeys ) console.log(k, byStatus.groups[k].value);
})();
```

## Patterns

| Need | Code |
|---|---|
| expressions | `MLang`, already there; or `var E = foam.mlang.Expressions.create();` |
| every row | `(await dao.select()).array` |
| filter | `dao.where(E.EQ(Model.FIELD, v))`, `E.IN(Model.FIELD, [...])` |
| count / sum / min / max | `(await dao.select(E.COUNT())).value`, `E.SUM(Model.AMOUNT)`, `E.MIN(...)`, `E.MAX(...)` |
| per group | `var g = await dao.select(E.GROUP_BY(Model.KEY, E.COUNT())); g.groupKeys; g.groups[k].value` |
| one row per distinct value | `(await dao.select(E.UNIQUE(Model.FIELD, foam.dao.ArraySink.create()))).delegate.array` |
| a page | `dao.orderBy(Model.CREATED).skip(1000).limit(500)` |
| exists | `await dao.find(predicate)` |
| model class by name | `foam.lookup('pkg.Model')`; a property is `Model.UPPER_SNAKE` |
| remove a set | `await dao.where(predicate).removeAll()`, inside the dry-run function only |
| drop a client cache | `dao.cmd(foam.dao.DAO.RESET_CMD)` |
| hand the result over | `await navigator.clipboard.writeText(JSON.stringify(result, null, 2))` |

`select` answers with the sink to read, so the result is what `await dao.select(...)` returns, never
the sink built beforehand. A count or a group is a sink the server answers; an `ArraySink` walked
in the browser to count it moves every row to the tab first.

One question per DAO, not one per entity. A loop of `select` per id is N round trips; the same
question is one `IN(key, ids)` predicate under one `GROUP_BY(key, sink)`, and an absent key means
zero:

```javascript
var g = await targetDAO.where(E.IN(Row.SOURCE_ID, ids)).select(E.GROUP_BY(Row.SOURCE_ID, E.COUNT()));
```

## Export a DAO

Two paths, picked by where the DAO lives; `foam3/src/foam/core/reflow/DownloadDAOAgent.js` is the
reference, switching on `dao.cmd('serviceName?')`.

A DAO served by a CSpec goes through DIG, which serializes on the server, never builds the rows in
the tab, and runs as the pasting user, so their row and column permissions still apply:

```javascript
var url  = origin + '/service/dig?dao=myDAO&format=jsonj&limit=0&sessionId=' + x.sessionID;
var text = await (await fetch(url)).text();     // one p({...}) per line, ready as a .jrl
```

`limit=0` streams the whole DAO for a session with `service.dig.read-all-records`; without that
permission the page silently stays at 1000 rows (`DigFormatDriver.js`), so a response of exactly
1000 is checked against `COUNT()` and paged with `&skip=N`. Formats: `jsonj`, `json`, `csv`,
`xml`; `&q=<MQL>` filters, `&columns=a,b` projects.

A client-only DAO (a Reflow block's MDAO, a transform result) goes through an export driver, which
selects into the browser first and holds to tens of thousands of rows:

```javascript
var text = await foam.core.export.JSONJDriver.create({}, x).exportDAO(x, clientDAO);
```

## Safety

- A destructive script runs dry on paste and only mutates when called with `true`; it never runs
  itself live.
- Each mutation logs the id and the change; the end prints total, changed, skipped, errors.
- A DAO or model that is missing returns an error object rather than throwing from an `await`.
- One record's failure is caught and logged; the loop continues.
