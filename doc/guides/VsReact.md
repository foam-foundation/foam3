## Overview

You're asking about FOAM (Feature Oriented Active Modeller), a modeling framework and class-based object system that can generate code for multiple platforms [1](#0-0) , versus React, a popular JavaScript UI library. While both can build web applications, they represent fundamentally different architectural approaches.

## Core Philosophy

**FOAM** is a **model-driven framework** where you define classes with properties, methods, actions, and axioms, and FOAM generates the necessary code and features [2](#0-1) . It's designed for cross-language code generation, supporting JavaScript, Java, and Swift [3](#0-2) .

**React** is a **component-based UI library** focused on building user interfaces through composable components with a virtual DOM reconciliation system. It's JavaScript-specific and primarily concerned with view rendering.

## Architecture Patterns

### FOAM's Approach

FOAM uses a comprehensive class system with declarative models [4](#0-3) :

```javascript
foam.CLASS({
  package: 'com.google.project',
  name: 'MyModel',
  extends: 'com.google.project.MyBaseModel',
  properties: [...],
  methods: [...],
  actions: [...]
});
```

Key architectural features:
- **Context-based dependency injection** through `imports`/`exports` [5](#0-4)
- **Class dependencies** via `requires` [6](#0-5)
- **Reactive properties** with automatic change propagation
- **Built-in data layer** with DAOs (Data Access Objects)

### React's Approach

React uses functional or class components with JSX:

```javascript
function MyComponent({ data }) {
  const [state, setState] = useState();
  return <div>{data}</div>;
}
```

Key features:
- **Component composition** with props
- **Hooks** for state and side effects
- **Virtual DOM** for efficient rendering
- **One-way data flow**

## Dependency Management

**FOAM** has a sophisticated two-tier system:
- `requires:` for class dependencies (like imports in other languages) [6](#0-5)
- `imports:` for runtime dependency injection of services [7](#0-6)

**React** uses standard JavaScript imports and Context API or external libraries (Redux, MobX) for dependency injection.

## UI Component System

**FOAM's U2 system** (seen in `foam.u2.View`) [8](#0-7)  provides:
- Declarative view construction with method chaining
- Built-in form generation from models
- Section-based detail views [9](#0-8)
- Automatic property-to-UI binding

**React** requires:
- Manual component creation
- External form libraries
- Custom state management solutions

## Data Management

**FOAM** includes comprehensive data management:
- Built-in DAO system for CRUD operations
- Query language and filtering
- Automatic persistence layer
- Network marshaling [2](#0-1)

**React** is view-only and requires external solutions (REST APIs, GraphQL, state management libraries).

## Code Generation vs Runtime

**FOAM** generates code at build time, creating optimized classes with features like:
- Database support
- Network serialization
- Validation
- Documentation

**React** is purely runtime, with no code generation (though TypeScript can add type checking).

## Learning Curve

**FOAM** has a steeper learning curve due to:
- Unique concepts (axioms, contexts, DAOs)
- Model-driven paradigm
- Cross-language abstractions

**React** is more approachable:
- Familiar JavaScript patterns
- Smaller API surface
- Extensive community resources

## Use Cases

**FOAM** excels at:
- Enterprise applications with complex data models
- Cross-platform code generation
- Applications requiring built-in persistence
- Systems needing comprehensive metadata

**React** excels at:
- UI-focused applications
- Rapid prototyping
- Integration with existing JavaScript ecosystems
- Applications with simple data requirements

## Notes

FOAM is a full-stack framework with its own paradigms for modeling, data access, and UI construction, while React is specifically a UI library that requires additional tools for a complete application. FOAM's model-driven approach provides more built-in functionality but requires learning FOAM-specific concepts, whereas React's component model is more familiar to JavaScript developers but requires assembling multiple libraries for full application functionality<cite />.

Wiki pages you might want to explore:
- [Detail Views and Form System (kgrgreer/foam3)](/wiki/kgrgreer/foam3#4.4)
- [Advanced Features and Extensions (kgrgreer/foam3)](/wiki/kgrgreer/foam3#7)

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

**File:** src/foam/lang/Context.js (L28-44)
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

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L451-474)
```markdown
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

**File:** src/foam/core/reflow/DynamicReflowData.js (L8-18)
```javascript
foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DynamicReflowData',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.UnderlinedTabs',
    'foam.u2.Tab',
    'foam.core.boot.CSpec',
    'foam.core.reflow.CommandItemView'
  ],
```

**File:** src/foam/u2/detail/VerticalDetailView.js (L7-38)
```javascript
foam.CLASS({
  package: 'foam.u2.detail',
  name: 'VerticalDetailView',
  extends: 'foam.u2.detail.AbstractSectionedDetailView',

  requires: [
    'foam.u2.detail.SectionView',
    'foam.u2.layout.Rows'
  ],

  css:`
    ^centered > * {
      align-self: center;
    }
  `,

  properties: [
    {
      name: 'config'
      // Map of property-name: {map of property overrides} for configuring properties
      // values include 'label', 'units', and 'view'
    },
    {
      class: 'Boolean',
      name: 'showTitle',
      value: true
    },
    {
      class: 'Boolean',
      name: 'centered',
    }
  ],
```
