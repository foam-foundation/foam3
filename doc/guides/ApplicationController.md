# ApplicationController

`foam.core.controller.ApplicationController` is the top-level client shell for a FOAM application. It owns the application stack, authentication lifecycle, theming, navigation, notifications, and session management, and exports all of these as named services into the context so that every descendant view can import them by name without explicit wiring.

Available on the browser console as `ctrl` (via `exports: ['as ctrl']`).

## Responsibilities

| Area | What it does |
|------|-------------|
| **Stack** | Owns `stack` (a `DesktopStackView`); all navigation happens by pushing/replacing views on it |
| **Authentication** | Builds the `ClientBuilder`, fetches the `Subject`/`Group`, triggers login when needed |
| **Theme** | Loads `Theme` from the server, expands CSS macros, allows per-component overrides |
| **Navigation** | `pushMenu`, `routeTo`, `routeToDAO` — three ways to move through the app |
| **Notifications** | `notify()` — transient toast messages and persistent `Notification` records |
| **Capabilities** | CRUNCH capability intercept and wizard flow gating on login |
| **Display width** | Tracks responsive breakpoint (`displayWidth`) via `isFramed` resize listener |
| **Language** | Installs locale translations into model message strings |
| **Session timer** | `SessionTimer` for idle/expiry handling |
| **Breadcrumbs** | `BreadcrumbManager` shared across the stack |

## Context Exports

`ApplicationController` exports ~30 services into its sub-context. Every child view can import any of these by name:

```javascript
// In any descendant view:
imports: ['stack', 'notify', 'pushMenu', 'theme', 'subject', 'displayWidth']
```

Key exports:

| Export | Type | Description |
|--------|------|-------------|
| `as ctrl` | Self | The controller; accessible as `ctrl` in context and on `globalThis` |
| `stack` | `Stack` | The main view stack |
| `notify` | Function | Show a toast or persist a notification |
| `pushMenu` | Function | Navigate to a menu by id or object |
| `routeTo` | Function | Update the URL hash and navigate |
| `routeToDAO` | Function | Navigate to the menu that owns a given DAO/record |
| `currentMenu` | Property | The currently active `Menu` object |
| `subject` | `Subject` | Current user + agent (acting-as) |
| `group` | `Group` | Current user's group |
| `theme` | `Theme` | Current theme (CSS tokens, nav overrides, app config) |
| `displayWidth` | `DisplayWidth` enum | Current responsive breakpoint (XS/SM/MD/LG/XL) |
| `crunchController` | `CrunchController` | Capability acquisition and intercept |
| `loginSuccess` | Boolean | True after successful authentication |
| `breadcrumbs` | `BreadcrumbManager` | Breadcrumb trail for the stack |
| `sessionTimer` | `SessionTimer` | Idle/expiry timer |
| `logAnalyticEvent` | Function | Record an analytic event |

## Lifecycle

```
render()
  └─ addMacroLayout()          // builds nav + stack + footer shell
  └─ onClientLoad()
       └─ ClientBuilder.promise
            └─ splice client sub-context into __subContext__.__proto__
            └─ fetchGroup()
            └─ fetchTheme()    // loads Theme, expands CSS macros
            └─ installLanguage()
            └─ onUserAgentAndGroupLoaded()   ← if authenticated
                 └─ checkGeneralCapability() // CRUNCH gate
                 └─ pushDefaultMenu() or routeUpdated()
                 └─ initLayout.resolve()
            └─ initMenu()      ← if anonymous
            └─ subToNotifications()
```

`initLayout` is a `Latch` — views that depend on layout being ready can `await initLayout`.

## Navigation

Three navigation methods serve different purposes:

```javascript
// Push a menu by id — silent (does not update the URL hash)
this.pushMenu('admin.users');
this.pushMenu('admin.users', true);  // force reload even if already current

// Update the URL hash — triggers routeUpdated listener, which calls pushMenu_
this.routeTo('admin.users');
this.routeTo('admin.users/42');      // menu + record id

// Navigate to whichever menu owns a given DAO (and optionally a record)
this.routeToDAO(this.userDAO, userId);
```

`route` is declared `memorable: true`, so the URL hash is the source of truth. On page load, `onUserAgentAndGroupLoaded` reads `this.route` and calls either `pushDefaultMenu()` or `routeUpdated()` to restore the last location.

`pushMenu` does not update the URL; `routeTo` does. The distinction matters when you need deep-link support (use `routeTo`) vs. internal navigation that shouldn't affect the browser history (use `pushMenu`).

## Theming

`fetchTheme()` loads a `Theme` object from the server and calls `useCustomElements()`, which replaces individual layout components:

```javascript
// A Theme can override any of these independently:
theme.topNavigation  // replaces TopNavigation
theme.footerView     // replaces FooterView
theme.sideNav        // replaces the side nav component
theme.loginView      // replaces the login screen
```

This is the same replace-one-piece philosophy as COMICS: the shell is composed of individually substitutable components.

CSS macros allow theme colour tokens to be referenced inside any component's `css:` block:

```css
/* short form — replaced at install time */
background: %PRIMARY_COLOR%;

/* long form — replaced on theme change */
background: /*%PRIMARY_COLOR%*/ #4285F4;
```

`returnExpandedCSS()` walks the `MACROS` list and expands both forms. `reloadStyles()` is called on `themeChange` so live theme switching works without a page reload.

## Authentication Flow

```javascript
fetchSubject(promptLogin = true)
  → client.auth.getCurrentSubject()
  → if no user or anonymous: requestLogin()
       → stack.set(loginView)
       → returns Promise that resolves on loginSuccess$
  → fetchGroup()
  → onUserAgentAndGroupLoaded()
```

`requestLogin()` also handles `#reset` (password reset) and `#sign-up` routes before falling back to the normal login view.

`user` and `agent` properties are deprecated — they remain as `Object.defineProperty` shims with console warnings that redirect to `subject.user` and `subject.realUser`. New code should import `subject` directly.

## Notifications

```javascript
// Transient toast (disappears automatically):
this.notify('Record saved', '', this.LogLevel.INFO, true);

// Persistent notification (stored in notificationDAO, shown as toast on next load):
this.notify('Approval required', 'Please review item #42', this.LogLevel.WARN, false);
```

`notify(message, subMessage, severity, transient, icon)`

- `transient: true` — adds a `NotificationMessage` element directly to the controller (auto-dismisses)
- `transient: false` — puts a `Notification` record to `myNotificationDAO`; `subToNotifications()` subscribes to that DAO and displays it as a toast via `displayToastMessage()`

Toast TTL for persistent notifications is 12 hours (`NOTIFICATION_TOAST_TTL`).

## The Monolith Problem

The server side of a FOAM application is a nano-service architecture: each service is independently declared, installed, and composed via `CSpec` journal entries. The client side is not — `ApplicationController` is a monolith that bundles authentication, theming, navigation, notifications, capabilities, breadcrumbs, session management, and display-width tracking into a single class.

This creates the same tradeoffs as any monolith: to change one behaviour you subclass or refine the whole controller, and the coupling between concerns is implicit rather than declared.

## ZAC — The Intended Successor

`foam.core.zac.Client` (Zero-Admin Client) is the start of a replacement that applies the same nano-service architecture to the client. Rather than one monolithic controller, ZAC builds the client by downloading and installing services:

```javascript
// ZAC startup — render() fetches the client, then activates boot services
this.client = await this.ClientBuilder.create({authenticate: false}, this).promise;
this.bootServices.split(',').forEach(s => { this.client.__subContext__[s]; });
```

Each service in `bootServices` is a CSpec entry that adds itself to the controller when accessed. The `HelloWorld` demo in `deployment/demo/journals/services.jrl` illustrates the pattern:

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name": "helloWorld",
  "authenticate": false,
  "lazyClient": false,
  "serve": true,
  "client": """{"class":"foamdev.demo.zac.HelloWorld"}"""
})
```

ZAC is not yet a priority, but the direction is clear: client composition should mirror server composition, with no second-class services on either side.

## Source Files

| File | Role |
|------|------|
| `src/foam/core/controller/ApplicationController.js` | The monolithic application shell |
| `src/foam/core/zac/Client.js` | ZAC — the micro-service replacement (in progress) |
| `src/foam/core/zac/index.html` | ZAC entry point |
| `src/foam/core/controller/AppStyles.js` | Global CSS installed by the controller |
| `src/foam/core/controller/Fonts.js` | Font declarations |
| `src/foam/core/theme/Theme.js` | Theme model (CSS tokens, nav overrides, app config) |
