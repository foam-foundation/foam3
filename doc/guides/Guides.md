# Guide to Guides

A map of what each guide covers, organized by category. If you're not sure which guide to read, start here.

---

## Getting Started

**[WhyFOAM](WhyFOAM.md)**
Answers why FOAM succeeds where earlier model-driven systems failed. Covers twelve principles: never editing generated code, fine-grained Lego-like components, context-based composition, RISC-y APIs, active runtime models, self-modelling, and feature-orientation. Read this first if you want to understand the philosophy before the mechanics.

**[Concepts](Concepts.md)**
Introduces the key pillars of FOAM thinking: meta-programming, Model-Driven Development, Feature-Orientation (Unix-like composability), and meta-circularity (the model models itself). A short conceptual orientation before diving into code.

**[Intro](Intro.md)**
Developer introduction: what FOAM is (a cross-platform MDD framework for JS/Java/Swift), its core philosophy (declare models, generate everything), and a tour of the key features — reactive binding, built-in UI, DAOs, and cross-platform output.

**[Build](Build.md)**
The FOAM Pom-O-Matic build system: POM file types (Tooling vs Build), the three build phases (Tooling, Environment/Registration, Task), and the command-line flag styles the Node-based build tool supports.

**[POM](POM.md)**
Reference for POM (Project Object Model) file attributes: name/vendorId/version/licenses, multi-stage JS loading for startup performance, flags expressions for conditional inclusion (js/java/web/node/debug), JSLibs, and how the build processes sub-projects.

**[Context](Context.md)**
Explains the immutable hierarchical key-value Context (X) — its get/put/putFactory API — and the three-level hierarchy: system context (boot), session context (per-user), and request context (per HTTP request). Read this before learning about imports and exports.

**[DesignPatterns](DesignPatterns.md)**
Catalogs the design patterns FOAM uses throughout: Strategy, Proxy, Decorator, Bridge, Facade, Template Method, Command, Observer/Reactive, and Composite. Useful for understanding why the framework is structured the way it is.

---

## Object Model

**[models](models.md)**
Reference for FOAM model types: `foam.CLASS` (data models), `foam.ENUM` (fixed value sets), `foam.INTERFACE` (contracts), `foam.SCRIPT` (business logic), `foam.RELATIONSHIP` (model connections), `foam.LIB` (namespace extensions), and XSD-generated types.

**[Axioms](Axioms.md)**
Explains Axioms as the core extension mechanism — the pseudo-interface with `installInClass`/`installInProto` that all higher-level constructs (Properties, Methods, Listeners, Actions, Topics, etc.) implement. Covers two-phase installation and priority ordering.

**[Enum](Enum.md)**
Covers FOAM Enums: declaring them with `foam.ENUM`, defining values with ordinal/label/properties/methods, built-in `ordinal` and `name` properties, and usage patterns analogous to Java enums.

**[Refinements](Refinements.md)**
Explains Refinements as the mechanism to extend or modify existing FOAM classes post-definition without creating a subclass. Covers the two-phase installation, common patterns (adding properties, view defaults, Java code generation), and how refinements bootstrap FOAM's self-modelling.

**[MixinsAndImplements](MixinsAndImplements.md)**
Compares `implements:` (interface-like semantics with safe override handling via an intermediate axiomMap level) vs `mixins:` (direct unconditional axiom copy with no conflict resolution). Use `implements:` unless you explicitly want overwrite behaviour.

**[Relationships](Relationships.md)**
Covers FOAM Relationships (one-to-many and many-to-many): how they differ from Reference properties, `foam.RELATIONSHIP` declaration syntax, what gets generated (FK properties, filtered DAOs, junction models), and UI integration via `DAOBrowserView`.

**[Listeners](Listeners.md)**
Covers Listeners as pre-bound methods that retain `this` in callbacks, declaring them in short or long form, timing options (`isMerged`/`isFramed`/`isIdled`), the built-in pub/sub topic system, and declarative `on:` subscription binding.

**[Actions](Actions.md)**
Covers Actions as methods with GUI metadata (label, availability, enablement, icon, confirmation, shortcut) that views render automatically as buttons. Contrasts Actions with plain methods and Listeners, and explains why they replace hand-wired button+onClick+guard combinations.

**[REQUIRES_VS_IMPORTS](REQUIRES_VS_IMPORTS.md)**
Explains the difference between `requires:` (class dependencies — makes a short name available as a factory method with automatic context passing) and `imports:` (runtime DI — pulls live service instances from context). A short but essential read before any serious view or service work.

---

## Data & DAOs

**[Dao](Dao.md)**
Comprehensive DAO guide: how to make a class storable, the full JS and Java DAO interfaces (put/find/remove/select/listen/removeAll/where/orderBy/limit/skip/inX), filtering, the common sinks, EasyDAO overview, and MLang predicates. The primary DAO reference.

**[EasyDao](EasyDao.md)**
Explains EasyDAO as a one-stop DAO configurator: storage type (IDB/LOCAL/MDAO), caching, ID assignment (seqNo/guid), synchronization, journaling, and authorization flags. Read this when setting up a new DAO.

**[DaoExamples](DaoExamples.md)**
Hands-on code examples for ArrayDAO, put, find, select with predicates and sinks — can be run in a Chrome console or Node REPL. Good for experimenting with the DAO API.

**[DaoGotchas](DaoGotchas.md)**
Catalog of non-obvious DAO behaviors: which context a decorator predicate filters against, why argless `find`/`select` re-enter with the DAO's own context, how arity-1 `select` drops query arguments, frozen-object semantics, decorator stacking order, `CachingDAO` TTL branch, `LimitedSink` under `GROUP_BY`, and `LTE` matching unset dates. Read this when something in a DAO chain behaves unexpectedly.

**[Sink](Sink.md)**
Reference for FOAM Sinks: the four-method interface (put/remove/eof/reset), the source-to-sink streaming architecture, all common built-in sinks (ArraySink/COUNT/SUM/MAX/MIN/GROUP_BY/MAP/UNIQUE), and sink delegation and chaining.

**[Journals](Journals.md)**
Explains FOAM journals: append-only `.jrl` files using p/c/r/v operations with JSON delta compression, their roles in persistence, build integration, and deployment, the directory hierarchy, replay at startup, and how compaction reduces replay time.

**[MultiPartKeys](MultiPartKeys.md)**
Explains composite primary keys in FOAM via the `ids` array, automatic generation of a typed ID class with create/parse/compare methods, and how to find objects by multi-part key.

**[Updating Objects in DAOs](Updating%20Objects%20in%20DAOs.md)**
Explains the read-copy-edit-put pattern for updating DAO objects: why returned objects are frozen, using `clone()`/`fclone()` before mutation, and how the DAO stack (validation, auth, journal) processes the put.

**[Compaction](Compaction.md)**
Covers FOAM journal compaction: the five-step process (block, roll/backup, unblock, compact, complete) that rewrites many delta entries into one entry per object to speed replay. Includes configuration, custom sinks, rollback procedure, and gotchas.

**[NDiff](NDiff.md)**
Covers NDiff, a debugging and change-tracking tool for CSpecs that captures initial journal state, compares it to runtime state, and enables visual before/after comparison and restore. Configured via `setNdiff(true)` on `EasyDAO`.

**[DaoEventsAndRefresh](DaoEventsAndRefresh.md)**
Explains the three DAO events (put/remove/reset), how they bubble up through the decorator chain to views, how to subscribe with `listen`/`on.put.sub`, and when to force a manual refresh.

---

## Reactive UI

**[ApplicationController](ApplicationController.md)**
Documents `foam.core.controller.ApplicationController`, the top-level client shell: navigation stack, authentication lifecycle, theming, notifications, and session management. Covers the ~30 named context exports (`pushMenu`, `notify`, `subject`, `theme`, `displayWidth`, etc.), the lifecycle flow, and ZAC as the intended micro-service successor.

**[Comics](Comics.md)**
Explains `foam.comics.v3` (Context-Oriented MIcro ControllerS): how the DAOController state machine composes three micro-controllers (DAOView, CreateView, DetailView) to generate a full CRUD UI — table, search, detail form, create form, sorting, export — automatically from one model declaration. Covers DAOControllerConfig knobs, CRUD predicates, ComicsAction overrides, and canned queries.

**[U3](U3.md)**
Documents U3 (`foam.u2`), FOAM's wrapped-DOM reactive GUI library: history (U1 templates → U2 virtual DOM → U3 direct DOM), the Node class hierarchy (Text/SlotNode/FunctionNode/Element), DOM building via `start`/`end`/`add`/`tag`, `add()` polymorphism, CSS scoping with `^`, reactive slots, ControllerMode/DisplayMode/visibility pipeline, `onDetach` cleanup, and the `render()` method contract.

**[ReactiveUI](ReactiveUI.md)**
Explains FOAM's four reactive UI patterns from lightest to heaviest: slot binding (`prop$`), `slot.dot()` for nested properties, `slot.map()` for value transforms, and `dynamic()` for DOM-structure rebuilds. Includes a decision framework for choosing the right pattern.

**[ReactivePatterns](ReactivePatterns.md)**
Complete reference for all FOAM3 slot and reactive binding forms: PropertySlot (`obj.name$`), `slot()` lookup, deep `$` chain via `dot()`, ExpressionSlot, `dynamic()`, `linkFrom`/`linkTo` two-way binding, and when to use each.

**[Slots](Slots.md)**
Conceptual and advanced reference for Slots as observable pointers: the C-pointer analogy, PropertySlot vs SubSlot vs ExpressionSlot types, the `$` accessor, deep chains, two-way linking, and why slots are the backbone of FOAM reactive UI.

**[dynamic](dynamic.md)**
Explains the difference between model-level property `expression:` (lazy, pull-based, reactive computed values) and `this.dynamic()` (eager, push-based reactive DOM content), covering when each fires and their key behavioral differences.

**[ControllerModeAndVisibility](ControllerModeAndVisibility.md)**
Documents the three-layer pipeline — ControllerMode (CREATE/VIEW/EDIT), per-property Visibility declarations (RW/RO/DISABLED/HIDDEN), and DisplayMode — that controls whether a property's view is editable, read-only, disabled, or hidden.

**[Modals](Modals.md)**
Describes the modal component hierarchy: `Popup` (base, full-screen overlay), `StyledModal` (title/description/action bar), `ConfirmationModal` (primary/secondary actions), and `ApplicationPopup` (wizard flows with progress bar and branding). Includes usage guidance for each.

**[Notifications](Notifications.md)**
Overview of the notification system: creating `Notification` objects via `notificationDAO`, extending the base class for custom types, display via the bell icon and `NotificationCitationView`, and how to write custom citation views.

**[Cells](Cells.md)**
A conceptual essay exploring how spreadsheet cells unify input, display, computation, and storage to eliminate glue code, and arguing that FOAM extends this idea beyond the grid via FObjects and reactive expressions.

**[VsReact](VsReact.md)**
Compares FOAM (model-driven, cross-platform, built-in DAO layer, context DI) vs React (component-based UI library, virtual DOM, hooks, JS-only) across philosophy, architecture, dependency management, and UI component design.

**[VsWebComponents](VsWebComponents.md)**
Compares FOAM and Web Components/Polymer (common Google origins, conceptual kinship). Explains that Web Components solve only the UI component problem while FOAM provides a single model declaration as the source of truth for UI, persistence, networking, validation, and cross-platform code generation.

---

## AI & Agents

**[LLM](LLM.md)**
Argues that LLM-generated code repeats the code-generator liability trap at larger scale, and explains how FOAM's declaration-over-code approach avoids this by generating behaviour at runtime rather than shipping generated implementation code that accumulates as a maintenance burden.

**[agentsnotprotocols](agentsnotprotocols.md)**
Drawing on Bill Joy's 2000 essay, argues that shipping executable agents rather than wire-protocol specifications eliminates interoperability problems. Explains how FOAM/CORE realises this: the CSpec registry delivers client agents on demand instead of requiring REST API negotiation.

**[Reflow](Reflow.md)**
Overview of Reflow, FOAM's Jupyter-style interactive console: the Console controller, Flow documents, Block execution units, the command system (dao/upload/save/load/flows), reactive properties via `reactions_`, data visualisation via DAO agents and Chart.js, and hierarchical scope management.

**[ExportingFlows](ExportingFlows.md)**
Step-by-step instructions for exporting a Reflow flow from the running app: open the flow DAO in Console, filter by name, open the Download link (JSON or journal format), copy it, and replace the entry in the `.jrl` source file.

**[Dashboard](Dashboard.md)**
Quick-start guide for building FOAM3 dashboards: creating a `DashboardView` with widget menus in `menu.jrl`, configuring `CardWrapper`/`DAOTable`/count widgets, and optional `CitationView`s.

**[claude](claude.md)**
A comprehensive LLM-oriented FOAM3 reference covering all major concepts: class definition, properties, methods, listeners, actions, context, DAOs, MLang, inheritance, pub/sub, relationships, enums, interfaces, POM, U2/U3, multi-tenancy/SPID, grammars, authentication, schema migration, and code-generation conventions. Intended as a context document for LLM-assisted development.

---

## Backend & Services

**[NanoServices](NanoServices.md)**
Comprehensive guide to FOAM's nano-service architecture: location-agnostic service access via context DI, the Box messaging layer (Box/Envelope/RPCMessage), Stub/Skeleton RPC generation, CSpec registration, and a complete `NotificationService` example.

**[Services](Services.md)**
Step-by-step guide to creating FOAM nano-services: define a `foam.INTERFACE` with `skeleton: true`, implement the server side, register via CSpec in `services.jrl`, optionally create a client stub. Explains how Stub→Network→Skeleton is transparent to callers.

**[Auth](Auth.md)**
Covers the FOAM authorization system: User/Group/Permission/Capability models, `GroupPermissionJunction`, pseudo-permission `@`-inheritance, and the SPID-based multi-tenancy model with hierarchical per-SPID permissions and the authorization flow.

**[Security](Security.md)**
Covers FOAM security at two levels: structural immunity (XSS impossible via U2/U3's DOM-only builder API; SQL injection impossible via MLang's typed predicate objects) and application security (CSpec-based service authorization). Short but important read.

**[Permissions](Permissions.md)**
Documents the permission system architecture: the check flow (User → Group → GroupPermissionJunction → Permission), permission string patterns, the AuthService decorator chain (PM → Caching → Capability → EnabledCheck → PasswordExpiry → TwoFactor → UserAndGroup), and CSpec authorization.

**[SPID](SPID.md)**
Comprehensive guide to the SPID multi-tenancy system: making models SPID-aware via `ServiceProviderAware`, how `ServiceProviderAwareDAO` transparently filters put/find/select/remove, hierarchical dot-separated SPIDs (e.g. `acme.canada.eastcoast`), and the Theme white-labelling model with per-SPID class registrations.

**[Deployment](Deployment.md)**
Covers FOAM deployment: building a tarball, uploading and installing remotely via SSH, common install flags (user, backup), JVM memory defaults and overrides, and other JVM tuning.

**[email-setup](email-setup.md)**
Step-by-step guide for configuring email in a FOAM app: creating `EmailServiceConfig` (SMTP), `EmailTemplate`, and `EmailConfig` journal entries, then sending `EmailMessage` objects through `notificationDAO`.

**[EmailSystemArchitecture](EmailSystemArchitecture.md)**
Architecture overview of FOAM3's email pipeline: the three config entry types (`EmailServiceConfig`/`EmailTemplate`/`EmailConfig`), the rule-driven processing flow, the template variable system, Microsoft Graph integration, and gotchas.

**[Safari](Safari.md)**
Short guide to running FOAM in Safari, which requires building with HTTPS (`-J../foam3/deployment/https -a`) and accessing `https://localhost:8443`, plus certificate trust steps in Keychain.

---

## Language & Parsers

**[MLang](MLang.md)**
Reference with Java and JavaScript examples for MLang predicates (EQ/GT/AND/OR/IN/CONTAINS), aggregation sinks (COUNT/SUM/GROUP_BY), and ordering — covering both the static import style (Java) and `ExpressionsSingleton`/mixin style (JS).

**[DSL](DSL.md)**
Argues that FOAM's power comes from layered DSLs that collaborate: `foam.CLASS` as an internal DSL, parser combinators for grammars, AQL as an external query DSL, and MLang as an internal predicate DSL — each layer able to introspect the one below.

**[foam_parsers_doc](foam_parsers_doc.md)**
Comprehensive reference for FOAM's grammar-based parser library: all simple parsers (`literal`, `range`, `chars`, `notChars`), combinators (`seq`, `alt`, `repeat`, `optional`, `until`, `str`), Grammar creation with `sym`, semantic actions, auto-complete suggestions with `sug()`, and SmartView integration.

**[foam_parser_callback_system_explained](foam_parser_callback_system_explained.md)**
Deep-dive on FOAM's parser callback system: the `apply` intercept mechanism on `StringPStream`, the two callback types (apply for low-level interception vs. semantic actions for symbol-level transformation), error detection, and `grammar.getLastError()`.

**[AutoQueryParser](AutoQueryParser.md)**
Syntax reference for AQL (AutoQueryParser Query Language): AND/OR/NOT/grouping operators and value types (strings, numbers, booleans, dates, enums, StringArrays). Designed to work with the SmartView autocomplete component.

---

## Reference

**[RISCyAPIs](RISCyAPIs.md)**
Applies the CISC vs RISC CPU analogy to framework API design. Because FOAM generates most of its own API calls rather than humans writing them, its APIs can be small, regular, and optimized for programmatic generation (like RISC) rather than for human ergonomics.

**[StyleGuide](StyleGuide.md)**
FOAM coding style guidelines: Google JS Style Guide with FOAM exceptions (spaces inside parens, space after `!`, single-line braces under 80 chars, two-space indentation), naming conventions (CamelCase models, camelCase properties, UPPER_SNAKE constants), and the preference for modelling over prototyping.

**[cheat-sheet](cheat-sheet.md)**
A long-form FOAM3 cheat sheet covering model/class definition syntax, property types and defaults, expression/dynamic behaviors, methods, listeners, actions, DAOs, reactivity patterns, and context/import/export patterns. Good to have open while writing FOAM code.

**[PropertyGotchas](PropertyGotchas.md)**
Catalog of non-obvious property behaviors: when `postSet` doesn't fire (value default, equal slot binding, deserialization ordering), why an `expression` goes cold (lazy one-shot subscription), `javaFactory` frozen-safety mechanics, `javaGetter` values not reaching the client via the `isSet` gate, and what `transient` cascades into. Read this when a property change seems to be silently ignored.

**[Debugging](Debugging.md)**
Practical debugging guide for both JavaScript (Chrome DevTools: breakpoints, `postSet` debugger trick, console commands, network tab) and Java (JDPA remote debugging in VS Code and IntelliJ, source file locations).

**[DebuggingCountAndUsed](DebuggingCountAndUsed.md)**
Explains two FOAM debugging tools: `cls.count_` (tracks instance creation count per class, incremented in `create()`) and `foam.USED` (registry of all classes actually instantiated in the current session, moved from `foam.UNUSED` on first lookup).

**[Testing](Testing.md)**
Covers the FOAM test harness: running all/server/client tests from the build, running specific test IDs or suites, excluding tests with `-`, the per-test SUCCESS/FAILURE output format, and modelling test cases as FOAM classes or scripts targeting Java or JavaScript.

**[APITesting](APITesting.md)**
Covers FOAM's built-in API testing support via the DIG (Data Interchange Gateway) client, which lets tests act as external users with scoped sessions while retaining full server-side DAO access. Extends `foam.core.test.AbstractDIGTest`.

**[Porting](Porting.md)**
Migration guide from FOAM1 to FOAM2/FOAM3: key API renames (`CLASS` → `foam.CLASS`, `lazyFactory` → `factory`, `defaultValueFn` → `expression`, `traits` → `implements`, `addListener` → `sub`) and behavioral differences (Promise-based DAO, CSS axiom, U2/U3 only, no built-in prototype extension).

**[DateTimeUTC](DateTimeUTC.md)**
Documents the `DateTimeUTC` property type: UTC storage, UTC parsing, and UTC display guarantees, how it differs from `Date` and `DateTime`, supported input formats, and the utility classes (`DateUtil`, `DateParser`) that back it.

**[i18n](i18n.md)**
Beginner guide to FOAM i18n: declaring translatable strings with `messages:`/`messageMap` in model code, multi-language messageMap fallback rules, and inline localized labels. Runtime Locale rows and localeDAO are covered in the advanced guide.

**[i18n-advanced](i18n-advanced.md)**
Advanced runtime i18n: how `messageMap` and `localeDAO` relate and sync at boot, adding Locale rows, controlling language picker availability via Language rows with an `enabled` flag, and the message-override lifecycle.

**[VsSpring](VsSpring.md)**
Compares FOAM (model-driven, cross-language, context DI, axiom extensibility) vs Spring Boot (annotation-driven, Java IoC container, auto-configuration, Java-only) across architecture, dependency management, and server-side approach.
