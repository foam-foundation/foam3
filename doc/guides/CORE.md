<flow name="CORE" category="DOC/GUIDE" spid="foam" description="FOAM CORE, the Context-Oriented Runtime Environment: how Boot builds a server from the cSpecDAO, how the ClientBuilder builds the client from the same CSpecs, and a full reference for every CSpec option." keywords="core,cspec,services.jrl,services.0,boot,clientbuilder,cspecdao,menudao,themedao,knowledge"/>

# FOAM CORE and CSpecs

**CORE** (Context-Oriented Runtime Environment) is FOAM's Java application server, filling the role
that Spring Boot fills for Spring applications. A **CSpec** (CORE Service Specification) describes
one service that runs inside CORE: how the server creates it and, unusually, what the client uses to
talk to it.

This guide covers how CORE boots, how the client is assembled from the same CSpecs, and then gives a
reference for every CSpec option. In the code, `foam.core` is the CORE package (it used to be
`foam.nanos`). The classes that used to live in `foam.core` are now in `foam.lang`.

---

## 1. A Micro-Kernel Server

CORE has one service built in: the `cSpecDAO`. Everything else is a CSpec record in that DAO. That
includes the services you might expect a server to hard-code:

| Service | Comes from a CSpec named |
|---|---|
| Embedded HTTP server (Jetty) | `http` |
| Logging | `logger` |
| Authentication / authorization | `auth` |
| Thread pool | `threadPool` |
| Users, groups, menus, themes | `userDAO`, `groupDAO`, `menuDAO`, `themeDAO` |
| The boot script store | `bootScriptDAO` |

Boot does not know what any of these are. It loads the CSpecs, registers a lazy factory for each
one, and starts the ones marked non-lazy. Boot a different set of CSpecs and you have a different
program. The same `Boot` class can run a web application, an email server, a game server, or a
stand-alone tool that never opens a socket. Leave out the `http` CSpec and no web server starts.

Because services are only looked up by name in the context, any of them can be replaced by
changing its CSpec. No calling code changes. A logger that writes to a DAO, a logger that writes
to stdout, or an auth service with two-factor login added are each a different journal entry, not
a different build.

### 1.1 What Boot does

`foam.core.boot.Boot` (`src/foam/core/boot/Boot.java`):

1. **Creates the root context.** It holds a stdout logger, the boot time, and file storage for
   the data directory (`Boot.java:42-63`). The data directory comes from `--datadir` or the
   `JOURNAL_HOME` system property.
2. **Opens the CSpec journal.** It creates an `MDAO` of `CSpec`, indexed on `serve`, wrapped in a
   `JDAO` reading the journal named `services`. That is wrapped in a `PermissionedPropertyDAO`
   (`Boot.java:66-69`).
3. **Installs the system user.** A `Subject`, `Session` and `system` group go into the root
   context, so services created during boot run as system (`Boot.java:252-275`). `--spid=...`
   sets the system user's SPID, default `foam`.
4. **Registers a factory for every enabled CSpec** (`Boot.java:75-127`). Each CSpec becomes a
   `CSpecFactory` put into the context under its name. Nothing is created yet. Disabled CSpecs
   are logged as `Disabled` and skipped. The CSpecs are inserted in a balanced order (not file
   order), so the context lookup tree stays balanced.
5. **Freezes the context.** The root context reverts from a mutable `ProxyX` so later code
   cannot add bindings (`Boot.java:160-162`).
6. **Exports the CSpec DAO.** The `cSpecDAO` CSpec is a bare `ProxyDAO`. Boot points its delegate
   at the journalled DAO, wrapped in an `AuthorizationDAO` (`Boot.java:165-169`). This is how
   the one built-in DAO reaches the context: through its own CSpec.
7. **Runs the boot script.** It finds the script named by `-Dfoam.main` (default `main`) in
   `bootScriptDAO` and runs it, then the optional `--boot.script.aux` script (`Boot.java:173-199`).
   The `main` script in `src/foam/core/boot/bootscripts.jrl` stamps the application name and
   version on `appConfig`.
8. **Starts non-lazy services.** It selects every CSpec with `lazy: false`, ordered by
   `lazyOrder`, and touches each one, through the `threadPool` agency if there is one
   (`Boot.java:201-220`).
9. **Watches the CSpec DAO.** A listener invalidates a service's factory when its CSpec is
   updated, so an edit made at runtime takes effect without a restart (`Boot.java:223-232`). See
   [Section 5](#5-editing-cspecs-at-runtime).

### 1.2 What happens on first access

When something calls `x.get("fooDAO")`, the `CSpecFactory` (`src/foam/core/boot/CSpecFactory.java`)
builds the service once and caches it:

1. `CSpec.createService` picks the first of these that is set (`CSpec.js:306-319`):
   1. `service`: a ready-made object from the journal
   2. `serviceClass`: a class created with its no-arg constructor
   3. `serviceScript`: a BeanShell (or JShell) script whose return value is the service
2. The new object is set up (`CSpecFactory.java:97-158`):
   - `ContextAware` objects get `setX(x)`.
   - `CSpecAware` objects get their CSpec.
   - `COREService` objects get `start()`. For a lazy service this runs on the thread pool.
   - The same three steps run down any chain of `ProxyDAO` or `ProxyAuthService` delegates, so a
     decorator deep inside an `EasyDAO` is set up too.
3. A DAO is wrapped in a `ProxyDAO` before it goes into the context (`CSpecFactory.java:223-230`).
   That wrapper is what allows the DAO to be swapped or reloaded later without breaking callers
   that kept a reference.
4. A non-lazy DAO is sent `LOAD_CMD`, which replays its journal immediately (`CSpecFactory.java:153`).
5. If the service itself implements `XFactory`, every `x.get()` calls its `create(x)`, so the
   service can return a different object per context (`CSpecFactory.java:169`). For example,
   `ByServiceProviderFactory` returns `<name>_<spid>` for the caller's SPID, falling back to
   `<name>_`. `AltFactory` picks a service by predicate.

The CSpec's progress is written back to its `status` and `message` fields as it moves from
`Creating` to `Created`, `Starting` and `Initialized`. Those fields are visible in the Services
admin screen. A failure leaves `status: ERROR` and the exception text in `message`.

A service whose creation calls back into itself is caught and logged as
`Recursive Service Factory`. In that case `x.get()` returns null instead of hanging
(`CSpecFactory.java:61-65`).

### 1.3 The `COREService` lifecycle

A service that needs to start threads, open sockets or schedule work implements
`foam.core.COREService` (`src/foam/core/COREService.js`):

| Method | Called when |
|---|---|
| `start()` | After the service is created and set up. Runs on the thread pool for lazy services. |
| `reload()` | Its CSpec's `service`, `serviceClass` or `serviceScript` is changed at runtime. |
| `stop()` | At JVM shutdown, through `ShutdownHook`. |

All three default to doing nothing.

### 1.4 Sub-context names

A CSpec name containing `/` is registered inside a sub-context (`Boot.java:93-127`). A CSpec named
`foo/test` can be reached either as `x.cd("foo").get("test")` or as `x.get("foo/test")`. Sub-contexts
are frozen along with the root.

---

## 2. Where CSpecs Come From

### 2.1 `services.jrl` files

Each package declares its services in a `services.jrl` file next to its `pom.js`. The file holds
journal entries, one `p({...})` per CSpec:

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"bootScriptDAO",
  "lazy":false,
  "lazyOrder":-1,
  "serve":false,
  "serviceScript":"""
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(foam.core.script.Script.getOwnClassInfo())
      .setGuid(true)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .setJournalName("bootscripts")
      .build();
  """,
  "client":"""{ "of":"foam.core.script.Script" }"""
})
```

CSpecs can be created and edited in the GUI (**Admin → Services**, the `admin.nspec` menu over
`cSpecDAO`). In practice nearly all of them are written by hand in `services.jrl` and reviewed like
code.

The journal format is relaxed JSON:
- Keys may be unquoted (`name:"x"` works as well as `"name":"x"`).
- Strings can be quoted with `"`, `'`, `` ` `` or `"""`. Triple-quoted `"""..."""` strings can
  span lines and contain the other quote characters without escaping, which suits
  `serviceScript` and `client` (see [Section 7.1](#71-writing-strings-in-a-journal)).
- `//` comments are allowed between records. To switch a service off for a while, people often
  comment the whole record out. `enabled: false` is the clearer way (see [`enabled`](#enabled)).

### 2.2 The build combines them into `services.0`

During the build, `JournalMaker` (`tools/JournalMaker.js`, the `gen-journals` task) concatenates
every repository `.jrl` file with the same name into one `<name>.0` file. All `services.jrl` files
become `services.0`. Each source is preceded by a comment naming it:

```
// The following lines were copied from "foam3/src/foam/core/auth/services.jrl"
```

`JournalMaker` also appends two generated records (`JournalMaker.js:256-285`):
- An `appConfig` CSpec carrying the POM list and build flags.
- When there are extra image directories, an `http` CSpec adding them as `imageDirs`.

Open the generated `services.0` in your deployment's `journals` directory to see the complete
service list of a build. A medium-sized application has several hundred records.

### 2.3 Generations and overrides

The `services` journal is replayed like any other JDAO journal (`src/foam/dao/JournalGenerations.java:13-33`):

```
services.0      generation 0, built from services.jrl, ships with the build, replayed first
services.N      later generations, if any
services        the live journal: edits made at runtime through cSpecDAO land here
```

Replay **merges** each record into any earlier record with the same `name`. It does not replace it
(`F3FileJournal.js:197`). Only the properties a later record sets are changed. Nested FObjects
such as `service` are merged property by property too (`AbstractF3FileJournal.js:654-670`).

That merge is how an application customises a framework service without copying it. The
application's `services.jrl` is concatenated after the framework's, so a short record is enough:

```
// Turn off the framework's heartbeat service in this application
p({ "class":"foam.core.boot.CSpec", "name":"healthHeartbeatService", "enabled":false })

// Keep the framework's http config but change one setting
p({
  "class":"foam.core.boot.CSpec",
  "name":"http",
  "service": { "class":"foam.core.jetty.HttpServer", "port":8443 }
})
```

Overriding a record also has a trap. `createService` takes `service` before `serviceClass` before
`serviceScript`. If the framework record has a `serviceClass` and your override supplies a
`serviceScript`, the framework's class still wins. Clear the earlier field in the same record:
`"serviceClass":""`. Going the other way (adding `serviceClass` over a framework
`serviceScript`) works without clearing, because `serviceClass` takes precedence.

---

## 3. The Client Side

The client is as generic as the server. A FOAM web client does not ship a list of the services it
uses. It downloads that list from the server at startup and builds itself from it.

### 3.1 The ClientBuilder

`foam.core.client.ClientBuilder` (`src/foam/core/client/ClientBuilder.js`) runs in the browser:

1. It calls the `clientBuilderService` over a `SessionClientBox → RetryBox → HTTPBox` chain. The
   retry chain never gives up, because no client can be built without the CSpec list
   (`ClientBuilder.js:97-115`).
2. It asks for four things in parallel: the session's `Subject`, its `Theme`, the `appConfig`, and
   a projection of `name`, `client` and `lazyClient` for each CSpec (`ClientBuilder.js:188-193`).
3. The server returns only CSpecs with `serve: true` (`ClientBuilderServer.js:132`) that the
   session is allowed to read. Reading a CSpec runs `checkAuthorization`, which requires the
   permission `service.<name>` unless the CSpec has `authenticate: false` (`CSpec.js:339-346`,
   `Boot.java:165-169`). The server-side fields (`service`, `serviceClass`, `serviceScript`,
   `boxClass`, `documentation`, `authNotes`, `enabled`) are marked `readPermissionRequired`, and
   `PermissionedPropertyDAO` strips them. So a client learns what a service is called and how to
   reach it, but never how the server implements it.
4. It generates a class, `foam.core.client.Client`, with one property per CSpec. Each property's
   factory parses the CSpec's `client` JSON into an object (`ClientBuilder.js:215-262`). Each
   service is exported, so any object created under the client can `imports: ['fooDAO']`.
5. The objects are created lazily on first access, except those with `lazyClient: false`, which
   are created as soon as the client exists.
6. It reloads the page if `appConfig.version` differs from the version this browser last saw.

The result: a user who lacks `service.salesReportDAO` has no `salesReportDAO` in their client
context, so the UI built on it does not appear. That is a convenience, not the protection. The
protection is that the server refuses the call ([Section 3.2](#32-security-is-enforced-on-the-server)).

### 3.2 Security is enforced on the server

Authentication and authorization cannot be done on the client. The client runs on the user's
machine, and the user controls it: they can edit its code in the browser's developer tools, or skip
it and send requests to `/service/<name>` directly. Whatever the client decides, an attacker can
decide differently.

The client does run auth checks, but only to make the UI match what the user is allowed to do:
- A service the user cannot read is left out of the client context.
- A menu the user cannot read is left out of the navigation.
- A field with `readPermissionRequired` is hidden, and an action whose `isAvailable` or
  `isEnabled` depends on a permission check shows as hidden or disabled.
- The client `auth` service caches `check()` answers, so these UI decisions do not each cost a
  round trip.

Each of those has a server-side counterpart that does the real enforcement. Hiding something on the
client never makes it secure:

| Client hides | The server enforces it with |
|---|---|
| A service missing from the context | `SessionServerBox` checks the session and `service.<name>` on every boxed call (`SessionServerBox.java:135-155`); `AuthWebAgent` checks `service.run.<name>` for web endpoints (`NanoRouter.java:193-195`) |
| A menu missing from the navigation | `Menu` is `Authorizable`; reading one checks `menu.read.<id>` on the server (`Menu.js:249-260`) |
| A hidden field | `PermissionedPropertyDAO` strips the property from results unless the user has `<model>.ro.<prop>`, and without `<model>.rw.<prop>` puts the stored value back over any write to it (`PermissionedPropertyDAO.js:26-33`, `220-235`) |
| A disabled button or a filtered list | The DAO's own authorization (`authorize`, `permissioned`, SPID filtering in `EasyDAO`) or the service's own checks on every call |

So when you add a client-side check, add or confirm the matching server-side check. When you
review one, ask what happens if the client is bypassed. If the answer is "the user can do it
anyway", the server check is missing.

### 3.3 Agents, not protocols

The `client` field is the part of a CSpec that most frameworks do not have. Instead of publishing a
wire protocol and leaving each client to write a stub, the server publishes the client object
itself. The server and client halves of a service are declared together, in one record, and change
together. [agentsnotprotocols.md](agentsnotprotocols.md) explains the reasoning.

What the client receives does not have to be a plain stub. Depending on the CSpec it can be:

- **A proxy to the server.** The default for a DAO: an `EasyDAO` of type `CLIENT` that sends every
  call to `service/<name>`.
- **A cached proxy.** The same proxy with an in-memory cache in front of it, which can be full or
  time-limited.
- **A decorated proxy.** Client-side decorators added around the proxy: file upload handling,
  anonymous-login retry, a local auth cache, and so on.
- **The whole service.** An implementation that runs entirely in the browser and never calls the
  server. Validation helpers, formatters and client-only data views are examples.

Calling code cannot tell which of these it got. It calls `fooDAO.select()` or
`fooService.doThing()` either way.

### 3.4 A client defined by three DAOs

The client application is generic. What a particular user sees comes from data:

| DAO | Decides |
|---|---|
| `cSpecDAO` | Which services exist in the client and how each one is reached |
| `menuDAO` | The menus: what the user can navigate to and what each menu opens |
| `themeDAO` | The appearance: logos, colours, fonts, the root and default menus, per-tenant class overrides |

`menuDAO` is read constantly while the user navigates, so its CSpec asks for a full client cache
(`"cache": true` with both TTLs set to `0`). The ClientBuilder also preloads it before resolving
the client (`ClientBuilder.js:279`). After login, menu navigation needs no server round trips.

Point the same client code at a server with different `cSpecDAO`, `menuDAO` and `themeDAO` contents
and you get a different application.

### 3.5 The ApplicationController

Something has to run the ClientBuilder and turn the resulting client into a screen. By default that
is `foam.core.controller.ApplicationController`. The server's `VirtualHostRoutingServlet` writes the
page that boots the client, and that page contains one tag, `<foam class="..." id="ctrl">`. The
class comes from the theme's `appController` if it is set, otherwise from the servlet's
`controller` property, whose default is `ApplicationController` (`VirtualHostRoutingServlet.js:54-58`,
`296-298`).

Nothing in CORE requires it. It is the default because one kind of application is so common:
the user logs in, then moves around with top, side and bottom navigation built from menus.
`ApplicationController` provides exactly that:
- It builds the client with the ClientBuilder and asks for a login when there is no session.
- It lays out the top navigation, side navigation, footer and the view stack. Each one is a view
  class named in the theme (`topNavigation`, `sideNav`, `footerView` in `Theme.js:374-400`), so a
  theme can replace any of them without changing the controller.
- It fills the navigation from `menuDAO` and opens the theme's default menu after login.
- It exports navigation and UI services (`stack`, `pushMenu`, `routeTo`, `notify`, `subject`,
  `theme`, and more) for every view under it.

An application that does not fit that shape (a kiosk, a single full-screen tool, a game, an
embedded widget) sets `appController` in its theme, or `controller` on the servlet, to its own
class. That class can still use the ClientBuilder to get the same service-driven client.
[ApplicationController.md](ApplicationController.md) documents the default controller in detail.

---

## 4. CSpec Reference

`foam.core.boot.CSpec` is defined in `src/foam/core/boot/CSpec.js`. Its id is `name`. The
properties are grouped below by what they control.

Quick reference:

| Property | Short | Type | Default | Side | Purpose |
|---|---|---|---|---|---|
| [`name`](#name) | | String | — | both | Service name in the context and in `service/<name>` URLs |
| [`description`](#description) | `d` | String | | meta | One-line summary, shown as a tooltip |
| [`documentation`](#documentation) | `doc` | String | | meta | Longer notes, rendered as markdown in the admin screen |
| [`keywords`](#keywords) | `ks` | String[] | | meta | Search terms for the admin data-management screens |
| [`authNotes`](#authnotes) | | String | | meta | Why the security settings are what they are |
| [`enabled`](#enabled) | | Boolean | `true` | server | `false` removes the service entirely |
| [`service`](#service) | | FObject | | server | A ready-made service object |
| [`serviceClass`](#serviceclass) | `sc` | String | | server | Class to instantiate |
| [`serviceScript`](#servicescript) | `ss` | Code | | server | Script returning the service |
| [`language`](#language) | | Enum | `BEANSHELL` | server | Language of `serviceScript` |
| [`lazy`](#lazy) | | Boolean | `true` | server | `false` creates the service at boot |
| [`lazyOrder`](#lazyorder) | | Int | `0` | server | Start order for non-lazy services |
| [`threadLocalEnabled`](#threadlocalenabled) | | Boolean | `false` | server | Cache the service per thread |
| [`serve`](#serve) | | Boolean | `false` | both | Expose over the network as a boxed service |
| [`boxClass`](#boxclass) | `bc` | String | | server | Skeleton for a non-DAO served service |
| [`authenticate`](#authenticate) | `a` | Boolean | `true` | both | Require a logged-in user and `service.<name>` |
| [`parameters`](#parameters) | | Boolean | `false` | server | Parse HTTP parameters for a WebAgent |
| [`pm`](#pm) | | Boolean | `true` | server | Record performance metrics for a WebAgent |
| [`client`](#client) | `c` | Code (JSON) | `{}` | client | JSON for the client-side object |
| [`lazyClient`](#lazyclient) | | Boolean | `true` | client | `false` creates the client object at startup |
| [`status`](#status-and-message), [`message`](#status-and-message) | | | | runtime | Boot progress, not stored |

Short names can be used in journals, e.g. `"ss"` for `serviceScript`, but full names are easier
to read and are the norm.

### 4.1 Identity and documentation

#### `name`

The service's name. It is the context key on the server (`x.get("userDAO")`), the property and
export name on the client (`imports: ['userDAO']`), the path segment in URLs
(`/service/userDAO`), and the suffix of the access permission (`service.userDAO`).

Conventions:
- DAOs end in `DAO`. The admin screens use this to split DAOs from other services: the canned
  queries "DAOs" and "Services" test `ENDS_WITH(name, 'DAO')` (`CSpec.js:61-96`).
- `local` prefix (`localUserDAO`) for a server-only inner DAO that a served DAO wraps.
- `/` places the service in a sub-context ([Section 1.4](#14-sub-context-names)).

Renaming a CSpec renames the service everywhere: callers, permissions and URLs all change. Treat a
rename as a breaking change.

#### `description`

A one-line summary. Used as the hover text in the data-management views
(`DAOConfigSummaryView.js:305`) and searched by them.

#### `documentation`

Longer free text, shown as rendered markdown in the CSpec detail view. Use it for what a
maintainer needs to know: what writes to the service, what reads it, why it is configured this
way. Server-side only (`readPermissionRequired`).

#### `keywords`

An array of search terms. The data-management screens match their search box against keywords as
well as the name (`DataManagement.js:222`, `DAOConfigSummaryView.js:316`).

```
"keywords": ["audit", "history", "compliance"]
```

#### `authNotes`

Why the service's security settings are safe. Write it whenever you set `authenticate: false` on a
served service. `SecurityAuditTest` fails a served DAO that has no authorizer and is reachable by
some group, unless `authNotes` explains why (`SecurityAuditTest.js:122-133`).

```
"authenticate": false,
"authNotes": "Needs to be unauthenticated so apps can be themed before login. Writes are still restricted by an AuthorizationDAO."
```

### 4.2 Creating the server-side service

Set exactly one of `service`, `serviceClass` or `serviceScript`. If more than one is set (usually
through an override), the first in that order wins (`CSpec.js:306-319`).

A CSpec with none of the three has no server implementation. That is correct for a client-only
service ([Section 4.7](#47-client-only-services)) and an error for anything else:
`createService` throws `Script language not supported` or returns null.

#### `service`

A complete service object, written inline as JSON and created by the journal parser. Best for
services that are pure configuration:

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"healthHeartbeatService",
  "lazy":false,
  "lazyOrder":-1,
  "service": {
    "class":"foam.core.app.HealthHeartbeatService",
    "multicastAddress":"230.22.41.0",
    "port":52241
  }
})
```

The `http` CSpec is the largest example: the entire Jetty configuration (servlet mappings, filters,
error pages, ports) is a `foam.core.jetty.HttpServer` object in `service`. Because nested objects
merge on replay ([Section 2.3](#23-generations-and-overrides)), an application can adjust one
setting of a framework `service` without repeating the rest.

#### `serviceClass`

The fully qualified name of a Java class with a public no-arg constructor
(`Class.forName(...).newInstance()`, `CSpec.js:309`). Its context comes afterwards through
`ContextAware.setX`. Best for a service that needs no configuration:

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"strategizer",
  "serve":true,
  "serviceClass":"foam.strategy.BasicStrategizer",
  "boxClass":"foam.strategy.StrategizerServiceSkeleton"
})
```

#### `serviceScript`

A script whose value is the service. This is the most common choice and the only practical one
for DAOs, which are assembled from decorators. The script runs with the variable `x` bound to the
service's context (`BeanShellExecutor.java:29`). In that context, `x.get(CSpec.class)` and
`x.get("CSPEC_CTX_KEY")` return the CSpec being built (`CSpecFactory.java:79`), and `logger` is
the context logger.

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"auth",
  "serve":true,
  "authenticate":false,
  "boxClass":"foam.core.auth.AuthServiceSkeleton",
  "serviceScript":"""
    auth = new foam.core.auth.UserAndGroupAuthService(x);
    auth = new foam.core.auth.CapabilityAuthService.Builder(x).setDelegate(auth).build();
    auth = new foam.core.auth.CachingAuthService(auth);
    auth = new foam.core.auth.SubjectAuthService.Builder(x).setDelegate(auth).build();
    return auth;
  """,
  ...
})
```

Tips:
- BeanShell accepts Java syntax, untyped variables (`auth = ...`) and `import` statements. The
  `logger` CSpec starts with several imports.
- The last expression, or an explicit `return`, is the service.
- A script error is logged with the CSpec's name and the service becomes null
  (`BeanShellExecutor.java:31-39`). `x.get()` then returns null, and the CSpec shows `ERROR`.
- Look up other services with `x.get("name")`. That creates them on demand, so the order of
  `services.jrl` does not matter, but a cycle produces `Recursive Service Factory`.
- For a DAO, end with `EasyDAO.Builder(x)...build()` and chain `.addPropertyIndex(...)` after
  `build()` to add indexes. A non-lazy DAO replays its journal after the script returns, so every
  index the script adds is in place for that load (`CSpecFactory.java:151-153`).

#### `language`

The language of `serviceScript`, from `foam.core.script.Language`:

| Value | Meaning |
|---|---|
| `BEANSHELL` (default) | BeanShell interpreter. Used by almost every CSpec. |
| `JSHELL` | Java's JShell. Slower to start; rarely used. |
| `JS` | Client-side JavaScript. Not valid for a server script: `createService` throws `Script language not supported`. |

### 4.3 When the service is created

#### `lazy`

Default `true`: the service is created the first time something asks for it. Set `false` for
services that must run whether or not anyone asks: the HTTP server, the logger, schedulers,
listeners, and DAOs whose data should be in memory before the first request.

For a DAO, `lazy: false` also means "load the data at boot". The factory sends it `LOAD_CMD` once
it is built (`CSpecFactory.java:153`).

Non-lazy services are submitted to the `threadPool` in `lazyOrder` order (`Boot.java:201-220`), so
they start in parallel.

#### `lazyOrder`

The start order among non-lazy services, low to high (`CSpec.js:155`):

| Value | Use |
|---|---|
| `-1` | Framework services that others depend on: `http`, `logger`, `threadPool`, `bootScriptDAO`, `themes` |
| `0` (default) | Ordinary application services |
| `> 0` | Services that must start after other data is loaded |

Once every pool thread is busy, the remaining services wait their turn, so `lazyOrder` decides who
gets a thread first. It does not guarantee that a lower-ordered service has *finished* starting.
A service that truly needs another one should call `x.get(...)` on it, which builds it on demand.

#### `threadLocalEnabled`

When `true`, each thread keeps its own reference to the service and refreshes it at most once a
second, instead of going through the factory's synchronized lookup every time
(`CSpecFactory.java:27-41`, `163-164`). Use it only for very hot services where profiling shows
contention on that lookup. Default `false`.

### 4.4 Exposing the service over the network

A service in the server context is only reachable from Java until its CSpec says otherwise. There
are two ways out, chosen by `serve`.

#### `serve`

`serve: true` exposes the service as a **boxed** service: FOAM's RPC layer, used by the generated
client stubs. Requests arrive at `/service/<name>` over HTTP (`NanoRouter`) or over a socket or
WebSocket (`COREServiceRouter`). They are decoded by a **skeleton**, which turns a network message
into a method call on the service:

- With no `boxClass`, the skeleton is a DAO skeleton: `SessionDAOSkeleton` over HTTP
  (`NanoRouter.java:152-154`), `DAOSkeleton` over sockets (`COREServiceRouter.java:74-76`). So any
  served DAO needs nothing more than `serve: true`.
- With a `boxClass`, that skeleton is used instead ([`boxClass`](#boxclass)).

Every boxed request goes through `SessionServerBox`, which attaches the caller's session and runs
the CSpec's authorization check ([`authenticate`](#authenticate)).

`serve: true` is also the filter for the client: only served CSpecs are sent to the ClientBuilder
(`ClientBuilderServer.js:132`). So a client-only service still needs `serve: true`, even though no
request will ever reach the server for it.

`serve: false` (the default) with a service that implements `foam.core.http.WebAgent` exposes it
as a plain **web endpoint** at `/service/<name>`. That is the right choice for things that are not
RPC: health checks, file downloads, webhooks, the DIG data gateway. The WebAgent is wrapped
according to `parameters`, `pm` and `authenticate` (`NanoRouter.java:170-199`). A service that is
neither served nor a WebAgent cannot be reached from outside; a request for it gets a 404.

```
// Boxed service: RPC from the client stub
p({ "class":"foam.core.boot.CSpec", "name":"userDAO", "serve":true, "serviceScript":"...", "client":"..." })

// Web endpoint: GET /service/health
p({
  "class":"foam.core.boot.CSpec",
  "name":"health",
  "lazy":false,
  "lazyOrder":-1,
  "authenticate":false,
  "parameters":true,
  "serviceClass":"foam.core.app.HealthWebAgent"
})
```

#### `boxClass`

The skeleton class for a served service that is not a DAO. Declaring `skeleton: true` on a
`foam.INTERFACE` generates a skeleton named `<Interface>Skeleton`. Use that name here, and give
the client a matching stub (`client: true` on the interface generates `Client<Interface>`):

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"clientBuilderService",
  "serve":true,
  "authenticate":false,
  "boxClass":"foam.core.client.ClientBuilderServiceSkeleton",
  "serviceClass":"foam.core.client.BaseClientBuilderService",
  "client":"""
    {
      "class":"foam.core.client.ClientClientBuilderService",
      "delegate":{
        "class":"foam.box.SessionClientBox",
        "delegate":{ "class":"foam.box.HTTPBox", "url":"service/clientBuilderService" }
      }
    }
  """
})
```

Leaving out `boxClass` on a served non-DAO service gives it a DAO skeleton. Every call then fails
at runtime, because the service is not a DAO. [Services.md](Services.md) walks through writing the
interface, the implementation and the stub.

#### `authenticate`

Default `true`. It has a different effect on each path:

| Path | `authenticate: true` requires | Code |
|---|---|---|
| Boxed (`serve: true`) | A logged-in session, *and* the permission `service.<name>` | `SessionServerBox.java:135-155`, `CSpec.js:339-346` |
| Web endpoint (WebAgent) | A logged-in session with the permission `service.run.<name>` | `NanoRouter.java:193-195` |
| Client list | The permission `service.<name>` to see the CSpec at all | `CSpec.js:366-371` |

Set `authenticate: false` for services that must work before login, such as `auth`, `themes`,
`menuDAO`, `cSpecDAO` and `clientBuilderService`, and for public endpoints such as `health`. An
unauthenticated served DAO must protect itself in other ways: an authorizer, `ReadOnlyDAO`, or
`PermissionedPropertyDAO`. Record that reasoning in [`authNotes`](#authnotes). `SecurityAuditTest`
checks every served DAO for this.

`authenticate` is a gate on reaching the service. It is not a replacement for the DAO's own
authorization (`authorize`, `permissioned`, SPID filtering in `EasyDAO`), which decides what a
caller who got through may read and write.

#### `parameters`

WebAgent services only. When `true`, the agent is wrapped in `HttpParametersWebAgent`, which parses
query and form parameters (including credentials passed as parameters) into the request context
(`NanoRouter.java:182-184`). Authentication is applied outside it, after parsing.

#### `pm`

WebAgent services only. Default `true`: the agent is wrapped in `PMWebAgent`, which records a
performance measurement per request (`NanoRouter.java:186-188`). Set `false` for very high-volume
endpoints where per-request PMs are noise. Boxed services always get PMs from `SessionServerBox`.

### 4.5 The client-side object

#### `client`

A JSON string describing the object the client creates for this service. The ClientBuilder parses
it with `foam.json.parse` in the client's context, filling in defaults for anything left out
(`ClientBuilder.js:235-260`):

| If `client` leaves out | The ClientBuilder uses |
|---|---|
| `class` | `foam.dao.EasyDAO` |
| `serviceName` (when the class has that property) | `service/<name>` |
| For an `EasyDAO`: `daoType` | `CLIENT` (a `RequestResponseClientDAO` to the server) |
| For an `EasyDAO`: `cache` | `true` |
| For an `EasyDAO`: `ttlPurgeTime`, `ttlSelectPurgeTime` | `CACHE_TIMEOUT`, 5 minutes (`ClientBuilder.js:57`) |

For an `EasyDAO`, `of` has no default and must be given. Missing it logs
`Missing "of" in CSpec client for service`. The empty default `"{}"` therefore produces an
`EasyDAO` that cannot work, so a served DAO always states at least its `of`.

Because `client` is a string holding JSON, quote it with `"""` so the JSON's own `"` characters
need no escaping. Older journals sometimes escape every quote on one line instead
(`"{\"of\":\"foam.core.script.Script\"}"`). That parses identically but is harder to read; see
[Section 7.1](#71-writing-strings-in-a-journal).

```
"client":"""{ "of":"foam.core.script.Script" }"""

"client":"""
  {
    "of":"foam.core.auth.User",
    "ttlSelectPurgeTime":15000,
    "ttlPurgeTime":0,
    "decorators":[{"class":"foam.core.fs.FileDAODecorator"}]
  }
"""
```

A property set on the client and server objects is *not* shared. Server-side ordering, indexes and
decorators in `serviceScript` do not reach the client. If the client needs a sort order, put it in
`client` too. `menuDAO` repeats its `order` in both places for this reason.

The rest of this section lists the shapes `client` commonly takes.

##### Plain client DAO

```
"client":"""{ "of":"foam.core.theme.Theme" }"""
```

A cached `CLIENT` `EasyDAO` with 5-minute TTLs. The usual choice.

##### Fully cached DAO

```
"client":"""
  { "of":"foam.core.menu.Menu", "cache":true, "ttlSelectPurgeTime":0, "ttlPurgeTime":0 }
"""
```

A TTL of `0` means "never purge": the client loads the DAO once and serves every later `find` and
`select` from memory. Use it for small, read-mostly DAOs that the UI hits constantly (`menuDAO`,
`cSpecDAO`, lookup tables). Do not use it for large or fast-changing DAOs: the whole DAO is pulled
into every browser.

##### Uncached DAO

```
"client":"""{ "of":"com.example.Event", "cache":false }"""
```

Every call goes to the server. Use it for large or append-heavy DAOs where a client cache would be
stale or too big.

##### Other `EasyDAO` client options

Any `EasyDAO` property can go in `client` (`src/foam/dao/EasyDAO.js`). The ones used on clients:

| Property | Effect |
|---|---|
| `of` | The model class. **Required.** |
| `cache` | In-memory cache in front of the server DAO |
| `ttlPurgeTime` / `ttlSelectPurgeTime` | How long cached `find` / `select` results live, in ms. `0` = forever |
| `pollingInterval` / `maxPollingInterval` | Re-poll the server to refresh a cache (ms) |
| `decorators` | Extra client-side DAO decorators |
| `order` | Default sort order, as `__Property__` references |
| `remoteListenerSupport` | Receive server-pushed `listen()` events (requires daoType `CLIENT`) |
| `retryBoxMaxAttempts` | Retries for a failed request (default 5) |
| `requestTimeout` | Request timeout in ms |
| `loadProgress` | Show "loading" toasts while the server loads an unloaded journal (default `true`) |
| `daoType` | `CLIENT`, `MDAO`, `IDB`, `LOCAL`, `ARRAY`, or a class name (`EasyDAO.js:100-109`) |
| `serviceName` | The server path, if different from `service/<name>` |

The property `order` takes Property references:

```
"order":[
  { "class":"__Property__", "forClass_":"foam.core.menu.Menu", "name":"order" },
  { "class":"__Property__", "forClass_":"foam.core.menu.Menu", "name":"label" }
]
```

##### Interface stub over a box

For a non-DAO served service, name the generated client stub and build its box chain. The usual
chain is `SessionClientBox` (attaches the session) around `HTTPBox` (the transport):

```
"client":"""
  {
    "class":"foam.strategy.ClientStrategizerService",
    "delegate":{
      "class":"foam.box.SessionClientBox",
      "delegate":{ "class":"foam.box.HTTPBox", "url":"service/strategizer" }
    }
  }
"""
```

Leave out `SessionClientBox` only for calls that need no session.

##### Decorated stub

Client-side decorators wrap the stub. The client `auth` service retries anonymous logins and
caches permission checks in the browser. Those cached answers only decide what the UI shows. The
server checks again on every call ([Section 3.2](#32-security-is-enforced-on-the-server)).

```
"client":"""
  {
    "class":"foam.core.auth.AuthorizeAnonymousClientDecorator",
    "delegate":{
      "class":"foam.core.auth.CachedAuthServiceProxy",
      "delegate":{ "class":"foam.core.auth.ClientLoginAuthService" }
    }
  }
"""
```

`themes` combines a context-registration decorator, a client theme service and a box chain the
same way.

##### Client-only implementation

The client object is a complete implementation that never calls the server:

```
"client":"""{ "class":"foam.core.auth.login.ClientLoginService" }"""
```

See [Section 4.7](#47-client-only-services).

#### `lazyClient`

Default `true`: the client object is created the first time client code accesses it. Set `false`
for client services that must exist as soon as the client does, usually because creating them
registers something or starts listening. `clientLoginService` and `themes` are examples. Eager
client objects are created before the client is handed to the application
(`ClientBuilder.js:230-231`, `274-276`).

### 4.6 Enabling and disabling

#### `enabled`

Default `true`. With `enabled: false`:
- Boot skips the CSpec: no factory is registered, and `x.get(name)` returns null (`Boot.java:87-90`).
- HTTP requests for it get a 404 (`NanoRouter.java:96-100`).

Disabling is the clean way to switch a framework service off in one deployment, especially as an
override ([Section 2.3](#23-generations-and-overrides)). Code that calls `x.get()` on a disabled
service must handle the null.

### 4.7 Client-only services

A CSpec with a `client` and no server implementation (no `service`, `serviceClass`,
`serviceScript` or `boxClass`) defines a service that exists only in the browser. It still needs
`serve: true`, because that is what puts it in the client's CSpec list. It usually has
`authenticate: false`, so that every session gets it.

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"clientLoginService",
  "serve":true,
  "lazyClient":false,
  "authenticate":false,
  "client":"""{ "class":"foam.core.auth.login.ClientLoginService" }"""
})
```

Use this sparingly. Most services have a server side. The client-only form is for browser logic
that you want delivered and replaceable through the same mechanism as every other service, so
that client code imports it by name and a deployment can swap it by editing a CSpec. Another
variant is a client object for a server service published under a different name, such as a
`blobService` whose client talks to `service/httpBlobService`.

`SecurityAuditTest` recognises this shape and skips it (`SecurityAuditTest.js:76-83`).

### 4.8 Runtime-only fields

#### `status` and `message`

`status` is a `CSpecStatus`: `INITIAL`, `INITIALIZING`, `REPLAYING`, `READY`, `UNLOADED` or `ERROR`.
`message` collects the progress messages and any error text. Both are `storageTransient`: they are
written while the server runs, so the admin screen can show which services are up and why one
failed, and they are never journalled. Do not set them in `services.jrl`.

`cSpecDAO` and `threadName` are also transient internal bookkeeping.

---

## 5. Editing CSpecs at Runtime

`cSpecDAO` is a live, journalled DAO. An update put through it (from the Services admin screen or a
script) is written to the live `services` journal and picked up by Boot's listener
(`Boot.java:223-232`). `CSpecFactory.invalidate` reacts only when `service`, `serviceClass` or
`serviceScript` changed (`CSpecFactory.java:182-221`):

| The running service is | What happens |
|---|---|
| A `COREService` | `reload()` is called. If the new object is an FObject, the existing instance copies its properties, because other services may hold a reference to it. |
| A DAO | The `ProxyDAO`'s delegate is cleared, and the next access rebuilds the DAO and replays its journal. Not supported for clustered DAOs. |
| Anything else | The cached instance is dropped. A non-lazy service is rebuilt immediately; a lazy one on next access. |

Changes to other fields, such as `authenticate`, `serve` or `client`, are stored but take effect
only as their readers next look. The HTTP router caches its handler per service name, so a change
to `serve`, `boxClass` or `authenticate` needs a restart to be certain. A `client` change reaches a
browser on its next page load.

Creating, updating and removing CSpecs requires `nspec.create`, `nspec.update.<name>` and
`nspec.remove.<name>` (`CSpec.js:349-405`). A runtime edit lives only in that server's `services`
journal. To make it permanent, copy it into the right `services.jrl`.

---

## 6. Recipes

### A served, journalled DAO

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"invoiceDAO",
  "description":"Customer invoices.",
  "serve":true,
  "serviceScript":"""
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.Invoice.getOwnClassInfo())
      .setSeqNo(true)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .setJournalName("invoices")
      .setAuthorize(true)
      .build();
  """,
  "client":"""{ "of":"com.example.Invoice" }"""
})
```

Users need `service.invoiceDAO` to have `invoiceDAO` in their client. Record-level access is the
DAO's job (`setAuthorize(true)` here).

### A server-only DAO wrapped by a served one

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"localInvoiceDAO",
  "serviceScript":"""
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.Invoice.getOwnClassInfo())
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .setJournalName("invoices")
      .build();
  """
})

p({
  "class":"foam.core.boot.CSpec",
  "name":"invoiceDAO",
  "serve":true,
  "serviceScript":"""
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.Invoice.getOwnClassInfo())
      .setInnerDAO((foam.dao.DAO) x.get("localInvoiceDAO"))
      .setAuthorize(true)
      .build();
  """,
  "client":"""{ "of":"com.example.Invoice" }"""
})
```

Server code that must bypass authorization uses `localInvoiceDAO`. Clients only ever see
`invoiceDAO`.

### A background service started at boot

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"invoiceReminderScheduler",
  "lazy":false,
  "serviceClass":"com.example.InvoiceReminderScheduler"
})
```

The class implements `COREService` and starts its timer in `start()`.

### A public web endpoint

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"invoicePdf",
  "authenticate":true,
  "parameters":true,
  "serviceClass":"com.example.InvoicePdfWebAgent"
})
```

`GET /service/invoicePdf?id=42` requires a session with `service.run.invoicePdf`.

### A boxed non-DAO service

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"taxService",
  "serve":true,
  "boxClass":"com.example.TaxServiceSkeleton",
  "serviceClass":"com.example.SimpleTaxService",
  "client":"""
    {
      "class":"com.example.ClientTaxService",
      "delegate":{
        "class":"foam.box.SessionClientBox",
        "delegate":{ "class":"foam.box.HTTPBox", "url":"service/taxService" }
      }
    }
  """
})
```

---

## 7. Examples

The recipes above are made up so that each shows one idea. The examples below are real CSpecs
from FOAM's own `services.jrl` files, chosen so that together they use most of the options in
[Section 4](#4-cspec-reference). Each is shown as it appears in the source and followed by an
explanation of every field.

### 7.1 Writing strings in a journal

The journal parser accepts four string delimiters (`src/foam/lib/json/StringParser.java:46-51`):

| Delimiter | Use it for |
|---|---|
| `"..."` | Short single-line values with no `"` inside: names, class names, descriptions. |
| `'...'` | A single-line value that contains `"` but no `'`, such as `'{ "of":"foam.core.auth.Group" }'`. |
| `` `...` `` | A multi-line value with no backtick inside. Fine for a Java script; risky for JavaScript, which uses backticks for template strings. |
| `"""..."""` | Anything multi-line, or anything containing `"`, `'` or `` ` ``. **The best default for `serviceScript` and `client`.** |

Backslash escapes are processed inside every delimiter, including `"""`
(`StringParser.java:121-146`). A backslash meant for the script must therefore be doubled: write
`"a\\nb"` in the journal to give BeanShell the Java literal `"a\nb"`.

Some other rules apply as well:
- Keys need no quotes (`src/foam/lib/json/KeyParser.java:15-18`), so `class:` and `"class":` are
  the same. The `Health` record in [7.7](#77-a-family-of-health-services) uses unquoted keys.
- `serviceScript` and `client` are `Code` properties, which hold strings, so they must be quoted
  (`src/foam/core/boot/CSpec.js:215-227`). `service` is an `FObjectProperty`
  (`CSpec.js:186-192`), so it is written as a nested object with no quoting at all.
- When the server writes a journal with its `multiLineOutput` option on, it writes multi-line
  strings back as `"""` blocks (`src/foam/lib/json/Outputter.java:99-104`). `scriptDAO` turns this
  on (`src/foam/core/script/services.jrl:16`).

Many records were written before `` ` `` and `"""` were supported, so they escaped every quote,
often with the whole record on one line. FOAM's own `services.jrl` files have since been converted,
but application journals may still contain the old style. It parses exactly the same. When you
edit such a record, it's worth rewriting it with `"""`.

### 7.2 A one-line record, rewritten: `agentAuth`

`agentAuth` lets a user act as another user or business, when permitted. As written in
`src/foam/core/auth/services.jrl:62`:

```
p({"class":"foam.core.boot.CSpec", "name":"agentAuth",                        "lazy":false, "lazyOrder":-1, "serve":true, "authenticate": false, "description":"Permits users to act as others if permitted. Places user as an agent of the system.", "boxClass":"foam.core.auth.AgentAuthServiceSkeleton", "serviceScript":"return new foam.core.auth.AgentUserAuthService(x);", "client": """{"class":"foam.core.auth.AgentAuthClient","delegate":{"class":"foam.core.auth.ClientAgentAuthService"}}"""})
```

The same record, rewritten with one field per line:

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"agentAuth",
  "description":"Permits users to act as others if permitted. Places user as an agent of the system.",
  "lazy":false,
  "lazyOrder":-1,
  "serve":true,
  "authenticate":false,
  "boxClass":"foam.core.auth.AgentAuthServiceSkeleton",
  "serviceScript":"""
    return new foam.core.auth.AgentUserAuthService(x);
  """,
  "client":"""
    {
      "class":"foam.core.auth.AgentAuthClient",
      "delegate":{ "class":"foam.core.auth.ClientAgentAuthService" }
    }
  """
})
```

| Field | What it does here |
|---|---|
| `description` | Shown in the services admin screen. |
| `lazy: false`, `lazyOrder: -1` | Built at boot, among the first group of services. |
| `serve: true` | Reachable from clients at `service/agentAuth`. |
| `boxClass` | `agentAuth` is not a DAO, so the generated `AgentAuthServiceSkeleton` turns incoming box messages into method calls. |
| `authenticate: false` | No `service.agentAuth` permission is needed to reach it. The service decides for itself whether the caller may act as the requested user. |
| `serviceScript` | Creates the server implementation. A one-line script could equally be `"serviceClass":"foam.core.auth.AgentUserAuthService"`. |
| `client` | A decorator around a generated stub. `ClientAgentAuthService` builds its own `SessionClientBox` → `HTTPBox` chain to its `serviceName` (`src/foam/core/auth/ClientAgentAuthService.js:23-39`), which the ClientBuilder fills in as `service/agentAuth`. `AgentAuthClient` wraps it: after a successful `actAs()` it installs the new subject and purges client caches (`src/foam/core/auth/AgentAuthClient.js:12-15`). |

### 7.3 A served DAO cached in full on the client: `menuDAO`

From `src/services.jrl:150-186`:

```
p({
  "class": "foam.core.boot.CSpec",
  "name": "menuDAO",
  "serve": true,
  "authenticate": false,
  "serviceScript":
  """
    return new foam.dao.EasyDAO.Builder(x)
      .setName("menu")
      .setPm(true)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .setJournalName("menus")
      .setOf(foam.core.menu.Menu.getOwnClassInfo())
      .setOrder(new foam.lang.PropertyInfo[] {foam.core.menu.Menu.ORDER, foam.core.menu.Menu.LABEL})
      .build();
  """,
  "client": """
    {
      "of": "foam.core.menu.Menu",
      "order": [
        {
          "class": "__Property__",
          "forClass_": "foam.core.menu.Menu",
          "name": "order"
        },
        {
          "class": "__Property__",
          "forClass_": "foam.core.menu.Menu",
          "name": "label"
        }
      ],
      "cache": true,
      "ttlSelectPurgeTime": 0,
      "ttlPurgeTime": 0
    }
  """
})
```

| Field | What it does here |
|---|---|
| `serve: true` | Every client gets a `menuDAO`. |
| `authenticate: false` | The menus are needed before login, for example on the sign-in screen. Access is still controlled per record: `Menu.authorizeOnRead` hides any menu whose `menu.read.<id>` permission the user lacks (`src/foam/core/menu/Menu.js:249-260`). |
| `serviceScript` | An `EasyDAO` journalled to the `menus` journal, with PMs on. `setName` gives the DAO a readable name (`src/foam/dao/EasyDAO.js:115-117`). `setOrder` sorts server-side selects by `order`, then `label`. |
| `client.of` | Required for a client `EasyDAO`. |
| `client.order` | The server's sort order does not reach the client, so it is stated again, as `__Property__` references. |
| `client.cache` with both TTLs `0` | A full cache. With both purge times at zero, the client builds a `CachingDAO` over an in-memory `MDAO`, sorted by `order` (`EasyDAO.js:1200-1219`). The menus are loaded once and every later `find` and `select` is answered in the browser. |

### 7.4 A server-only DAO wrapped by a served one: `localGroupDAO` and `groupDAO`

From `src/foam/core/auth/services.jrl:173-202`:

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"localGroupDAO",
  "serviceScript":"""
    return new foam.dao.EasyDAO.Builder(x)
      .setPm(true)
      .setUnloadable(false)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .setJournalName("groups")
      .setOf(foam.core.auth.Group.getOwnClassInfo())
      .setAuthorize(false)
      .build();
  """,
  "client":"""{"of":"foam.core.auth.Group"}"""
})

p({
  "class":"foam.core.boot.CSpec",
  "name":"groupDAO",
  "serve":true,
  "serviceScript":"""
    return new foam.dao.EasyDAO.Builder(x)
      .setPm(true)
      .setUnloadable(false)
      .setInnerDAO(x.get("localGroupDAO"))
      .setOf(foam.core.auth.Group.getOwnClassInfo())
      .build();
  """,
  "client":"""{"of":"foam.core.auth.Group"}"""
})
```

This is the standard pattern for keeping one store behind two doors.

- **`localGroupDAO`** owns the data. It journals to `groups` and has `setAuthorize(false)`, so
  server code that must see every group, such as the auth service, uses it.
- **`groupDAO`** is the door clients use. `setInnerDAO(x.get("localGroupDAO"))` builds a fresh
  `EasyDAO` decorator stack, with authorization on by default, over the same data. It adds no
  journal of its own.
- **`serve`** is set only on `groupDAO`. `localGroupDAO` cannot be reached from outside.
- **`setUnloadable(false)`** on both keeps the groups in memory. By default a single-journal
  `EasyDAO` may be unloaded and reloaded lazily to save memory (`EasyDAO.js:568-571`).
- **`client` on `localGroupDAO` does nothing.** The ClientBuilder only receives served CSpecs
  ([Section 3.1](#31-the-clientbuilder)), so this `client` is never read. A new local DAO should
  leave `client` out.

### 7.5 Decorator chains on both sides: `auth`

From `src/foam/core/auth/services.jrl:1-50`:

```
p({
  "class": "foam.core.boot.CSpec",
  "name": "auth",
  "serve": true,
  "authenticate": false,
  "boxClass": "foam.core.auth.AuthServiceSkeleton",
  "serviceScript": """
    auth = new foam.core.auth.UserAndGroupAuthService(x);
    auth = new foam.core.auth.CapabilityAuthService.Builder(x).setDelegate(auth).build();
    auth = new foam.core.auth.EnabledCheckAuthService.Builder(x)
      .setDelegate(auth)
      .build();
    auth = new foam.core.auth.PasswordExpiryAuthService.Builder(x)
      .setDelegate(auth)
      .build();
    auth = new foam.core.auth.twofactor.TwoFactorAuthService.Builder(x)
      .setDelegate(auth)
      .build();
    auth = new foam.core.auth.ResetSpidBeforeLoginAuthService.Builder(x)
      .setDelegate(auth)
      .build();
    auth = new foam.core.auth.CachingAuthService(auth);
    auth = new foam.core.auth.SubjectAuthService.Builder(x)
      .setDelegate(auth)
      .build();
    auth = new foam.core.auth.PMAuthService.Builder(x)
      .setLabel("uncached")
      .setDelegate(auth)
      .build();
    auth = new foam.core.auth.SystemAuthService.Builder(x)
      .setDelegate(auth)
      .build();
    auth = new foam.core.auth.FailedLoginAuthService.Builder(x)
      .setDelegate(auth)
      .build();
    return auth;
  """,
  "client":"""
    {
      "class": "foam.core.auth.AuthorizeAnonymousClientDecorator",
      "delegate":
      {
        "class":"foam.core.auth.CachedAuthServiceProxy",
        "delegate":{
          "class":"foam.core.auth.ClientLoginAuthService"
        }
      }
    }
  """
})
```

| Field | What it does here |
|---|---|
| `serve: true`, `boxClass` | A served non-DAO service. `AuthServiceSkeleton` turns box messages into `AuthService` calls. |
| `authenticate: false` | Login itself goes through `auth`, so it must be reachable without a session. |
| `serviceScript` | Builds the server implementation as a chain of decorators. Each line wraps the previous result, so `UserAndGroupAuthService` is the innermost and `FailedLoginAuthService` the outermost, which sees every call first. Adding a check means adding one line; no class changes. The script is a good example of why `"""` matters: written as a one-line string it would be unreadable. |
| `client` | Also a decorator chain, read from the outside in. `ClientLoginAuthService` is the stub that talks to the server. `CachedAuthServiceProxy` caches permission checks in the browser and clears the cache when the user's group changes (`src/foam/core/auth/CachedAuthServiceProxy.js:12-15`). `AuthorizeAnonymousClientDecorator` sets the client-side variables needed when a visitor is authorized anonymously (`src/foam/core/auth/AuthorizeAnonymousClientDecorator.js:16-19`). |

The client-side cache only affects what the UI shows. The server checks permissions again on
every call ([Section 3.2](#32-security-is-enforced-on-the-server)).

### 7.6 Eager infrastructure: `threadPool`

From `src/services.jrl:119-129`:

```
p({
  "class": "foam.core.boot.CSpec",
  "name": "threadPool",
  "lazy": false,
  "lazyOrder": -1,
  "serve": false,
  "serviceScript": `
    return new foam.core.pool.ThreadPoolAgency.Builder(x)
      .build();
  `
})
```

| Field | What it does here |
|---|---|
| `lazy: false`, `lazyOrder: -1` | Built at boot, in the first group. Boot submits the other non-lazy services to this pool, so it must exist early ([Section 1.1](#11-what-boot-does), step 8). |
| `serve: false` | Server only. This is the default, so stating it only documents intent. |
| `serviceScript` in backticks | A multi-line script with no backticks inside, so `` ` `` works as well as `"""`. |

### 7.7 A family of health services

These four records from `src/foam/core/app/services.jrl:10-73` work together. Between them they show a
DAO with no storage, a public web agent, a `service` given as an object, a factory service, and
disabled services kept in place for deployments that switch them on.

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"healthDAO",
  "serve":true,
  "serviceScript": """
  return new foam.dao.EasyDAO.Builder(x)
    .setOf(foam.core.app.Health.getOwnClassInfo())
    .setCluster(false)
    .setSaf(false)
    .setDecorator(new foam.core.app.HealthRemoveDAO.Builder(x)
      .setDelegate(new foam.dao.NullDAO(x, foam.core.app.Health.getOwnClassInfo()))
      .build())
    .build();
  """,
  "client":"""
  {
    "of":"foam.core.app.Health"
  }
  """
})

p({
  "class": "foam.core.boot.CSpec",
  "name": "health",
  "lazy": false,
  "lazyOrder": -1,
  "authenticate": false,
  "parameters": true,
  "serviceClass": "foam.core.app.HealthWebAgent"
})

p({
  class: "foam.core.boot.CSpec",
  name: "Health",
  description: "Health Factory",
  authenticate: false,
  pm: false,
  service: {
    class: "foam.core.app.HealthFactory"
  }
})

p({
  "class": "foam.core.boot.CSpec",
  "name": "healthHeartbeatService",
  "lazy": false,
  "lazyOrder": -1,
  "enabled": false,
  "service": {
    class: "foam.core.app.HealthHeartbeatService",
    multicastAddress: "230.22.41.0",
    port: 52241
  }
})
```

**`healthDAO`**
- `setCluster(false)` and `setSaf(false)` keep this DAO out of clustering and store-and-forward
  replication. Health records describe the local server, so they should not be copied to others.
- `setDecorator(...)` adds an application decorator, `HealthRemoveDAO`. It is constructed with a
  `NullDAO` as a placeholder delegate. `EasyDAO` walks to the end of the decorator chain and
  replaces that placeholder with the real DAO (`EasyDAO.js:259-269`). `scriptDAO` uses the same
  idiom for `ScriptRunnerDAO`.
- `client` is a plain client `EasyDAO`: cached, with the default 5-minute TTLs.

**`health`**
- No `serve`, but `HealthWebAgent` implements `WebAgent`
  (`src/foam/core/app/HealthWebAgent.java:24-25`), so it is still reachable at `service/health`
  as a plain HTTP endpoint.
- `authenticate: false` makes it public, so monitors can call it without a session.
- `parameters: true` parses query parameters into the request context before the agent runs.
- `lazy: false` builds it at boot, so the first health check isn't slowed by creating it.

**`Health`**
- `service` is a nested object, not a string, and the keys are unquoted
  ([7.1](#71-writing-strings-in-a-journal)).
- `HealthFactory` implements `XFactory` (`src/foam/core/app/HealthFactory.js:14-21`). When a
  service is an `XFactory`, `x.get("Health")` calls its `create(x)` each time
  (`src/foam/core/boot/CSpecFactory.java:169`), so every lookup returns a fresh `Health`
  describing the server now, not one built at boot.
- `pm: false` turns off per-request PMs. It only affects web agents, so on this record it has
  no effect.

**`healthHeartbeatService`**
- `enabled: false` means Boot skips it and logs it as `Disabled`. A deployment switches it on with
  a short override record such as `p({"class":"foam.core.boot.CSpec","name":"healthHeartbeatService","enabled":true})`
  ([Section 2.3](#23-generations-and-overrides)).
- The `service` object sets the service's own properties, here `multicastAddress` and `port`,
  in the CSpec. No script is needed to configure them.

### 7.8 A client-only service: `clientLoginService`

From `src/foam/core/auth/login/services.jrl:1-8`:

```
p({
  "class":"foam.core.boot.CSpec",
  "name":"clientLoginService",
  "serve":true,
  "lazyClient": false,
  "authenticate":false,
  "client":"""{ "class": "foam.core.auth.login.ClientLoginService" }"""
})
```

| Field | What it does here |
|---|---|
| no `service`, `serviceClass`, `serviceScript` or `boxClass` | There is no server side. The `client` object is the whole service. |
| `serve: true` | Needed anyway, because only served CSpecs reach the ClientBuilder ([Section 4.7](#47-client-only-services)). |
| `authenticate: false` | Every client gets it, including before login. That is when a login service is needed. |
| `lazyClient: false` | Created as soon as the client is built, not on first use ([`lazyClient`](#lazyclient)). |

---

## 8. Troubleshooting

### Check the server log for a BeanShell error first

The most common reason a service is missing is a syntax error in its BeanShell `serviceScript`:
a missing semicolon, an unbalanced bracket, a misspelled class name, or a backslash that the
journal parser consumed ([7.1](#71-writing-strings-in-a-journal)). A script is only compiled when
its service is built. When it fails, the server doesn't stop. The failure is caught
(`CSpecFactory.java:88-90`) and logged at `ERROR` with a stack trace, as
`Creating Service,<name>,<exception message>` (`CSpec.js:429-434`, `480-482`). The CSpec's
`status` becomes `ERROR`, with the message in `message`. The service is then simply absent, and
whatever needs it fails later, often with an error that doesn't mention the script.

So when you start the server, look through the log for `Creating Service` errors before
anything else. Two details affect where the error shows up:
- **When it appears.** A `lazy: false` service is built at boot, so its error appears during
  startup. A lazy service is built the first time something asks for it, so its error appears
  then.
- **Where it gets reported.** If the failed service is one that others build on, such as a
  `local…DAO`, the first visible error may come from the service that wrapped it. Search the log
  for the inner service's name as well.

### Make sure the server is running the definition you think it is

Several journals can define a CSpec with the same name: the framework's `services.jrl`, an
application or deployment `services.jrl` that overrides it, a later `services.N` generation, and
the live `services` journal holding edits made in the GUI
([Section 2.3](#23-generations-and-overrides)). They are merged record by record. So the CSpec the
server actually runs may differ from the file you are editing: someone, perhaps you, may have
overridden it in a journal loaded later.

Before you debug a service's behaviour, open it in the GUI (**Admin → Services**) and read the
merged definition the server is using. Check `serviceScript`, `serviceClass`, `service`, `client`,
`enabled` and `lazy`. If they are not what you expect, search every `services.jrl` for the
service's name, look in `services.0` in the deployment's journal directory, and look in the live
`services` journal to find which record set them. Remember the override trap: a field set by an
earlier record stays set unless a later record clears it with `""`.

| Symptom | Likely cause |
|---|---|
| A change to a CSpec in `services.jrl` seems to be ignored | A later journal overrides the record, or a runtime edit in the `services` journal does. Compare the definition shown in **Admin → Services** with your file. |
| `ERROR` `Creating Service,fooDAO,...` in the server log | The `serviceScript` has a BeanShell syntax or runtime error. The exception message and stack trace in the log point to it. Fix the script and restart, or edit the CSpec at runtime ([Section 5](#5-editing-cspecs-at-runtime)). |
| `x.get("fooDAO")` is null on the server | CSpec disabled, misspelled, or the script threw. Check the CSpec's `status` / `message`, and the log for the name. |
| `Recursive Service Factory` in the log | The service's script, directly or indirectly, calls `x.get()` on itself. |
| Client has no `fooDAO` | `serve` is not `true`, `client` is empty, or the user lacks `service.fooDAO`. |
| `Missing "of" in CSpec client` | The `client` JSON for a DAO has no `of`. |
| `Uknown Client class` | The class named in `client` is not in the client build (check the POM `flags` for that file). |
| Served service calls fail with DAO errors | A non-DAO service is missing its `boxClass`. |
| `/service/foo` returns 404 | Not `serve`d and not a `WebAgent`, or disabled. |
| An override in `services.jrl` has no effect | An earlier-precedence field is still set by the framework record. Clear it with `""`. |
| A runtime CSpec edit was lost on redeploy | Runtime edits live only in that server's `services` journal. Copy the change into `services.jrl`. |

---

## Related Guides

- [agentsnotprotocols.md](agentsnotprotocols.md): why the server ships the client
- [Services.md](Services.md): writing a boxed service with an interface, skeleton and stub
- [NanoServices.md](NanoServices.md): the Box messaging layer behind boxed services
- [EasyDao.md](EasyDao.md): configuring the DAOs most CSpecs build
- [Themes.md](Themes.md): the `themeDAO` side of the client
- [ApplicationController.md](ApplicationController.md): the default client controller
- [Journals.md](Journals.md) and [JournalFiles.md](JournalFiles.md): how journals are replayed and merged
- [Permissions.md](Permissions.md): granting `service.<name>` permissions
