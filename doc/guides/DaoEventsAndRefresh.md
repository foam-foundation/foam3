# DAO Events & Refresh

## How a change reaches the screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DAO EVENT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

   write (put / remove / removeAll)
        │
        ▼
  ┌───────────────┐   pub('on', 'put' | 'remove' | 'reset')
  │  leaf DAO     │ ──────────────────────────┐
  │ (MDAO, client)│                            │  event bubbles UP
  └───────────────┘                            │  (each decorator forwards 'on')
        ▲                                       │
        │ delegate                              ▼
  ┌───────────────┐                    ┌──────────────────┐
  │  CachingDAO   │ ◄───────────────── │   FilteredDAO    │
  │  ProxyDAO ... │                    │   OrderedDAO ... │
  └───────────────┘                    └────────┬─────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────┐
                                      │   view (listen)  │  any event →
                                      │  DAOSlot / table │  re-select → re-render
                                      └──────────────────┘
```

A DAO fires an event when its data changes. Decorators relay it up the chain.
The view listening at the top re-reads and re-renders. You only step in when no
event fires on its own (server changed, or you want an on-demand reload).

## The 3 events

The `on` topic is declared once on the base class (`dao/AbstractDAO.js:44`). A DAO
publishes against it; subscribers register with `on` (JS) or a listener (Java):
```js
topics: [ { name: 'on', topics: [ 'put', 'remove', 'reset' ] } ]
```

| Event | Fires when | Payload |
|-------|-----------|---------|
| `put` | one row added / updated | the object |
| `remove` | one row deleted | the removed object |
| `reset` | bulk / opaque change, re-read from scratch | none |

> `removeAll` fires one `remove` **per row** (`MDAO.removeAll_:205`), not one `reset`.
> JS subscribes against the `on` topic; Java registers a `listeners_` list (`AbstractDAO.js:691-728`).

## Subscribe

```
dao.listen(sink)         all 3 events → sink     ← views use this
dao.on.put.sub(fn)       one event type only
```

```js
this.onDetach(dao.listen(mySink));                       // preferred, all events
this.onDetach(dao.on.put.sub((sub,on,evt,obj) => {...})); // one type; ALWAYS onDetach or it leaks
```

Views wire this for you: `DAOSlot.js:59`, `GroupingDAOList.js:83` (re-selects on any event).

## Refresh: what to do when

```
   Need the view to update?
        │
        ├─ changed it via dao.put()? ............ do nothing  (event auto-fires)
        │
        ├─ re-read, data already correct in RAM . dao.on.reset.pub()
        │
        ├─ re-read everywhere, no cache ......... dao.cmd(DAO.RESET_CMD)
        │
        └─ server changed / cache is stale ...... dao.cmd(DAO.PURGE_CMD)
```

| Call | Travels | Re-reads from |
|------|---------|---------------|
| `dao.on.reset.pub()` | this level only | current chain (cache) |
| `dao.cmd(DAO.RESET_CMD)` | down to client DAO, reset bubbles up to all listeners (`RequestResponseClientDAO.js:121`) | client cache |
| `dao.cmd(DAO.PURGE_CMD)` | down to CachingDAO (`CachingDAO.cmd_:143`) | **server** |

- Use public `cmd`, not `cmd_` (it supplies context). Constants: `dao/DAO.js:28`/`:39`.
- Cmd/pub on the **same instance the view holds**. A `where()`/`inX()` wrapper relays from its base, so the base reaches it; a *different* instance does not.

## The cache trap

`EasyDAO` with `cache:true` reads from an in-memory cache, writes through to source.
So `RESET` re-reads the **stale cache** and shows nothing. `PURGE` is required.

```
dao.cmd(PURGE_CMD)
   → CachingDAO.onSrcReset()                     (CachingDAO.js:177)
       ├─ cache.removeAll()       → per-row 'remove' → bubbles up → view shrinks
       └─ clearPrivate_('delegate') → next select re-fetches from SERVER → 'put' → view fills
```

Nobody pubs a literal `reset`. PURGE empties the cache, the cache MDAO fires `remove`/`put`,
and those drive the view.

## Cheat sheet

```js
this.onDetach(dao.listen(sink));      // react to all changes (preferred)
this.onDetach(dao.on.put.sub(fn));    // react to one event type

dao.on.reset.pub();                   // local re-select (memory data only)
dao.cmd(foam.dao.DAO.RESET_CMD);      // reset whole stack + all listeners (re-reads cache)
dao.cmd(foam.dao.DAO.PURGE_CMD);      // dump cache, re-pull from server

this.pub('on', 'put', obj);           // publish (custom leaf DAO only, after the mutation)
```

- Cmd/pub on the **same instance** the view listens to.
- Cached DAO + server changed elsewhere → **PURGE**, not RESET.
- Always `onDetach` a raw `on.*.sub`.
