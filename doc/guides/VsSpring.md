<flow name="VsSpring" category="DOC/GUIDE" spid="foam" description="Compares FOAM (model-driven, cross-language, context DI) vs Spring Boot (annotation-driven, Java IoC container)." keywords="spring,comparison,ioc,java,knowledge"/>

## Overview

FOAM (Feature Oriented Active Modeller), is a full-stack model-driven framework, and Spring Boot, is a popular Java application framework. Both are enterprise-grade frameworks for building server-side applications, but they take fundamentally different architectural approaches.

## Core Philosophy

**FOAM** is a **model-driven, cross-language framework** where you define declarative models that generate code for multiple platforms (JavaScript, Java, Swift). The framework centers on `foam.CLASS()` definitions that describe properties, methods, and behaviors.

**Spring Boot** is a **convention-over-configuration Java framework** built on dependency injection and annotations. It focuses on rapid application development with auto-configuration and embedded servers.

## Architecture Patterns

### FOAM's Approach

FOAM uses a unified class system across languages with declarative models:

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
- **Context-based dependency injection** through `imports`/`exports`
- **Cross-language code generation** from single model definitions
- **Self-modeling system** where Model is defined using itself
- **Axiom-based extensibility** for adding features to classes

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
- `requires:` for class dependencies (factory methods)
- `imports:` for runtime dependency injection of services
- `javaImports:` for Java code generation imports
- Works across networks for distributed services

**Spring Boot** uses:
- `@Autowired` or constructor injection for dependency injection
- Maven/Gradle for build-time dependencies
- Standard Java imports
- Service discovery for distributed systems (Spring Cloud)

## Data Access Layer

**FOAM** includes a comprehensive DAO (Data Access Object) system with decorator pattern:
- `EasyDAO` facade for assembling DAO chains
- Built-in decorators for caching, authorization, validation, logging
- File-based persistence with `JDAO`
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

**FOAM** generates Java (and Swift) code at build time and builds JavaScript classes at runtime:
- Single model definition generates JavaScript, Java, and Swift code
- Java code generation from JavaScript models
- PropertyInfo classes for metadata access
- Cross-platform consistency guaranteed

**Spring Boot** is runtime-based:
- Reflection and proxies at runtime
- Annotation processing at compile time
- No cross-language code generation
- Java bytecode manipulation (AOP)

## Context and Dependency Injection

**FOAM's Context System**:
- Immutable context chain with inheritance
- `__context__` and `__subContext__` for service propagation
- Declarative `imports`/`exports` for loose coupling
- Works across network boundaries
- Context-aware object creation via `this.ClassName.create()`

**Spring's IoC Container**:
- Application context with bean lifecycle
- `@Autowired`, `@Inject`, or constructor injection
- Scopes (singleton, prototype, request, session)
- Profiles for environment-specific configuration
- Primarily local (same JVM)

## Server Architecture

**FOAM** provides:
- Built-in Java application server (CORE)
- Box-based communication for client-server
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
- Learning FOAM-specific concepts (axioms, contexts, DAOs)
- Understanding model-driven development
- Cross-language thinking
- Build dependencies: Node.js, Maven, Java 21+

**Spring Boot** requires:
- Java knowledge
- Understanding Spring annotations
- Familiarity with Spring ecosystem
- Maven/Gradle build tools

## Persistence and Journaling

**FOAM** includes built-in persistence:
- `JDAO` for file-based journaling
- Configurable journal types and replay strategies
- NDiff support for efficient updates
- Read-only and runtime-only modes

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

FOAM is a full-stack, model-driven framework with cross-language code generation and built-in data persistence, while Spring Boot is a Java-specific framework focused on convention-over-configuration and rapid application development. FOAM's context-based dependency injection and DAO system provide a unified programming model across client and server, whereas Spring Boot requires separate frontend frameworks and relies on external databases. FOAM has a steeper learning curve due to its unique concepts, but provides more built-in functionality for complex enterprise applications.

Wiki pages you might want to explore:
- [FOAM Framework Overview (foam-foundation/foam3)](https://deepwiki.com/foam-foundation/foam3#1)

### Citations

**File:** README.md (L27-36)
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

**File:** README.md (L39-52)
```markdown
## Dependencies

FOAM has no runtime dependencies, but does have build dependencies:

* git
* npm
* nodejs (version >= 16)
* maven
* java (version >= 21)

Once dependencies are installed, update FOAM's javascript dependencies:
From the root of the FOAM repository, execute:

    ./build.sh --install

    sudo chown -R $USER /opt

```

**File:** README.md (L188-194)
```markdown
## CORE
To run CORE, the FOAM Java Application Server, run:

    ./build.sh -Jdemo

- visit: http://localhost:8080
- login with username `admin` and password `admin`
```

**File:** doc/guides/cheat-sheet.md (L40-80)
````markdown
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
    'foam.u2.detail.SectionedDetailView',
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
````

**File:** doc/guides/cheat-sheet.md
````markdown
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
````

**File:** doc/guides/cheat-sheet.md
````markdown
## **Context and Object Creation**

Always use `requires` + `this.ClassName.create()` for proper context inheritance.

Context-aware object creation:
```javascript
foam.CLASS({
  requires: ['foam.u2.detail.SectionedDetailView', 'com.project.MyModel'],
  methods: [
    function render() {
      // Inherits full context (imports, exports, etc.)
      var view = this.SectionedDetailView.create({ data: this.data });
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
      var view = foam.u2.detail.SectionedDetailView.create({ data: this.data });
      var model = com.project.MyModel.create({ name: 'test' });
    }
  ]
});
```
````

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
````markdown
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
````

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L96-133)
````markdown
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

````

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L334-352)
````markdown
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
````

**File:** doc/templates/Model.js (L71-74)
```javascript
   javaImports: [
     'com.acme.package.ClassX',
     'com.acme.package.ClassY',
   ],
```

**File:** src/foam/dao/java/JDAO.js (L7-54)
```javascript
foam.CLASS({
  package: 'foam.dao.java',
  name: 'JDAO',
  extends: 'foam.dao.ProxyDAO',
  flags: ['java'],

  documentation: `Implements a Journal DAO - a file based DAO.
In this current implementation setDelegate must be called last.`,

  javaImports: [
    'foam.lang.X',
    'foam.dao.BulkLoadDAO',
    'foam.dao.CompositeJournal',
    'foam.dao.DAO',
    'foam.dao.F3FileJournal',
    'foam.dao.Journal',
    'foam.dao.MDAO',
    'foam.dao.NullJournal',
    'foam.dao.JournalGenerations',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.dao.WriteOnlyF3FileJournal',
    'foam.core.boot.CSpec',
    'foam.core.ndiff.NDiffJournal',
    'foam.dao.compaction.CompactionCmd',
    'foam.dao.compaction.Compactor',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.List'
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

**File:** src/foam/dao/java/JDAO.js (L56-87)
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
