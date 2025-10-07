## What are Axioms?

Axioms are the core mechanism by which FOAM models define class structure and functionality. [1](#0-0)  They are defined with a pseudo-interface that includes optional `installInClass(cls)` and `installInProto(proto)` methods. [2](#0-1)

The basic axiom interface is formally defined in `foam.lang.Axiom`: [3](#0-2)

## How Axioms Work

Axioms install themselves onto a Model's Class and/or Prototype during the class building process. [4](#0-3)  The installation happens in two phases to avoid ordering issues: [5](#0-4)

1. **Class Installation**: Axioms are first stored in the class's `axiomMap_` [6](#0-5)
2. **Installation Execution**: Then `installInClass()` and `installInProto()` are called to modify the class and prototype [7](#0-6)

Axioms are sorted by priority (default 100) before installation, with higher priority axioms installed first. [8](#0-7)

## Common Axiom Types

While raw axioms can be used directly, FOAM provides higher-level axiom types: [9](#0-8)

- **Properties** - Instance variable definitions
- **Methods** - Prototype methods
- **Listeners** - Methods with extra callback features
- **Actions** - User-invokable operations
- **Requires** - Class dependencies
- **Imports/Exports** - Context dependency injection [10](#0-9)
- **Implements** - Interface/mixin declarations [11](#0-10)
- **Constants** - Class and prototype constants
- **Topics** - Publish/subscribe topics

## Defining Axioms

You can add axioms to a class in several ways:

**Direct axiom array:** [12](#0-11)

**Specialized sections** like `properties`, `methods`, `listeners`, etc. are syntactic sugar that create the appropriate axiom types: [13](#0-12)

## Axiom Access and Introspection

Classes provide methods to access their axioms:

- `getAxiomByName(name)` - Get a specific axiom
- `getAxioms()` - Get all axioms including inherited ones [14](#0-13)
- `getOwnAxioms()` - Get only axioms defined on this class [15](#0-14)
- `getAxiomsByClass(cls)` - Filter axioms by type
- `hasOwnAxiom(name)` - Check if axiom is defined locally [16](#0-15)

The framework also provides debugging support through `describe()` which lists all axioms with their types and source classes. [17](#0-16)

## Notes

Axioms are stored in `axiomMap_` on each class, with inheritance handled through prototype chaining of the axiom maps. [6](#0-5)  When axioms are installed on parent classes, child classes are notified via pub/sub to clear their axiom caches. [18](#0-17)  The `Relationship` axiom is a specialized example that defines relationships between models. [19](#0-18)

Wiki pages you might want to explore:
- [Advanced Features and Extensions (kgrgreer/foam3)](/wiki/kgrgreer/foam3#7)

### Citations

**File:** src/foam/lang/Boot.js (L54-56)
```javascript
  Models are defined as a collection of Axioms.
  It is the responsibility of Axioms to install itself onto a Model's Class and/or Prototype.

```

**File:** src/foam/lang/Boot.js (L58-64)
```javascript
  Axioms are defined with the following psedo-interface:
<pre>
    public interface Axiom {
      optional installInClass(cls)
      optional installInProto(proto)
    }
</pre>
```

**File:** src/foam/lang/Boot.js (L85-97)
```javascript
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

**File:** src/foam/lang/Boot.js (L159-170)
```javascript
          // Relay 'installAxiom' events from parent class.
          parent.pubsub_ && parent.pubsub_.sub(
            'installAxiom',
            function(_, a1, a2, a3) {
              // When an axiom is installed on the parent, the child's axiom
              // cache needs to be cleared. Otherwise it will be stale if
              // previously accessed.
              // https://github.com/foam-framework/foam2/issues/1764
              cls.private_.axiomCache = {};

              cls.pubsub_.pub(a1, a2, a3);
            });
```

**File:** src/foam/lang/Axiom.js (L7-19)
```javascript
foam.INTERFACE({
  package: 'foam.lang',
  name: 'Axiom',

  documentation: 'Represents an axiom',

  methods: [
    {
      name: 'getName',
      type: 'String',
    }
  ]
});
```

**File:** src/foam/lang/FObject.js (L136-140)
```javascript
      // Sort axioms by priority, higher priority gets installed first.
      // Default to 100.
      axs = axs.sort(function(a, b) {
        return foam.Number.compare(b.priority || 100, a.priority || 100);
      });
```

**File:** src/foam/lang/FObject.js (L142-143)
```javascript
      // We install in two passes to avoid ordering issues from Axioms which
      // need to access other axioms, like ids: and exports:.
```

**File:** src/foam/lang/FObject.js (L165-165)
```javascript
        this.axiomMap_[a.name] = a;
```

**File:** src/foam/lang/FObject.js (L173-174)
```javascript
        a.installInClass && a.installInClass(this,           superAxiom, existing[i]);
        a.installInProto && a.installInProto(this.prototype, superAxiom, existing[i]);
```

**File:** src/foam/lang/FObject.js (L269-275)
```javascript
    function hasOwnAxiom(name) {
      /**
       * Return true if an axiom named "name" is defined on this class
       * directly, regardless of what parent classes define.
       */
      return Object.hasOwnProperty.call(this.axiomMap_, name);
    },
```

**File:** src/foam/lang/FObject.js (L287-292)
```javascript
    function getOwnAxioms() {
      /** Returns all axioms defined on this class. */
      return this.getAxioms().filter(function(a) {
        return this.hasOwnAxiom(a.name);
      }.bind(this));
    },
```

**File:** src/foam/lang/FObject.js (L294-305)
```javascript
    function getAxioms() {
      /** Returns all axioms defined on this class or its parent classes. */

      // The full axiom list is stored in the regular cache with '' as a key.
      var as = this.private_.axiomCache[''];
      if ( ! as ) {
        as = [];
        for ( var key in this.axiomMap_ ) as.push(this.axiomMap_[key]);
        this.private_.axiomCache[''] = as;
      }
      return as;
    },
```

**File:** src/foam/lang/ImportsExports.js (L8-17)
```javascript
  Imports and Exports provide implicit Context dependency management.

  A class can list which values it requires from the Context, and then
  these values will be added to the object itself so that it doesn't need
  to explicitly work with the Context.

  A class can list which values (properties, methods, or method-like axioms)
  that it exports, and these will automatically be added to the object's
  sub-Context. The object's sub-Context is the context that is used when
  new objects are created by the object.
```

**File:** src/foam/lang/Implements.js (L22-27)
```javascript
  documentation: `
    Axiom for declaring intent to implement an interface.

    Since interfaces can also have implementations, it
    can also be used to provide mix-ins, which is a safe form of
    multiple-inheritance.
```

**File:** doc/templates/Model.js (L91-96)
```javascript
   // Add extra Axioms
   axioms: [
     // Common "Extra" Axioms
     { class: 'foam.pattern.Singleton' },
     { class: 'foam.pattern.Multiton', property: 'of' }
   ],
```

**File:** doc/guides/cheat-sheet.md (L60-76)
```markdown
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
```

**File:** src/foam/lang/debug.js (L159-173)
```javascript
  foam.lang.FObject.describe = function(opt_name) {
    console.log('CLASS:  ', this.name);
    console.log('extends:', this.model_.extends);
    console.log('Axiom Type             Source Class   Name                                          Source Path');
    console.log('----------------------------------------------------------------------------------------------------------------------------');
    for ( var key in this.axiomMap_ ) {
      var a = this.axiomMap_[key];
      console.log(
        foam.String.pad(a.cls_ ? a.cls_.name : 'anonymous', 22),
        foam.String.pad((a.sourceCls_ && a.sourceCls_.name) || 'unknown', 14),
        foam.String.pad(a.name, 45),
        a.source || '');
    }
    console.log('\n');
  };
```

**File:** src/foam/dao/Relationship.js (L15-15)
```javascript
  documentation: 'An Axiom for defining Relationships between models.',
```
