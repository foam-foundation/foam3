# Services

Lifecycle, rate limiting, modelling, and the read-as-authorization idiom. A service that holds a
connection, a credential, or a timer is reviewed for what happens when its config changes and
when the JVM stops.

| Principle | One-line test |
|---|---|
| A held resource lives behind `COREService` | does construction open anything that a restart would leak? |
| `reload()` fires on three CSpec fields only | which field did you edit — `service`, `serviceClass`, `serviceScript`, or another? |
| `stop()` runs only from the JVM shutdown hook | is there a durable flush that has no other path? |
| Rate-limit through a `Throttle` CSpec; it blocks the caller | is `throttle()` called inside a lock or from a request thread you care about? |
| Model the service; `client: true` generates the client | is there a bare `.java` service, or a new hand-written `Client<Name>Service.js`? |
| Read is the authorization check | any `canRead`-shaped helper, or a `dao.find(id)` without `inX(x)`? |

### A connection, credential, or timer lives behind `COREService`
Without a lifecycle a config change needs a restart, and shutdown leaks the handle. `COREService` is a `foam.INTERFACE` with three no-op defaults: `start()`, `stop()`, `reload()` (`src/foam/core/COREService.js`).
Don't: a Mongo client, an SMTP transport, or a `Timer` built in a constructor or a `javaFactory` with no `stop()`
Do:    `implements: ['foam.core.COREService']`; open in `start()`, close in `stop()`, rebuild in `reload()`; `transient: true` on the property that holds the live handle
Review asked: "I recommend the agent implement COREService and put this service in its own method that can be called from COREService.start. And then on configuration change COREService.reload can be triggered to rebuild the service." (PR #4056); "Can we call stop() on graceful shutdown to close the connection?" (PR #3737)

### A single-use resource is a local variable, not a lifecycle
`java.net.HttpURLConnection` is one request per instance by contract; wrapping it in `start`/`stop` makes a protocol error look tidy.
Don't: an `HttpURLConnection` held on a property and reused across calls
Do:    open it in the method that sends, close it there; keep the lifecycle for the client or pool that outlives a request

### `start()` needs `lazy: false`; it never fires for a lazy CSpec
`CSpec.lazy` defaults to true, so a `COREService` is not started until something first reads it out of the context. `CSpecFactory.initService` runs `start()` synchronously on the boot thread for a non-lazy CSpec and submits it to the `threadPool` Agency otherwise (`src/foam/core/boot/CSpecFactory.java`, `initService`, ~line 119).
Don't: a poller or listener registered with the default `lazy`
Do:    `"lazy": false` on the CSpec — see `foam-feature-wiring`

### `start()` exceptions are swallowed; the server boots with a broken service
Both branches of `initService` catch `Throwable` and log (`CSpecFactory.java`, ~lines 135 and 152). Nothing aborts boot.
Don't: assume a service is up because the server is
Do:    check `CSpec.status` after boot; a `start()` that cannot proceed should log the reason and leave the service inert, never half-open

### `reload()` fires only when `service`, `serviceClass`, or `serviceScript` changed
The trigger is a put to `cSpecDAO`, not to the service. `Boot.java` listens on the service DAO and calls `invalidate` (`src/foam/core/boot/Boot.java`, ~line 223); `CSpecFactory.invalidate` compares exactly those three fields before calling `reload()` (`CSpecFactory.java`, ~lines 185–193). Editing `description`, `lazy`, `enabled`, or any other field does nothing. A put from the CSpec's own thread is skipped (`Boot.java`, ~line 227).
Don't: expect `reload()` after editing a non-code CSpec field, or after re-putting the service object
Do:    put the CSpec; for a config-driven service, watch the config DAO row yourself and call `reload()` — `SMTPAgent` diffs its `EmailServiceConfig` against `lastConfig` and rebuilds only when the diff is non-empty (`src/foam/core/notification/email/SMTPAgent.js`)

### Rebuild is `copyFrom`, never swap
Other services cache the reference, so `invalidate` copies the new fields into the existing instance (`CSpecFactory.java`, `copyFrom`, ~line 235). Your `reload()` may run on an object whose fields were already overwritten.
Don't: compare `this` to a saved snapshot inside `reload()`
Do:    keep the previous config on a separate property and diff against that

### `stop()` runs only from the JVM shutdown hook, and never in TEST mode
`ShutdownHook` is registered with `Runtime.addShutdownHook` and skips `factory.shutdown()` when `appConfig.mode == TEST` (`src/foam/core/boot/ShutdownHook.java`, ~lines 35 and 73). `kill -9`, an OOM kill, or a test run never reach it.
Don't: a durable flush that exists only in `stop()`
Do:    flush on a timer or on write; treat `stop()` as best-effort cleanup

### Rate-limit an outbound integration through a `Throttle` CSpec
`foam.core.pool.Throttle` is a turnstile installed in the context; every caller of the same CSpec name shares one requests-per-second budget. `throttle()` reserves the next slot under a lock and then `Thread.sleep`s outside it (`src/foam/core/pool/Throttle.js`, `throttle`, ~lines 59–70). It implements `CSpecAware` only — no `start`/`stop`/`reload`.
Don't: a hand-rolled sleep or counter per call site; two differently named throttler CSpecs for one vendor, which doubles the budget
Do:    one CSpec, `serviceScript: return new foam.core.pool.Throttle.Builder(x).setRate(1.0F).build();`; a `throttler` String property naming it; `throttle()` after local work and immediately before the request is built, so the slot is held for the shortest window

### `throttle()` blocks the calling thread; a missing throttler CSpec means no limit, silently
At 1 tps with N concurrent callers, caller N waits N seconds. The lookup returns null where the CSpec is not deployed, so both framework call sites guard it (`src/foam/core/notification/GoogleChatSetting.js`, ~line 111; `src/foam/core/notification/email/SMTPAgent.js`, ~line 457).
Don't: `throttle()` inside a `synchronized` block or on a UI-facing request path; an unguarded `((Throttle) x.get(name)).throttle()`
Do:    `var t = (foam.core.pool.Throttle) x.get(getThrottler()); if ( t != null ) t.throttle();` — and grep for the CSpec whenever you rename the service that names it

### Model the service as an interface; `client: true` generates the client
A modelled service can carry properties, is controlled by the POM, and gets its client stub generated; a bare `.java` class loses all three. `foam.INTERFACE` has a `client` axiom (`src/foam/lang/Interface.js`, ~line 66); `src/foam/dao/history/HistoryRecordService.js` with its `HistoryRecordServiceServer.js` is the in-tree shape. The server implementation keeps the `Server<Name>Service` / `<Name>ServiceServer` name from `style-mechanics.md`; the hand-written `Client<Name>Service` pair is the older shape and is not needed for a new interface.
Don't: `HistoryRecordService.java` with no model; a new hand-written `ClientHistoryRecordService.js`; a class named `<Name>Impl`
Do:    `foam.INTERFACE({ name: 'HistoryRecordService', client: true, methods: [...] })` plus the server class; a `daoKey` String plus a `predicate` for anything that would otherwise pass a DAO, since a DAO is not serializable
Review asked: "why did you create this as java class and not modelled? … client: true — and then remove the HistoryRecordServiceClient as it will be auto generated." (PR #2983); "'Impl' is a very Java naming convention." (PR #4017); "DAO's aren't serializable, so you aren't going to be able to pass a DAO from the client to the server." (PR #2983)

### Read is the authorization check; there is no `canRead(x, obj)`
`AuthorizationDAO.find_` catches `AuthorizationException` and returns `null` (`src/foam/core/auth/AuthorizationDAO.js`, `find_`, ~line 85); `select_` ANDs an `IS_AUTHORIZED_TO_READ` predicate (~line 93); `put_` and `remove_` throw. Every "can I read this" helper that exists is a try/catch around one of those. The JS `isAuthorizedToRead` returns `true` unconditionally — client-side authorization is a deliberate no-op.
Don't: a `canReadSummary` permission check before a `find`; a client-side authorization branch
Do:    `obj = await dao.find(id); if ( ! obj ) return;` — the shape `DAOBrowseControllerView` and `DAOSummaryView` use; handle the thrown `AuthorizationException` on writes, where it reaches the client as a rejected promise
Review asked: "the 'can read DAO Summary' check should just be an attempt to read the object from the dao and if it can, then display" (PR #350)

### `dao.find(id)` is not authorized; `dao.inX(x).find(id)` is
`AbstractDAO.find` calls `find_(this.getX(), id)` — the DAO's own root context (`src/foam/dao/AbstractDAO.js`, ~line 514). The authorization decorator never sees the caller. This is the mechanism behind "pass `x` down" in `context-and-dao.md`.
Don't: `dao.find(id)` in a service method or web agent that was handed `x`
Do:    `dao.inX(x).find(id)` or `dao.find_(x, id)`

### A successful read is not the whole object
`PermissionedPropertyDAO.find_` returns the object with unreadable properties cleared (`src/foam/core/auth/PermissionedPropertyDAO.js`, `maybeRemoveProperties`). "Try the read, then display" shows blanks rather than hiding the record. `null` from `find` conflates unauthorized with not-found by design.
Don't: infer "this user may see every field" from a non-null `find`; use `find` to distinguish denied from missing
Do:    let the property view render the blank; if the distinction matters, check the permission string with `AuthService.check(x, "<prefix>.read.<id>")`
