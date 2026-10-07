<flow name="be:models" category="DOC/EXAMPLES" spid="foam" description="Live examples of FOAM models built with foam.CLASS(): properties, methods, actions, listeners and other model features." keywords="models,foam.class,properties,methods,actions,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM Models By Example

<term term="Models"></term> are the foundation of FOAM. A model defines a class with properties, methods, actions, and other features. Models are declarative — you describe what you want, and FOAM generates the implementation.

<toc></toc>

## Overview

FOAM models are created with `foam.CLASS()`. Every model can include:

| Feature | Description |
|---------|-------------|
| `name` | Class name (required) |
| `package` | Namespace for the class |
| `extends` | Parent class |
| `implements` | Interfaces |
| `properties` | Data fields with getters/setters |
| `methods` | Functions |
| `actions` | User-triggerable methods with state |
| `constants` | Immutable values |
| `axioms` | Low-level model extensions |

### Model Lifecycle

1. `foam.CLASS()` defines the model
2. FOAM generates the class with all features
3. `ClassName.create()` instantiates objects
4. `init()` runs on creation

---

## Basic Class Definition

The simplest class has just a name. Use `create()` to instantiate.

<example id="basic-class">
foam.CLASS({
  name: 'Point'
});

// Create an instance
var p = Point.create();
log('Created:', p.cls_.name);

// All FOAM objects have cls_ pointing to their class
log('Class ID:', p.cls_.id);
</example>

---

## Properties

<term term="Properties"></term> are the primary way to define data on a model. FOAM generates getters, setters, change notifications, and default values.

### Property Options

| Option | Description |
|--------|-------------|
| `name` | Property name (required) |
| `class` | Property type (String, Int, etc.) |
| `value` | Default value |
| `factory` | Function returning default |
| `expression` | Computed value |
| `required` | Validation flag |
| `hidden` | Hide from views |
| `transient` | Exclude from serialization |

<example id="properties">
foam.CLASS({
  name: 'Person',
  properties: [
    // Shorthand - just the name
    'name',

    // With type
    { class: 'Int', name: 'age' },

    // With default value
    { name: 'country', value: 'Canada' },

    // With factory (called once per instance)
    {
      name: 'id',
      factory: function() {
        return Math.random().toString(36).substr(2, 9);
      }
    },

    // Computed expression (updates when dependencies change)
    {
      name: 'isAdult',
      expression: function(age) {
        return age >= 18;
      }
    }
  ]
});

var person = Person.create({ name: 'Alice', age: 25 });
log('Name:', person.name);
log('Age:', person.age);
log('Country:', person.country);
log('ID:', person.id);
log('Is Adult:', person.isAdult);
</example>

### Property Slots

Every property has an associated <term term="Slot"></term> accessed via `property$`. Slots enable reactive data binding.

<example id="property-slots">
foam.CLASS({
  name: 'Counter',
  properties: [
    { class: 'Int', name: 'count', value: 0 }
  ]
});

var counter = Counter.create();

// Subscribe to changes
counter.count$.sub(function(_, __, ___, slot) {
  log('Count changed to:', slot.get());
});

// Changes trigger the subscription
counter.count = 1;
counter.count = 2;
counter.count = 3;
</example>

---

## Methods

<term term="Methods"></term> define behavior. They can be defined in shorthand or long form.

<example id="methods">
foam.CLASS({
  name: 'Calculator',
  properties: [
    { class: 'Float', name: 'value', value: 0 }
  ],
  methods: [
    // Shorthand form
    function add(n) {
      this.value += n;
      return this;
    },

    // Long form with documentation
    {
      name: 'multiply',
      documentation: 'Multiplies the current value by n',
      args: [
        { name: 'n', type: 'Float' }
      ],
      type: 'Calculator',  // Return type
      code: function(n) {
        this.value *= n;
        return this;
      }
    },

    function reset() {
      this.value = 0;
      return this;
    }
  ]
});

var calc = Calculator.create();
calc.add(5).multiply(3).add(2);
log('Result:', calc.value);  // 17
</example>

---

## Actions

<term term="Actions"></term> are methods that can be triggered by users. They have built-in support for enabling/disabling, labeling, and keyboard shortcuts.

### Action Options

| Option | Description |
|--------|-------------|
| `name` | Action identifier |
| `label` | Display label |
| `icon` | Icon identifier |
| `isEnabled` | Function returning enable state |
| `isAvailable` | Function returning visibility |
| `code` | Action implementation |
| `keyboardShortcuts` | Keyboard triggers |

<example id="actions">
foam.CLASS({
  name: 'TodoItem',
  properties: [
    { class: 'String', name: 'title' },
    { class: 'Boolean', name: 'completed', value: false }
  ],
  actions: [
    {
      name: 'complete',
      label: 'Mark Complete',
      isEnabled: function(completed) {
        return !completed;  // Disabled when already complete
      },
      code: function() {
        this.completed = true;
        log('Completed:', this.title);
      }
    },
    {
      name: 'reopen',
      label: 'Reopen',
      isAvailable: function(completed) {
        return completed;  // Only show when completed
      },
      code: function() {
        this.completed = false;
        log('Reopened:', this.title);
      }
    }
  ]
});

var todo = TodoItem.create({ title: 'Learn FOAM' });
log('Can complete:', todo.COMPLETE.isEnabled.call(todo));
todo.complete();
log('Can complete:', todo.COMPLETE.isEnabled.call(todo));
</example>

---

## Constants

<term term="Constants"></term> define immutable values on the class. They're accessed via the class or instances.

<example id="constants">
foam.CLASS({
  name: 'HttpStatus',
  constants: [
    { name: 'OK', value: 200 },
    { name: 'NOT_FOUND', value: 404 },
    { name: 'SERVER_ERROR', value: 500 },
    {
      name: 'STATUS_MESSAGES',
      value: {
        200: 'OK',
        404: 'Not Found',
        500: 'Internal Server Error'
      }
    }
  ],
  methods: [
    function getMessage(code) {
      return this.STATUS_MESSAGES[code] || 'Unknown';
    }
  ]
});

log('OK:', HttpStatus.OK);
log('Not Found:', HttpStatus.NOT_FOUND);

var status = HttpStatus.create();
log('Message:', status.getMessage(404));
</example>

---

## Inheritance

Use <term term="extends"></term> for single inheritance. Child classes inherit all features and can override them.

<example id="inheritance">
foam.CLASS({
  name: 'Animal',
  properties: [
    { name: 'name' },
    { class: 'Int', name: 'age' }
  ],
  methods: [
    function speak() {
      return 'Some sound';
    },
    function describe() {
      return this.name + ' is ' + this.age + ' years old';
    }
  ]
});

foam.CLASS({
  name: 'Dog',
  extends: 'Animal',
  properties: [
    { name: 'breed' }
  ],
  methods: [
    function speak() {
      return 'Woof!';
    },
    function describe() {
      // Call parent method with SUPER()
      return this.SUPER() + ' and is a ' + this.breed;
    }
  ]
});

foam.CLASS({
  name: 'Cat',
  extends: 'Animal',
  methods: [
    function speak() {
      return 'Meow!';
    }
  ]
});

var dog = Dog.create({ name: 'Rex', age: 5, breed: 'German Shepherd' });
var cat = Cat.create({ name: 'Whiskers', age: 3 });

log(dog.speak());
log(cat.speak());
log(dog.describe());
</example>

---

## Interfaces

<term term="Interfaces"></term> define contracts that classes must fulfill. Use `implements` to declare interface compliance.

<example id="interfaces">
foam.INTERFACE({
  name: 'Drawable',
  methods: [
    { name: 'draw', type: 'Void' }
  ]
});

foam.INTERFACE({
  name: 'Resizable',
  methods: [
    { name: 'resize', args: [{ name: 'factor', type: 'Float' }] }
  ]
});

foam.CLASS({
  name: 'Circle',
  implements: ['Drawable', 'Resizable'],
  properties: [
    { class: 'Float', name: 'radius', value: 1 }
  ],
  methods: [
    function draw() {
      log('Drawing circle with radius:', this.radius);
    },
    function resize(factor) {
      this.radius *= factor;
    }
  ]
});

var circle = Circle.create({ radius: 5 });
circle.draw();
circle.resize(2);
circle.draw();

// Check interface compliance
log('Is Drawable:', Drawable.isInstance(circle));
log('Is Resizable:', Resizable.isInstance(circle));
</example>

---

## Mixins

<term term="Mixins"></term> provide reusable functionality that can be added to multiple classes. Unlike inheritance, a class can use multiple mixins.

<example id="mixins">
foam.CLASS({
  name: 'Timestamped',

  properties: [
    {
      class: 'DateTime',
      name: 'created',
      factory: function() { return new Date(); }
    },
    {
      class: 'DateTime',
      name: 'modified'
    }
  ],

  methods: [
    function touch() {
      this.modified = new Date();
    }
  ]
});

foam.CLASS({
  name: 'Taggable',

  properties: [
    {
      class: 'StringArray',
      name: 'tags',
      factory: function() { return []; }
    }
  ],

  methods: [
    function addTag(tag) {
      if (!this.tags.includes(tag)) {
        this.tags = [...this.tags, tag];
      }
    },
    function hasTag(tag) {
      return this.tags.includes(tag);
    }
  ]
});

foam.CLASS({
  name: 'BlogPost',
  mixins: ['Timestamped', 'Taggable'],

  properties: [
    { name: 'title' },
    { name: 'content' }
  ]
});

var post = BlogPost.create({ title: 'Hello World', content: '...' });
log('Created:', post.created);

post.addTag('foam');
post.addTag('tutorial');
log('Tags:', post.tags);
log('Has foam tag:', post.hasTag('foam'));

post.touch();
log('Modified:', post.modified);
</example>

---

## Refinements

<term term="Refinements"></term> modify existing classes without subclassing. Useful for extending third-party classes or adding features to built-in types.

<example id="refinements">
// Original class
foam.CLASS({
  name: 'Product',
  properties: [
    { name: 'name' },
    { class: 'Float', name: 'price' }
  ]
});

// Refinement adds features
foam.CLASS({
  refines: 'Product',

  properties: [
    { class: 'Int', name: 'quantity', value: 0 },
    {
      name: 'totalValue',
      expression: function(price, quantity) {
        return price * quantity;
      }
    }
  ],

  methods: [
    function formatPrice() {
      return '$' + this.price.toFixed(2);
    }
  ]
});

// Original class now has the new features
var product = Product.create({ name: 'Widget', price: 19.99, quantity: 5 });
log('Name:', product.name);
log('Price:', product.formatPrice());
log('Total:', product.totalValue);
</example>

---

## Inner Classes

<term term="Inner Classes"></term> are classes defined within another class. They have access to the outer class via `this.outer`.

<example id="inner-classes">
foam.CLASS({
  name: 'Outer',

  classes: [
    {
      name: 'Inner',
      properties: [
        { name: 'value' }
      ],
      methods: [
        function getOuterName() {
          // Access outer class
          return this.outer ? this.outer.name : 'No outer';
        }
      ]
    }
  ],

  properties: [
    { name: 'name', value: 'OuterInstance' }
  ],

  methods: [
    function createInner(value) {
      // Inner class is namespaced under Outer
      return this.Inner.create({ value: value });
    }
  ]
});

var outer = Outer.create();
var inner = outer.createInner('test');
log('Inner value:', inner.value);
log('Outer name:', inner.getOuterName());

// Can also create from class directly (no outer reference)
var standalone = Outer.Inner.create({ value: 'standalone' });
log('Standalone outer:', standalone.getOuterName());
</example>

---

## Requires and Imports/Exports

### Requires

<term term="requires"></term> declares class dependencies with optional aliases.

<example id="requires">
foam.CLASS({
  name: 'App',
  requires: [
    'foam.util.Timer',
    'foam.dao.EasyDAO as DAO'  // Alias
  ],

  properties: [
    {
      name: 'timer',
      factory: function() {
        return this.Timer.create();  // Use short name
      }
    },
    {
      name: 'userDAO',
      factory: function() {
        return this.DAO.create({ of: 'User', daoType: 'MDAO' });
      }
    }
  ]
});

var app = App.create();
log('Timer:', app.timer.cls_.name);
</example>

### Imports and Exports

<term term="imports"></term> and <term term="exports"></term> enable dependency injection through the context.

<example id="imports-exports">
foam.CLASS({
  name: 'ServiceProvider',
  exports: [
    'logger',
    'config'
  ],

  properties: [
    {
      name: 'logger',
      factory: function() {
        return {
          log: function(msg) { console.log('[LOG]', msg); },
          error: function(msg) { console.error('[ERROR]', msg); }
        };
      }
    },
    {
      name: 'config',
      factory: function() {
        return { apiUrl: 'https://api.example.com', debug: true };
      }
    }
  ]
});

foam.CLASS({
  name: 'ServiceConsumer',
  imports: [
    'logger',
    'config'
  ],

  methods: [
    function doWork() {
      this.logger.log('Working with API: ' + this.config.apiUrl);
    }
  ]
});

// Create provider and consumer in same context
var provider = ServiceProvider.create();
var consumer = provider.__subContext__.createSubContext().lookup('ServiceConsumer').create();
consumer.doWork();
</example>

---

## Listeners

<term term="Listeners"></term> are methods that automatically bind `this` and can be merged/delayed.

<example id="listeners">
foam.CLASS({
  name: 'SearchBox',

  properties: [
    { class: 'String', name: 'query' },
    { class: 'Int', name: 'searchCount', value: 0 }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Subscribe listener to property changes
      this.query$.sub(this.onQueryChange);
    }
  ],

  listeners: [
    {
      name: 'onQueryChange',
      // Merge calls within 300ms (debounce)
      isMerged: true,
      mergeDelay: 300,
      code: function() {
        this.searchCount++;
        log('Searching for:', this.query, '(search #' + this.searchCount + ')');
      }
    }
  ]
});

var search = SearchBox.create();

// Rapid changes are merged
search.query = 'f';
search.query = 'fo';
search.query = 'foo';

// After 300ms, only one search fires
setTimeout(function() {
  log('Final search count:', search.searchCount);
}, 500);
</example>

---

## Topics

<term term="Topics"></term> define custom events that objects can publish and subscribe to.

<example id="topics">
foam.CLASS({
  name: 'EventEmitter',

  topics: [
    'onData',
    'onError',
    'onComplete'
  ],

  methods: [
    function emitData(data) {
      this.onData.pub(data);
    },
    function emitError(error) {
      this.onError.pub(error);
    },
    function complete() {
      this.onComplete.pub();
    }
  ]
});

var emitter = EventEmitter.create();

// Subscribe to topics
emitter.onData.sub(function(_, __, data) {
  log('Received data:', data);
});

emitter.onError.sub(function(_, __, error) {
  log('Error:', error);
});

emitter.onComplete.sub(function() {
  log('Complete!');
});

// Emit events
emitter.emitData({ id: 1, value: 'test' });
emitter.emitData({ id: 2, value: 'more' });
emitter.emitError('Something went wrong');
emitter.complete();
</example>

---

## Model Introspection

FOAM classes are fully introspectable at runtime.

<example id="introspection">
foam.CLASS({
  name: 'Sample',
  properties: [
    { class: 'String', name: 'name' },
    { class: 'Int', name: 'count' },
    { class: 'Boolean', name: 'active' }
  ],
  methods: [
    function doSomething() {}
  ],
  actions: [
    { name: 'save', code: function() {} }
  ]
});

var cls = Sample;

log('Class name:', cls.name);
log('Class ID:', cls.id);

log('\nProperties:');
cls.getAxiomsByClass(foam.core.Property).forEach(function(prop) {
  log(' -', prop.name, '(' + prop.cls_.name + ')');
});

log('\nMethods:');
cls.getAxiomsByClass(foam.core.Method).forEach(function(method) {
  log(' -', method.name);
});

log('\nActions:');
cls.getAxiomsByClass(foam.core.Action).forEach(function(action) {
  log(' -', action.name);
});

// Get specific axiom
var nameProp = cls.getAxiomByName('name');
log('\nName property class:', nameProp.cls_.name);
</example>

---

## Summary

### Model Features Quick Reference

| Feature | Syntax | Purpose |
|---------|--------|---------|
| `properties` | `[{ name, class, value }]` | Data fields |
| `methods` | `[function name() {}]` | Behavior |
| `actions` | `[{ name, code, isEnabled }]` | User operations |
| `constants` | `[{ name, value }]` | Immutable values |
| `extends` | `'ParentClass'` | Single inheritance |
| `implements` | `['Interface']` | Interface compliance |
| `mixins` | `['Mixin']` | Multiple inheritance |
| `refines` | `'ExistingClass'` | Modify existing class |
| `classes` | `[{ name }]` | Inner classes |
| `requires` | `['Class as Alias']` | Dependencies |
| `imports` | `['contextKey']` | Dependency injection |
| `exports` | `['property']` | Provide to children |
| `listeners` | `[{ name, isMerged }]` | Auto-bound handlers |
| `topics` | `['eventName']` | Custom events |

### Best Practices

1. **Use property types** — `class: 'Int'` over plain properties
2. **Prefer factories over values** — For mutable defaults
3. **Use expressions** — For computed properties
4. **Keep actions stateful** — Use isEnabled/isAvailable
5. **Leverage mixins** — For cross-cutting concerns
6. **Use imports/exports** — For dependency injection
7. **Document methods** — Use long-form with documentation

---

## See Also

- [FOAM Properties By Example](properties.md) — Property types and options
- [FOAM Views By Example](be:views) — Property views
- [FOAM DAO By Example](be:dao) — Data persistence

<glossary>
  <def term="Models" definition="FOAM class definitions created with foam.CLASS(). The foundation of FOAM's object system."></def>
  <def term="Properties" definition="Data fields on a model with automatic getters, setters, and change notifications."></def>
  <def term="Slot" definition="Reactive value container associated with each property. Accessed via propertyName$."></def>
  <def term="Methods" definition="Functions defined on a model. Can use shorthand or long form with documentation."></def>
  <def term="Actions" definition="User-triggerable methods with built-in enable/disable state and UI integration."></def>
  <def term="Constants" definition="Immutable values defined on a class, accessible from class or instances."></def>
  <def term="extends" definition="Single inheritance. Child class inherits all features from parent."></def>
  <def term="Interfaces" definition="Contracts defining required methods. Created with foam.INTERFACE()."></def>
  <def term="Mixins" definition="Reusable feature sets that can be added to multiple classes."></def>
  <def term="Refinements" definition="Modifications to existing classes without subclassing. Uses refines: property."></def>
  <def term="Inner Classes" definition="Classes defined within another class. Have access to outer instance."></def>
  <def term="requires" definition="Declares class dependencies with optional aliases for cleaner code."></def>
  <def term="imports" definition="Dependency injection declarations. Receives values from parent context."></def>
  <def term="exports" definition="Makes values available to child components through the context."></def>
  <def term="Listeners" definition="Auto-bound methods that can be merged or delayed. Useful for event handlers."></def>
  <def term="Topics" definition="Custom event channels for publish/subscribe patterns."></def>
  <def term="SUPER" definition="Function to call parent class implementation of overridden method."></def>
  <def term="cls_" definition="Property on every FOAM object pointing to its class."></def>
  <def term="factory" definition="Property option. Function called once per instance to generate default value."></def>
  <def term="expression" definition="Property option. Computed value that updates when dependencies change."></def>
</glossary>