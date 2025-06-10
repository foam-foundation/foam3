# FOAM3 Dependencies: `requires` vs `imports`

This document explains the differences between `requires` and `imports` in the FOAM3 framework and when each should be used in the codebase.

## Overview

FOAM3 provides multiple mechanisms for managing dependencies between classes and accessing runtime context. The two primary mechanisms are:

- **`requires:`** - For declaring class dependencies (like "requires" in JS and "imports" in Java)
- **`imports:`** - For dependency injection of runtime services and values

## Cross-Language Design Philosophy

FOAM is designed to be cross-language compatible, which means it can't easily adopt conventions from any single language. This leads to some naming that might seem counterintuitive at first:

- **`requires:`** works like "requires" in JavaScript and "imports" in Java - it declares which other code/classes you want to use
- **`imports:`** is about dependency injection - getting live runtime instances of services or objects

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

### Examples from Codebase

**Basic Usage:**
```javascript
// File: src/com/example/models/Transaction.js
foam.CLASS({
  package: 'com.example.models',
  name: 'Transaction',
  
  requires: [
    'com.example.views.TransactionFormDetailView'
  ]
  // Instead of: com.example.views.TransactionFormDetailView.create()
  // You can use: this.TransactionFormDetailView.create()
});
```

**Complex View with Multiple Dependencies:**
```javascript
// File: foam3/src/foam/u2/wizard/IncrementalStepWizardView.js
foam.CLASS({
  package: 'foam.u2.wizard',
  name: 'IncrementalStepWizardView',
  extends: 'foam.u2.View',
  
  requires: [
    'foam.lang.Action',
    'foam.log.LogLevel',
    'foam.u2.detail.SectionView',
    'foam.u2.dialog.Popup',
    'foam.u2.dialog.SimpleActionDialog'
  ]
  // All classes available without full package names
});
```

### When to Use `requires`
- ✅ When you need to create instances of other FOAM classes
- ✅ For view classes, DAO classes, service classes
- ✅ When building complex UI components that compose other views
- ✅ For factory methods and class construction
- ✅ When you want to avoid typing full qualified class names

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

### Examples from Codebase

**Basic Context Injection:**
```javascript
// File: src/com/example/views/MenuView.js
foam.CLASS({
  package: 'com.example.views',
  name: 'MenuView',
  extends: 'foam.core.menu.VerticalMenu',

  imports: [
    'currentProgram',    // Live program object
    'isMenuOpen'        // Boolean state value
  ]
  // Access: this.currentProgram (the actual object)
  //         this.isMenuOpen (the actual boolean value)
});
```

**Service Injection:**
```javascript
// File: foam3/src/foam/u2/wizard/debug/WizardInspector.js
foam.CLASS({
  package: 'foam.u2.wizard.debug',
  name: 'WizardInspector',
  extends: 'foam.u2.Controller',

  imports: [
    'wizardController',    // Live controller instance
    'crunchController'     // Live controller instance
  ]
  // These are actual running controller objects, not classes
});
```

### When to Use `imports`
- ✅ When you need **services** or **data** from the application context
- ✅ For **dependency injection** of runtime values
- ✅ When accessing **DAOs**, **services**, or **configuration** from parent contexts
- ✅ For **logging services**, **authentication context**, or **global state**
- ✅ When you want **loose coupling** and **testability**
- ✅ When the dependency might not always be available (use `?`)

## `exports:` - Making Services Available

### Purpose
The flip side of `imports:` - declares what objects or values you want to make available to descendants in the context chain.

### Syntax
```javascript
foam.CLASS({
  name: 'MyService',
  
  exports: [
    'userDAO',           // Export userDAO property to children
    'this as myService', // Export entire instance
    'log as logger'      // Export with alias
  ]
});
```

### How It Works
- Exported values become available in the context for child components
- Child components can `import` these exported values
- Creates a context chain where services flow down to descendants
- Enables **inversion of control** architecture

## Key Differences Summary

| Aspect | `requires` | `imports` |
|--------|------------|-----------|
| **Purpose** | Class name resolution | Service injection |
| **Result** | Factory methods | Direct property access |
| **Type** | Classes/constructors | Instances/values/services |
| **Source** | Static class definitions | Runtime execution context |
| **Analogy** | `import` in Java, `require()` in JS | Dependency injection frameworks |
| **Creation** | `this.ClassName.create()` | `this.serviceName` |
| **Coupling** | Compile-time dependencies | Runtime loose coupling |
| **Testability** | Hard to mock classes | Easy to inject test doubles |
| **Network** | Local class resolution only | Can import across network |
| **Optional** | No | Yes (with `?`) |

## Dependency Injection Benefits

### Without Dependency Injection (Tight Coupling)
```javascript
// BAD: Tight coupling - knowing application architecture explicitly
foam.CLASS({
  name: 'BadExample',
  methods: [
    function init() {
      // Tight coupling - requires knowing the exact architecture path
      this.userDAO = this.frame.controller.session.daoAccessor.userDAO;
      // If the structure changes, all client code breaks
    }
  ]
});

// STILL LOOSE but more work:
foam.CLASS({
  name: 'LooseCouplingExample',
  methods: [
    function init() {
      // Context lookup is still loose-coupling, just more work
      this.userDAO = this.__context__.lookup('userDAO');
      this.logger = this.__context__.lookup('log');
      // What if they're not there? What if they move?
    }
  ]
});
```

### With Dependency Injection (Loose Coupling)
```javascript
// GOOD: Dependencies are injected
foam.CLASS({
  name: 'GoodExample',
  
  imports: [
    'userDAO',    // I need a user DAO - don't care where it comes from
    'log'         // I need logging - don't care how it's implemented
  ],
  
  methods: [
    function someMethod() {
      // Just use the injected dependencies
      this.userDAO.find(id).then(user => {
        this.log.info('Found user:', user.name);
      });
    }
  ]
});
```

## Cross-Language Comparison

| Language | Class Import | Service Injection |
|----------|-------------|-------------------|
| **FOAM** | `requires:` | `imports:` |
| **Java** | `import com.acme.Foo` | `@Inject` annotations |
| **JavaScript** | `require('./Foo')` | Manual DI or frameworks |
| **Python** | `from acme import Foo` | DI frameworks |
| **C#** | `using Acme` | `[Inject]` attributes |

## Additional Import Mechanisms

### `javaImports:` - Java Code Generation

Used when generating Java code from FOAM classes:

```javascript
foam.CLASS({
  package: 'com.example.services',
  name: 'DataProcessor',

  javaImports: [
    'foam.dao.AbstractSink',
    'java.util.ArrayList',
    'java.util.List'
  ]
  // Generates: import foam.dao.AbstractSink; etc.
});
```

### Traditional Node.js `require()`

For CommonJS modules in Node.js environments:

```javascript
// File: foam3/tools/build.js
const fs = require('fs');           // Node.js module
const path = require('path');       // Node.js module
```

## Advanced Features

### Optional Imports
Use `?` suffix for optional context values:

```javascript
imports: [
  'requiredService',        // Will error if not found
  'optionalService?'        // Won't error if missing
]
```

### Aliasing
Both `requires` and `imports` support aliasing:

```javascript
requires: [
  'foam.u2.DetailView as DetailView',
  'very.long.package.name.SomeClass as ShortName'
],
imports: [
  'userDAO as dao',
  'currentUser as user'
]
```

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

## Best Practices

### Use `requires` when:
- Creating instances of FOAM classes
- Building UI components that compose other views
- Working with model classes that you need to instantiate
- You need factory methods for object creation
- Dependencies are known at development time
- You want to avoid typing full package names

### Use `imports` when:
- Accessing application context or global state
- Injecting services like logging, authentication, DAOs
- Getting configuration values or runtime data
- You want loose coupling and testability
- Dependencies come from the execution environment
- You need services that might be remote

### Use `exports` when:
- Creating services that child components need
- Building reusable components that provide context
- Implementing service layers
- Creating testable architectures with dependency injection

### General Guidelines:

1. **Prefer `imports`** for services and runtime data - it creates more flexible, testable code
2. **Use `requires`** for class instantiation and when you need to create multiple instances
3. **Mark optional dependencies** with `?` in imports
4. **Use aliasing** to avoid naming conflicts
5. **Keep dependencies minimal** - only import what you need
6. **Design for testability** - prefer injection over direct lookups
7. **Think about the context chain** - exports flow down to imports

## Common Patterns

### Service Layer Pattern
```javascript
foam.CLASS({
  name: 'UserService',
  
  imports: [
    'userDAO',      // DAO injected from context
    'log'          // Logging service
  ],
  
  exports: [
    'this as userService'  // Export self for other components
  ],
  
  methods: [
    function getCurrentUser() {
      return this.userDAO.find(this.currentUserId);
    }
  ]
});
```

### Controller Pattern
```javascript
foam.CLASS({
  name: 'UserController',
  
  imports: [
    'userService',   // Service injected (loose coupling)
    'notify'        // Notification service
  ],
  
  requires: [
    'foam.u2.DetailView',  // View class for creating forms
    'foam.core.auth.User'    // Model class for data validation
  ],
  
  methods: [
    function createUserForm() {
      // Use required class to create view
      return this.DetailView.create({
        data: this.User.create()  // Use required model
      });
    },
    
    function saveUser(user) {
      // Use injected service
      return this.userService.save(user).then(() => {
        this.notify.success('User saved!');
      });
    }
  ]
});
```

### View Pattern
```javascript
foam.CLASS({
  name: 'UserView',
  extends: 'foam.u2.View',
  
  imports: [
    'theme',         // Theming service
    'userService'    // Business logic service
  ],
  
  requires: [
    'foam.u2.Button',     // UI components
    'foam.u2.TextField'
  ],
  
  methods: [
    function render() {
      this.add(this.TextField.create({
        label: 'Username',
        data$: this.data.username$
      }));
      
      this.add(this.Button.create({
        label: 'Save',
        action: () => this.userService.save(this.data)
      }));
    }
  ]
});
```

## Summary

Understanding the difference between `requires` and `imports` is crucial for effective FOAM development:

- **`requires:`** = "I need these **classes** so I can create instances"
- **`imports:`** = "I need these **services/values** injected into me"
- **`exports:`** = "I'm making these **services/values** available to my children"

This design enables loose coupling, testability, and the ability to work across networks - core principles of the FOAM architecture.