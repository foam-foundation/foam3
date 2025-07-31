<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [FOAM3 Cheat Sheet (long form)](#foam3-cheat-sheet-long-form)
- [Models](#models)
  - [**Properties**](#properties)
    - [**Defaults**](#defaults)
    - [**Expression Behavior**](#expression-behavior)
    - [**Dynamic Get and/or Set**](#dynamic-get-andor-set)
    - [**Property Types (FOAM3 Current)**](#property-types-foam3-current)
      - [**Numeric Types:**](#numeric-types)
      - [**String Types:**](#string-types)
      - [**Date/Time Types:**](#datetime-types)
      - [**Object Types:**](#object-types)
      - [**Collection Types:**](#collection-types)
  - [**Methods**](#methods)
  - [**Listeners**](#listeners)
  - [**Actions**](#actions)
- [DAOs](#daos)
- [Reactivity](#reactivity)
  - [**Listen to Changes**](#listen-to-changes)
  - [**Display Properties**](#display-properties)
  - [**Computed Values**](#computed-values)
  - [**Dynamic Views**](#dynamic-views)
- [Context and Dependency Injection](#context-and-dependency-injection)
  - [**Context and Subcontext**](#context-and-subcontext)
  - [**Imports and Exports**](#imports-and-exports)
  - [**Context and Object Creation**](#context-and-object-creation)
  - [**Context Patterns**](#context-patterns)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# FOAM3 Cheat Sheet (long form)

# Models

Model/class definition:  
```javascript
foam.CLASS({  
  package: 'com.google.project',  
  name: 'MyModel',  
  extendsModel: 'com.google.project.MyBaseModel',  
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

## **Properties**

Properties are data members on instances.  
Name only; properties collection:  
```javascript
properties: [  
  'myPropertyName',  
  …  
],  
```
Property with class-based typing (FOAM3 current):  
```javascript
{  
  class: 'String',  
  name: 'str',  
  documentation: 'Multiline documentation for this property.',
  value: 'Hello world',
  trim: true,
  width: 50
}
```

FObject property with 'of' typing:  
```javascript
{  
  class: 'FObjectProperty',
  of: 'com.google.project.User',
  name: 'user',  
  factory: function() { return this.User.create(); }
}
```

Reference property (FOAM3 pattern):
```javascript
{
  class: 'Reference',
  of: 'com.google.project.User',
  name: 'userId',
  targetDAOKey: 'userDAO'
}
```

### **Defaults**

**value** - Static value parsed when model is built.  
**factory** - Function returns default value; runs once when instance is created if no other value was injected at creation time.  
**expression** - Dynamic function that recalculates when dependencies change (like factory but reactive).

Example factory vs expression:
```javascript
// Factory - runs once on first access
{ class: 'Array', name: 'items', factory: function() { return []; } }

// Expression - recalculates when 'firstName' or 'lastName' change  
{ class: 'String', name: 'fullName', expression: function(firstName, lastName) {
    return firstName + ' ' + lastName;
}}
```

### **Expression Behavior**

Expressions have special caching behavior for performance:
```javascript
{
  class: 'String',
  name: 'computedValue',
  expression: function(inputA, inputB) {
    return inputA + inputB;
  }
}

// Important: Once an expression is set to a value, it stops recalculating
obj.computedValue = 'manual value'; // Expression stops being reactive

// To re-enable reactive behavior, reset to undefined
obj.computedValue = undefined; // Expression becomes reactive again
```

### **Dynamic Get and/or Set**

**Caveat**: Custom getters and setters are very low-level.  
getter: function() { return this.op(this.leftOperand, this.rightOperand); }  
setter: function(value) { return typeof value \!== 'undefined' ? value : ''; }

### **Property Types (FOAM3 Current)**

#### **Numeric Types:**
- `Int` - Integer numbers with optional min/max, units
- `Long` - Long integer numbers  
- `Short` - Short integer numbers (-32768 to 32767)
- `Byte` - Byte numbers (-128 to 127)
- `Float` - Decimal numbers with precision
- `Double` - Double precision decimal numbers
- `UnitValue` - Long with unit denomination support

#### **String Types:**
- `String` - Text strings with optional trim, width
- `I18NString` - Internationalized strings 
- `FormattedString` - Delimiter separated strings with formatter
- `EMail` - Email addresses (auto-lowercase, trim)
- `Password` - Protected/hidden text display
- `Code` - Code/programming text
- `PhoneNumber` - Phone numbers with country codes
- `Color` - Color values with CSS token support
- `URL` - Web links and internet addresses
- `Website` - Websites requiring http(s)/www
- `InternalLink` - Internal app/service links
- `Image` - Image data or links

#### **Date/Time Types:**
- `Date` - Date values (normalized to noon GMT)
- `DateTime` - Date and time values
- `Time` - Time values (extends String)

#### **Object Types:**
- `Object` - Any object type
- `Class` - Class references with runtime lookup
- `FObjectProperty` - FOAM object properties with 'of' type
- `Reference` - References to other objects by ID
- `FUIDProperty` - FOAM Unique ID properties

#### **Collection Types:**
- `Array` - Arrays with factory, helper methods ($push, $remove, etc.)
- `List` - Lists (extends Object)
- `StringArray` - Arrays of strings with validation
- `IntegerArray` - Arrays of integers with adaptation
- `Map` - Key-value maps with $set/$remove helpers


**Custom Property Creation:**
Properties can be extended by creating new classes that extend the base Property class or specific property types (Int, String, etc.). All properties support common features like adapt, preSet, postSet, factory, expression, etc.

## **Methods**

Methods are member functions on instances.  
Name and implementation only; methods collection:  
```javascript
methods: {  
  addAndMultiply: function(x, y, z) { return (x \+ y) \* z; },  
  …  
}  
Additional information; methods collection:  
methods: [  
  {  
    name: 'addAndMultiply',  
    documentation: 'First add first two parameters, then multiply by the third.',  
    code: function(x, y, z) { return (x \+ y) \* z; },  
  },  
  …  
]
```

## **Listeners**

Listeners are member functions pre-bound to instances. Use them as callback functions that will be passed around in the system, but expect to run with the correct “this” value.  
Name and implementation only; methods collection:  
Listeners collection:  
```javascript
listeners: [  
  {  
    name: 'onClick',  
    documentation: 'Respond to DOM click events on this HTML view.',  
    code: function(event) { … },  
  },  
  …  
]
```

## **Actions**

Actions are user-initiated actions that can be performed on instances.  
Actions collection:  
```javascript
actions: [  
  {  
    name: 'play',  
    label: 'Play Video',  
    help: 'Play the video for this post',  
    iconUrl: 'http://www.example.com/play\_icon.png',  
    documentation: 'Play the video associated with this instance.',  
    code: function() { … },  
  },  
  …  
]  
```
**Caveat**: Action implementations are called the “action”, not the “code” (as in methods and listeners).

# DAOs

Data Access Objects (DAOs) are an interface for data storage. Sinks are interfaces for receiving objects.  
```javascript
interface Sink {  
   optional void put(obj) /\* Called back when data is sent to the sink. \*/  
   optional void remove(obj) /\* Called back when data is removed from the sink. \*/  
   optional void error() /\* Called back when anything goes wrong during sink operation. \*/  
   optional void eof() /\* Called back when a sequence of puts or removes completes. \*/  
}  
interface DAO {  
  **void put(obj, opt\_sink)** /\* Invoke to store an object; optionally put to sink once data is put to DAO. \*/  
  **void remove(query, opt\_sink)** /\* Invoke to delete (an) object(s) from store; optionally remove from sink after removing from DAO. \*/  
  **void find(query, sink)** /\* Look up by primary key; put result to sink \*/  
  **Future\<sink\> select(sink)** /\* Put all objects in DAO to sink. Future resolves with passed-in sink after operation is complete. \*/  
  **Future\<sink\> update(expression)** /\* **TODO(markdittmer): Document this**. \*/  
  **void listen(sink)** /\* Listen to all sinkable operations on this DAO. \*/  
  **void pipe(sink)** /\* Short-hand for select(sink); listen(sink). \*/  
  **void unlisten(sink)** /\* Unhook listener from DAO. \*/  
  **DAO where(query)** /\* Construct decorated DAO that only contains objects matching query. \*/  
  **DAO limit(count)** /\* Construct decorated DAO that only contains the first count objects. \*/  
  **DAO skip(count)** /\* Construct decorated DAO that skips the first count objects. \*/  
  **DAO orderBy(...comparators)** /\* Construct decorated DAO that stores objects in order described by comparators. \*/  
}  

```
functions as sinks; function called back on put.

# Reactivity

FOAM3 automatically updates UI when data changes using these patterns:

## **Listen to Changes**
```javascript
this.property$.sub(function(subscription, propertyName, oldValue, newValue) {
  // Do something when property changes
});
```

## **Display Properties**
```javascript
// Show property value (updates automatically)
this.start('span').add(this.prop$).end()
```

## **Computed Values**
```javascript
// Returns computed value that updates when dependencies change
this.dynamic(function(prop1, prop2) {
  return prop1 + ' ' + prop2;
});
```

## **Dynamic Views**
```javascript
// Auto-binds to data properties
this.add(function(firstName, lastName) {
  return this.start('div').add(`Name: ${firstName} ${lastName}`).end();
});

// For object properties, use this.dynamic() directly
this.start('div')
  .add(this.dynamic(function(myProp, otherProp) {
    return `Values: ${myProp} ${otherProp}`;
  }))
.end();
```

**Note:** `this.add(function(){})` auto-binds to `data` properties. For the object itself, use `this.dynamic()` directly.

# Context and Dependency Injection

## **Context and Subcontext**

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

## **Imports and Exports**

**imports** - Inject dependencies from context into this object.  
**exports** - Make properties/services available to child objects in context.

Context dependency injection:
```javascript
foam.CLASS({
  name: 'UserService',
  imports: [
    'userDAO',              // Injects this.userDAO from context
    'notificationService?', // Optional import (won't fail if missing)  
    'currentUser'           // Injects this.currentUser
  ],
  exports: [
    'userDAO',              // Exports this.userDAO to child context
    'as notificationService' // Exports this as notificationService
  ]
});
```

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

## **Context Patterns**

View with context injection:
```javascript
foam.CLASS({
  name: 'UserView',
  extends: 'foam.u2.View',
  imports: ['userDAO', 'stack', 'ctrl'],
  exports: ['data as selectedUser'],
  requires: ['foam.u2.DetailView'],
  
  methods: [
    function render() {
      // DetailView inherits userDAO, stack, ctrl, selectedUser
      this.add(this.DetailView.create({
        data: this.data
      }));
    }
  ]
});
```

Service with dependency injection:
```javascript
foam.CLASS({
  name: 'DataService',
  imports: ['userDAO', 'orderDAO', 'logger?'],
  exports: ['as dataService'],
  requires: ['com.project.UserValidator'],
  
  methods: [
    function validateUser(user) {
      // Validator inherits full context
      var validator = this.UserValidator.create();  
      return validator.validate(user);
    }
  ]
});
```

