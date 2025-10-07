## What are Refinements?

Refinements allow you to extend or modify existing classes after they've been defined by adding new axioms to them. [1](#1-0)  When a model specifies a `refines` property, it doesn't create a new class but instead adds axioms to the existing class being refined. [1](#1-0)

## How Refinements Work with Axioms

When `buildClass()` encounters a model with a `refines` property, it looks up the existing class and adds the new axioms to it rather than creating a new class: [1](#1-0)

The key difference is that refinements call `cls.installModel(this)` on an existing class, which triggers the axiom installation process on that class. [2](#1-1)

## Axiom Installation in Refinements

When axioms are installed on a refined class, the same two-phase installation process occurs: [3](#1-2)

1. Axioms are added to the class's `axiomMap_` [4](#1-3)
2. `installInClass()` and `installInProto()` are called [5](#1-4)

Importantly, when axioms are installed on a parent class through refinement, child classes are notified via pub/sub to clear their axiom caches, ensuring they see the new axioms: [6](#1-5)

## Common Refinement Patterns

### Adding Properties to Existing Classes

Refinements commonly add new properties to existing classes. For example, the U2 framework refines `foam.lang.Model` to add UI-specific properties: [7](#1-6)

The `css` property uses a `postSet` to dynamically create and add a CSS axiom to the model's axiom array. [8](#1-7)

### Java Code Generation Refinements

The Java code generation system extensively uses refinements to add Java-specific properties and methods to core FOAM classes: [9](#1-8)

These refinements add properties like `javaCode`, `javaType`, and methods like `buildJavaClass()` that control Java code generation. [10](#1-9)

### View Refinements

Property types are refined to specify default views for UI rendering: [11](#1-10)

## Refinement Validation

In debug mode, refinements are validated to ensure they don't conflict with inheritance: [12](#1-11)

## What are Refinements?

FOAM models are modeled as FOAM models. This makes FOAM powerful, consistent and relatively compact, but creates an apparent circular dependency. This problem is solved through refinements by starting off with a simple Model definition and then refining it as new Model features are themselves refined into the FOAM Model. This use of Axioms to Bootstrap the FOAM modelling system is the primary difference between FOAM1 and later versions of FOAM (FOAM2 and FOAM3).

## Notes

Refinements are a powerful mechanism for extending FOAM classes without modifying their original definitions. They're particularly useful for adding platform-specific functionality (like Java or Swift code generation) or framework-specific features (like UI views) to core classes.<cite /> The axiom installation process handles refinements transparently, treating refined axioms the same as original axioms once installed.<cite /> Multiple refinements can target the same class, and they're processed in the order they're loaded.<cite />

Wiki pages you might want to explore:
- [FOAM Framework Overview (kgrgreer/foam3)](/wiki/kgrgreer/foam3#1)

### Citations

**File:** src/foam/lang/Boot.js (L127-133)
```javascript
      if ( this.refines ) {
        if ( ! foam.checkFlags(this.flags ) ) {
          return context.lookup(this.refines);
        }

        cls = context.lookup(this.refines);
        foam.assert(cls, 'Unknown refinement class: ' + this.refines + ' in: ' + this.id);
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

**File:** src/foam/lang/Boot.js (L174-174)
```javascript
      cls.installModel(this);
```

**File:** src/foam/lang/FObject.js (L122-180)
```javascript
    function installAxioms(axs) {
      if ( ! axs || ! axs.length ) return;

      /**
       * Install Axioms into the class and prototype.
       * Invalidate the axiom-cache, used by getAxiomsByName().
       *
       * FUTURE: Wait for first object to be created before creating prototype.
       * Currently it installs axioms into the protoype immediately, but in should
       * wait until the first object is created. This will provide
       * better startup performance.
       */
      this.private_.axiomCache = {};

      // Sort axioms by priority, higher priority gets installed first.
      // Default to 100.
      axs = axs.sort(function(a, b) {
        return foam.Number.compare(b.priority || 100, a.priority || 100);
      });

      // We install in two passes to avoid ordering issues from Axioms which
      // need to access other axioms, like ids: and exports:.

      var existing = new Array(axs.length);

      for ( var i = 0 ; i < axs.length ; i++ ) {
      // Convert JSON axioms to real instances as late as possible
        if ( foam.String.isInstance(axs[i].class) ) {
          var axsCls = foam.maybeLookup(axs[i].class);
          if ( axsCls ) axs[i] = axsCls.create(axs[i]);
        }

        var a = axs[i];

        // Store the destination class in the Axiom. Used by describe().
        // Store source class on a clone of 'a' so that the Axiom can be
        // reused without corrupting the sourceCls_.
        a.sourceCls_ = this;

        if ( Object.prototype.hasOwnProperty.call(this.axiomMap_, a.name) ) {
          existing[i] = this.axiomMap_[a.name];
        }

        this.axiomMap_[a.name] = a;
      }

      for ( var i = 0 ; i < axs.length ; i++ ) {
        var a = axs[i];

        var superAxiom = this.getSuperAxiomByName(a.name);

        a.installInClass && a.installInClass(this,           superAxiom, existing[i]);
        a.installInProto && a.installInProto(this.prototype, superAxiom, existing[i]);

        if ( a.name ) {
          this.pubsub_ && this.pubsub_.pub('installAxiom', a.name, a);
        }
      }
    },
```

**File:** src/foam/u2/Element.js (L2847-2880)
```javascript
foam.CLASS({
  package: 'foam.u2',
  name: 'ModelU2Refinements',
  refines: 'foam.lang.Model',

  properties: [
    {
      class: 'String',
      name: 'css',
      postSet: function(_, code) {
        var css = foam.u2.CSS.create({code: code});
        css.name = css.name + '-' + this.id;
        this.axioms_.push(css);
      }
    },
    {
      class: 'Boolean',
      name: 'inheritCSS',
      value: true
    },
    {
      name: 'tableColumns',
      postSet: function(_, cs) {
        this.axioms_.push(foam.u2.TableColumns.create({columns: cs}));
      }
    },
    {
      name: 'searchColumns',
      postSet: function(_, cs) {
        this.axioms_.push(foam.u2.SearchColumns.create({columns: cs}));
      }
    }
  ]
});
```

**File:** src/foam/java/refinements.js (L1047-1059)
```javascript
foam.CLASS({
  package: 'foam.java',
  name: 'MethodJavaRefinement',
  refines: 'foam.lang.Method',
  // flags: ['java'],
  properties: [
    {
      class: 'Boolean',
      name: 'abstract',
      value: false
    }
  ]
});
```

**File:** src/foam/java/refinements.js (L1062-1100)
```javascript
foam.CLASS({
  package: 'foam.java',
  name: 'ProxiedMethodJavaRefinement',
  refines: 'foam.lang.ProxiedMethod',
  // flags: ['java'],

  properties: [
    {
      name: 'javaCode',
      getter: function() {
        // TODO: This could be an expression if the copyFrom in createChildMethod
        // didn't finalize its value
        var code = '';

        if ( this.javaType && this.javaType !== 'void' ) {
          code += 'return ';
        }

        var isContextOriented = this.args.length && this.args[0].name === 'x' && this.args[0].type === 'Context';

        code += 'get' + foam.String.capitalize(this.property);
        if ( isContextOriented ) {
          code += '(x)';
        } else {
          code += '()';
        }
        code += '.' + this.name + '(';

        for ( var i = 0 ; this.args && i < this.args.length ; i++ ) {
          code += this.args[i].name;
          if ( i != this.args.length - 1 ) code += ', ';
        }
        code += ');';

        return code;
      }
    }
  ]
});
```

**File:** src/foam/u2/Element2.js (L2032-2067)
```javascript
foam.CLASS({
  package: 'foam.u2',
  name: 'MapViewRefinement',
  refines: 'foam.lang.Map',

  properties: [
    {
      name: 'view',
      value: { class: 'foam.u2.view.MapView' },
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ClassViewRefinement',
  refines: 'foam.lang.Class',

  properties: [
    [ 'view', { class: 'foam.u2.ClassView' } ]
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'ReferenceViewRefinement',
  refines: 'foam.lang.Reference',

  requires: [ 'foam.u2.view.ReferencePropertyView' ],

  properties: [
    [ 'view', { class: 'foam.u2.view.ReferencePropertyView' } ]
  ]
});
```

**File:** src/foam/lang/debug.js (L47-52)
```javascript
    function validate() {
      if ( this.refines ) {
        if ( this.hasOwnProperty('extends') ) {
          throw this.id + ': "extends" and "refines" are mutually exclusive.';
        }
      }
```
