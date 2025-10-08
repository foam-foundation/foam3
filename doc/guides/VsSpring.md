## Overview

FOAM (Feature Oriented Active Modeller), is a full-stack model-driven framework, and Spring Boot, is a popular Java application framework<cite/>. Both are enterprise-grade frameworks for building server-side applications, but they take fundamentally different architectural approaches<cite/>.

## Core Philosophy

**FOAM** is a **model-driven, cross-language framework** where you define declarative models that generate code for multiple platforms (JavaScript, Java, Swift) [1](#1-0) . The framework centers on `foam.CLASS()` definitions that describe properties, methods, and behaviors [2](#1-1) .

**Spring Boot** is a **convention-over-configuration Java framework** built on dependency injection and annotations. It focuses on rapid application development with auto-configuration and embedded servers.

## Architecture Patterns

### FOAM's Approach

FOAM uses a unified class system across languages with declarative models [2](#1-1) :

```javascript
foam.CLASS({
  package: 'com.google.project',
  name: 'MyModel',
  extends: 'com.google.project.MyBaseModel',
  properties: [...],
  methods: [...],
  javaImports: [...]
});
```

Key architectural features:
- **Context-based dependency injection** through `imports`/`exports` [3](#1-2)
- **Cross-language code generation** from single model definitions [4](#1-3)
- **Self-modeling system** where Model is defined using itself [5](#1-4)
- **Axiom-based extensibility** for adding features to classes [6](#1-5)

### Spring Boot's Approach

Spring Boot uses Java annotations and auto-configuration:

```java
@RestController
@Service
public class MyService {
  @Autowired
  private UserRepository userRepository;

  @GetMapping("/users")
  public List<User> getUsers() { ... }
}
```

Key features:
- **Annotation-based configuration** (`@Component`, `@Service`, `@Autowired`)
- **Dependency injection** via Spring IoC container
- **Auto-configuration** for common patterns
- **Java-only** runtime

## Dependency Management

**FOAM** has a sophisticated multi-tier system:
- `requires:` for class dependencies (factory methods) [7](#1-6)
- `imports:` for runtime dependency injection of services [8](#1-7)
- `javaImports:` for Java code generation imports [9](#1-8)
- Works across networks for distributed services [10](#1-9)

**Spring Boot** uses:
- `@Autowired` or constructor injection for dependency injection
- Maven/Gradle for build-time dependencies
- Standard Java imports
- Service discovery for distributed systems (Spring Cloud)

## Data Access Layer

**FOAM** includes a comprehensive DAO (Data Access Object) system with decorator pattern [11](#1-10) :
- `EasyDAO` facade for assembling DAO chains [12](#1-11)
- Built-in decorators for caching, authorization, validation, logging
- File-based persistence with `JDAO` [13](#1-12)
- Memory storage with `MDAO`
- Network-transparent client/server DAOs
- Query language via MLang

**Spring Boot** uses:
- Spring Data JPA/JDBC for database access
- Repository pattern with `@Repository`
- JPA entities with `@Entity`
- External databases (PostgreSQL, MySQL, etc.)
- JPQL/HQL for queries

## Code Generation vs Runtime

**FOAM** generates code at build time:
- Single model definition generates JavaScript, Java, and Swift code [4](#1-3)
- Java code generation from JavaScript models [14](#1-13)
- PropertyInfo classes for metadata access
- Cross-platform consistency guaranteed

**Spring Boot** is runtime-based:
- Reflection and proxies at runtime
- Annotation processing at compile time
- No cross-language code generation
- Java bytecode manipulation (AOP)

## Context and Dependency Injection

**FOAM's Context System**:
- Immutable context chain with inheritance [15](#1-14)
- `__context__` and `__subContext__` for service propagation [16](#1-15)
- Declarative `imports`/`exports` for loose coupling [8](#1-7)
- Works across network boundaries
- Context-aware object creation via `this.ClassName.create()` [17](#1-16)

**Spring's IoC Container**:
- Application context with bean lifecycle
- `@Autowired`, `@Inject`, or constructor injection
- Scopes (singleton, prototype, request, session)
- Profiles for environment-specific configuration
- Primarily local (same JVM)

## Server Architecture

**FOAM** provides:
- Built-in Java application server (CORE) [18](#1-17)
- Box-based communication for client-server [19](#1-18)
- Session management via `SessionClientBox`
- HTTP and WebSocket support
- Network-transparent DAO access

**Spring Boot** provides:
- Embedded Tomcat/Jetty/Undertow
- REST controllers with `@RestController`
- WebSocket support
- Spring Security for authentication/authorization
- Actuator for monitoring

## Development Experience

**FOAM** requires:
- Learning FOAM-specific concepts (axioms, contexts, DAOs) [6](#1-5)
- Understanding model-driven development
- Cross-language thinking
- Build dependencies: Node.js, Maven, Java 11+ [20](#1-19)

**Spring Boot** requires:
- Java knowledge
- Understanding Spring annotations
- Familiarity with Spring ecosystem
- Maven/Gradle build tools

## Persistence and Journaling

**FOAM** includes built-in persistence:
- `JDAO` for file-based journaling [13](#1-12)
- Configurable journal types and replay strategies [21](#1-20)
- NDiff support for efficient updates
- Read-only and runtime-only modes
- Synchronous/asynchronous replay options

**Spring Boot** requires:
- External database configuration
- JPA/Hibernate for ORM
- Flyway/Liquibase for migrations
- Manual transaction management

## Use Cases

**FOAM** excels at:
- Cross-platform applications (web, mobile, server)
- Complex data models with rich metadata
- Applications requiring code generation
- Systems needing built-in persistence without external databases
- Enterprise applications with sophisticated business logic

**Spring Boot** excels at:
- Java-based microservices
- REST API development
- Integration with Spring ecosystem (Security, Cloud, Batch)
- Traditional database-backed applications
- Rapid prototyping with auto-configuration

## Notes

FOAM is a full-stack, model-driven framework with cross-language code generation and built-in data persistence, while Spring Boot is a Java-specific framework focused on convention-over-configuration and rapid application development<cite/>. FOAM's context-based dependency injection and DAO system provide a unified programming model across client and server, whereas Spring Boot requires separate frontend frameworks and relies on external databases<cite/>. FOAM has a steeper learning curve due to its unique concepts, but provides more built-in functionality for complex enterprise applications<cite/>.

Wiki pages you might want to explore:
- [FOAM Framework Overview (kgrgreer/foam3)](/wiki/kgrgreer/foam3#1)

### Citations

**File:** README.md (L20-29)
```markdown
## Feature Oriented Active Modeller

FOAM is a modeling tool and class based object system.  To use FOAM,
you create a model of your class by describing the properties, methods,
event topics, listeners, and dependencies of your class.  FOAM takes
this model and generates a usable JavaScript class along with several
companion features such as database support and network marshaling.

While FOAM is written in JavaScript, it can be used to generate code
for any language or platform, including Android Java and iOS Swift.
```

**File:** README.md (L32-48)
```markdown
## Dependencies

FOAM has no runtime dependencies, but does have build dependencies:

* git
* npm
* nodejs (version >= 16)
* maven
* java (version >= 11)

Once dependencies are installed, update FOAM's javascript dependencies:
From the root of the FOAM repository, execute:

    ./build.sh --install

    sudo chown -R $USER /opt

```

**File:** README.md (L160-163)
```markdown
## CORE
To run CORE, the FOAM Java Application Server, run:
`./build.sh -Jdemo`
then connect to http://localhost:8080
```

**File:** doc/guides/cheat-sheet.md (L38-77)
```markdown
Model/class definition:
```javascript
foam.CLASS({
  package: 'com.google.project',
  name: 'MyModel',
  extends: 'com.google.project.MyBaseModel',
  implements: [
    'com.google.project.MyFirstTrait',
    'com.google.project.MyFirstSecondTrait'
  ],
  requires: [
    'foam.ui.DetailView',
    'com.google.project.MyOtherModel'
  ],
  imports: ['myOtherModelExportedProperty'],
  exports: ['myModelExportedProperty'],
  constants: {
     CONSTANT1: value,
     ...
  },
  topics: [
  ],
  axioms: [
  ],
  properties: [
    …
  ],
  methods: [
    …
  ],
  templates: [
    …
  ],
  actions: [
    …
  ],
  listeners: [
    …
  ]
});
```

**File:** doc/guides/cheat-sheet.md (L341-368)
```markdown
Every FOAM object has two context variables:
**`__context__`** - The main context passed when object was created.
**`__subContext__`** - Created only if object has `exports`; contains main context + exported services.

Context variables:
```javascript
// Object with no exports
var obj = SomeClass.create({}, mainContext);
console.log(obj.__context__);    // mainContext
console.log(obj.__subContext__); // same as __context__

// Object with exports creates subcontext
foam.CLASS({
  name: 'Service',
  exports: ['userDAO', 'as notificationService']
});

var service = Service.create({}, mainContext);
console.log(service.__context__);    // mainContext
console.log(service.__subContext__); // mainContext + exports (userDAO, notificationService)
```

Context inheritance:
```javascript
// Child inherits parent's __subContext__ as its __context__
var child = ChildView.create({}, service.__subContext__);
console.log(child.__context__); // mainContext + parent's exports
```
```

**File:** doc/guides/cheat-sheet.md (L391-420)
```markdown
## **Context and Object Creation**

Always use `requires` + `this.ClassName.create()` for proper context inheritance.

Context-aware object creation:
```javascript
foam.CLASS({
  requires: ['foam.u2.DetailView', 'com.project.MyModel'],
  methods: [
    function render() {
      // Inherits full context (imports, exports, etc.)
      var view = this.DetailView.create({ data: this.data });
      var model = this.MyModel.create({ name: 'test' });
    }
  ]
});
```

Direct instantiation (loses context):
```javascript
foam.CLASS({
  methods: [
    function render() {
      // No context inheritance - imports/exports unavailable
      var view = foam.u2.DetailView.create({ data: this.data });
      var model = com.project.MyModel.create({ name: 'test' });
    }
  ]
});
```
```

**File:** src/foam/lang/Context.js (L27-44)
```javascript

/**
 * Context Support
 *
 * Contexts, also known as frames, scopes or environments, are used to store
 * named resources. They provide an object-oriented replacement for global
 * variables. Contexts are immutable. New bindings are added by creating
 * "sub-contexts" with new bindings, from an existing parent context.
 * Sub-contexts inherit bindings from their parent.
 *
 * Contexts provide a form of inversion-of-control or dependendency-injection.
 * Normally, contexts are not explicitly used because FOAM's imports/exports
 * mechanism provides a high-level declarative method of dependency management
 * which hides their use.
 *
 * foam.__context__ references the root context, which is the ancestor of all other
 * contexts.
 */
```

**File:** src/foam/lang/Boot.js (L18-53)
```javascript
/**
 FOAM Bootstrap
<p>
 FOAM uses Models to specify class definitions.
 The FOAM Model class is itself specified with a FOAM model, meaning
 that Model is defined in the same language which it defines.
 This self-modeling system requires some care to bootstrap, but results
 in a very compact, uniform, and powerful system.
<pre>

 FObject -> FObject Class                     Prototype
    ^                        +-.prototype---------^
    |                        |                    |
  Model  -> buildClass()  -> Class -> create() -> instance
</pre>
  FObject is the root model/class of all other classes, including Model.
  Abstract Class is the prototype of FObject's Class, which makes it the root of all Classes.
  From a Model we call buildClass() to create a Class (or the previously created Class) object.
  From the Class we call create() to create new instances of that class.
  New instances extend the classes prototype object, which is stored on the class as .prototype.
<pre>
  instance ---> .cls_   -> Object's Class
       |
       +------> .model_ -> Object's Model
</pre>
  All descendents of FObject have references to both their Model and Class.
    - obj.cls_ refers to an Object's Class
    - obj.model_ refers to an Object's Model

<p>  Classes also refer to their Model with .model_.

<p>  Model is its own definition:
<pre>
    Model.buildClass().create(Model) == Model
    Model.model_ === Model
</pre>
```

**File:** src/foam/lang/Boot.js (L54-97)
```javascript
  Models are defined as a collection of Axioms.
  It is the responsibility of Axioms to install itself onto a Model's Class and/or Prototype.

<p>
  Axioms are defined with the following psedo-interface:
<pre>
    public interface Axiom {
      optional installInClass(cls)
      optional installInProto(proto)
    }
</pre>
  Ex. of a Model with one Axiom:
<pre>
  foam.CLASS({
    name: 'Sample',

    axioms: [
      {
        name: 'axiom1',
        installInClass: function(cls) { ... },
        installInProto: function(proto) { ... }
      }
    ]
  });
</pre>
  Axioms can be added either during the initial creation of a class and prototype,
  or anytime after.  This allows classes to be extended with new functionality,
  and this is very important to the bootstrap process because it allows us to
  start out with very simple definitions of Model and FObject, and then build
  them up until they're fully bootstrapped.
<p>
  However, raw axioms are rarely used directly. Instead we model higher-level
  axiom types, including:
<ul>
  <li>Requires   - Require other classes
  <li>Imports    - Context imports
  <li>Exports    - Context exports
  <li>Implements - Declare interfaces implemented / mix-ins mixed-in
  <li>Constants  - Add constants to the prototype and class
  <li>Properties - High-level instance variable definitions
  <li>Methods    - Prototype methods
  <li>Topics     - Publish/sub topics
  <li>Listeners  - Like methods, but with extra features for use as callbacks
</ul>
```

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L19-51)
```markdown
## `requires:` - Class Dependencies

### Purpose
Declares class dependencies so you can refer to classes by their short name rather than their fully qualified name. **`requires` requires classes.**

### Conceptual Model
When you `requires: 'com.acme.Foo'`, you can refer to it as just `Foo` rather than its fully qualified name `com.acme.Foo`. This is similar to:
- `require()` statements in JavaScript
- `import` statements in Java
- `#include` in C++

### Syntax
```javascript
foam.CLASS({
  name: 'MyClass',
  requires: [
    'foam.u2.DetailView',                           // Available as this.DetailView
    'foam.dao.MDAO',                               // Available as this.MDAO
    'foam.net.web.XMLHTTPRequest as HTTPRequest'   // Available as this.HTTPRequest
  ]
});
```

### How It Works
- Classes listed in `requires` become available as factory methods
- Accessed via `this.ClassName` (e.g., `this.DetailView`, `this.MDAO`)
- Factory methods create new instances: `this.DetailView.create()`
- Supports aliasing with the `as` keyword
- **These are classes/constructors, not instances**
- When you call `this.Abc.create(args)`, it automatically calls `this.Abc.create(args, this)` - the current context (`this`) is added as the second argument
- The second argument to `create()` is either a context or an object whose `.subContext` is used
- If you created `com.acme.Abc` directly you would need to manually pass `this` as the second argument, but `this.Abc.create()` adds it automatically
- This automatic context passing is needed to support dependency injection and the import/export system
```

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L96-133)
```markdown
## `imports:` - Dependency Injection

### Purpose
Declares that you want a **live instance** of a service or value for use in your class. This is **dependency injection** or **inversion of control**.

**You get runtime objects/services, not classes.**

### Conceptual Model
Instead of your class going fishing around the system looking for services (which leads to complexity and tight-coupling), you simply declare what services you want to import and they're provided to you - even possibly from across the network.

This follows the **dependency injection** pattern:
- **Don't ask for dependencies** - declare what you need
- **Dependencies are injected** into your class at runtime
- **Loose coupling** - your class doesn't know where dependencies come from
- **Testability** - dependencies can be easily mocked or substituted

### Syntax
```javascript
foam.CLASS({
  name: 'MyView',
  imports: [
    'currentUser',              // A user object instance
    'userDAO',                  // A live DAO instance
    'log',                      // A logging service instance
    'optionalService?',         // Optional service (won't error if missing)
    'someDAO as myDAO'          // Aliased service
  ]
});
```

### How It Works
- Values from the parent context are injected as properties
- Accessed directly via `this.propertyName`
- **Values are instances/objects/services, not classes**
- Supports optional imports with `?` suffix
- Supports aliasing with the `as` keyword
- Dependencies can come from anywhere in the context chain, even across networks

```

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L334-352)
```markdown
### Network Services
`imports:` can work across networks:

```javascript
foam.CLASS({
  name: 'ClientView',

  imports: [
    'userService'  // Could be a remote service accessed over HTTP
  ],

  methods: [
    function loadUser() {
      // userService might be running on a different server
      return this.userService.getCurrentUser();
    }
  ]
});
```
```

**File:** doc/templates/Model.js (L71-74)
```javascript
   javaImports: [
     'com.acme.package.ClassX',
     'com.acme.package.ClassY',
   ],
```

**File:** src/foam/dao/EasyDAO.js (L18-78)
```javascript
foam.CLASS({
  package: 'foam.dao',
  name: 'EasyDAO',
  extends: 'foam.dao.ProxyDAO',

  implements: [
    'foam.mlang.Expressions'
  ],

  documentation: `
    Facade for easily creating decorated DAOs.
    <p>
    Most DAOs are most easily created and configured with EasyDAO.
    Simply require foam.dao.EasyDAO and create() with the flags
    to indicate what behavior you're looking for. Under the hood, EasyDAO
    will create one or more DAO instances to service your requirements and then
  `,

  requires: [
    'foam.box.HTTPBox',
    'foam.box.RetryBox',
    'foam.box.SessionClientBox',
    'foam.box.SocketBox',
    'foam.box.TimeoutBox',
    'foam.box.WebSocketBox',
    'foam.dao.CachingDAO',
    'foam.dao.ClientDAO',
    'foam.dao.CompoundDAODecorator',
    'foam.dao.ContextualizingDAO',
    'foam.dao.DeDupDAO',
    'foam.dao.InterceptedDAO',
    'foam.dao.DAO',
    'foam.dao.GUIDDAO',
    'foam.dao.IDBDAO',
    {
      path: 'foam.dao.JDAO',
      flags: ['js']
    },
    {
      name: 'JDAOJava',
      path: 'foam.dao.java.JDAO',
      flags: ['java']
    },
    'foam.dao.MDAO',
    'foam.dao.OrderedDAO',
    'foam.dao.PromisedDAO',
    'foam.dao.QueryCachingDAO',
    'foam.dao.TTLCachingDAO',
    'foam.dao.TTLSelectCachingDAO',
    'foam.dao.RequestResponseClientDAO',
    'foam.dao.SequenceNumberDAO',
    'foam.dao.SyncDAO',
    'foam.dao.TimingDAO',
    'foam.dao.JournalType',
    'foam.core.auth.ServiceProviderAware',
    'foam.core.auth.ServiceProviderAwareDAO',
    'foam.core.crunch.box.CrunchClientBox',
    'foam.core.logger.Logger',
    'foam.core.logger.LoggingDAO',
    'foam.core.theme.SubdomainAwareDAO'
  ],
```

**File:** src/foam/dao/java/JDAO.js (L7-49)
```javascript
foam.CLASS({
  package: 'foam.dao.java',
  name: 'JDAO',
  extends: 'foam.dao.ProxyDAO',
  flags: ['java'],

  documentation: `Implements a Journal DAO - a file based DAO.
In this current implementation setDelegate must be called last.`,

  javaImports: [
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.CompositeJournal',
    'foam.dao.DAO',
    'foam.dao.F3FileJournal',
    'foam.dao.Journal',
    'foam.dao.MDAO',
    'foam.dao.NullJournal',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.dao.WriteOnlyF3FileJournal',
    'foam.core.boot.CSpec',
    'foam.core.ndiff.NDiffJournal'
  ],

  javaCode: `
    // TODO: These convenience constructors should be removed and done using the facade pattern.
    public JDAO(X x, foam.lang.ClassInfo classInfo, String filename) {
      this(x, new MDAO(classInfo), filename, false);
    }

    public JDAO(X x, DAO delegate, String filename) {
      this(x, delegate, filename, false);
    }

    public JDAO(X x, DAO delegate, String filename, Boolean cluster) {
      setX(x);
      setOf(delegate.getOf());
      setFilename(filename);
      setCluster(cluster);
      setDelegate(delegate);
    }
  `,
```

**File:** src/foam/dao/java/JDAO.js (L51-93)
```javascript
  properties: [
    {
      name: 'filename',
      class: 'String'
    },
    {
      name: 'cluster',
      class: 'Boolean',
      value: false
    },
    {
      class: 'FObjectProperty',
      of: 'foam.dao.Journal',
      name: 'journal'
    },
    {
      documentation: 'See F3FileJournal. Default journal replay is asynchronous. Some models with business logic that reference self can cause deadlock when parsed out of order.  If journal processing hangs, set syncReplay to true to replay synchronously.',
      class: 'Boolean',
      name: 'syncReplay'
    },
    {
      documentation: `Force caller to wait on nspec initailzation. The first call to 'get' for an nspec (x.get(servicename)) will have the calling thread wait on reply of service. This is the default behaviour and should be used for all essential services.  Also this should be used if the model is using SeqNo or NUID for id generation.`,
      class: 'Boolean',
      name: 'waitReplay',
      value: true
    },
    {
      documentation: 'Filesystem is read-only, journals updates are factilitated through some other means such as medusa.',
      class: 'Boolean',
      name: 'readOnly',
      javaFactory: 'return "ro".equals(System.getProperty("FS", "rw"));'
    },
    {
      documentation: 'Only load the runtime generated journal file.  Used by Medusa to bootstrap a system with existing data.',
      class: 'Boolean',
      name: 'runtimeOnly',
      value: false
    },
    {
      documentation: `Enable NDiff in JDAO. Enable per DAO with this property or globally via JVM Parameter 'UseNDiff', see EasyDAO.ndiff`,
      class: 'Boolean',
      name: 'ndiff'
    },
```

**File:** src/foam/swift/GenSwift.js (L7-22)
```javascript
foam.CLASS({
  package: 'foam.swift',
  name: 'GenSwift',
  flags: ['swift','node'],
  requires: [
    'foam.lang.Model',
    'foam.swift.Enum',
    'foam.swift.EnumValue',
    'foam.swift.SwiftClass',
    'foam.swift.EmptyClass',
    'foam.swift.Field',
    'foam.swift.Method',
  ],
  imports: [
    'classloader',
  ],
```
