<flow name="be:FAQ" category="DOC/EXAMPLES" spid="foam" description="Frequently asked questions about FOAM concepts, patterns and best practices, answered with live examples." keywords="faq,questions,patterns,best practices,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM FAQ

Frequently asked questions about FOAM concepts, patterns, and best practices. This document covers common questions that arise when learning and using FOAM.

<toc></toc>

## Overview

This FAQ addresses questions in several categories:

| Category | Topics |
|----------|--------|
| **Core Concepts** | Classes, packages, types, axioms |
| **Properties** | Slots, precedence, cloning, references |
| **Views** | ViewSpecs, Element lifecycle, start() arguments |
| **Services** | Client/server architecture, stubs, skeletons |
| **Data** | DAOs, sinks, journals, freezable objects |
| **Configuration** | CSpec, flags, service initialization |

## Built-In Constants

**Q: Where can I find built-in constants?**

Property constants are copied out of the model into the resulting class and prototype. You can access them on both the class and instances.

<example id="built-in-constants">
foam.CLASS({
  name: 'Test',
  properties: [ 'p1', 'p2' ]
});

log(Test.P1.name, Test.P2.name);

var t = Test.create();
log(t.P1.name, t.P2.name);

// You can also describe them:
log("Method CODE property constant:", foam.lang.Method.CODE);
foam.lang.Method.CODE.describe;
</example>

---

## Class Type

**Q: Is a class a kind of type?**

A <term term="class"></term> is a class in the conventional OO sense. When you create a `foam.CLASS()`, it defines a new class. When you see something like `{ class: 'some.package.Name', a: 1, b: 2 }`, it creates an object of class `some.package.Name` with property `a` set to 1 and `b` to 2. This is equivalent to `some.package.Name.create({a: 1, b: 2})`.

FOAM extends regular JSON syntax to support object creation by specifying their class.

<example id="class-type">
foam.CLASS({
  package: 'some.package2',
  name: 'Test',
  properties: [ 'p1', 'p2' ]
});

var p = foam.json.parse({class: 'some.package2.Test', p1: 42, p2: 'John'});
log(p.cls_.id);
</example>

---

## Packages

**Q: How are packages defined in FOAM?**

A class's <term term="package"></term> is defined with `package:` and is optional. When used from another class, packaged classes can be required with `requires:`.

<example id="packages">
// Without a package:
foam.CLASS({
  name: 'Test',
  properties: [ 'p1', 'p2' ]
});

log(Test.create());

// With a package:
foam.CLASS({
  package: 'some.package2',
  name: 'Test',
  properties: [ 'p1', 'p2' ]
});

log(some.package2.Test.create());

// When used from another class, packaged classes can be required:
foam.CLASS({
  name: 'Client',
  requires: [ 'some.package2.Test' ],
  methods: [
    function createTest() { return this.Test.create(); }
  ]
});

log(Client.create().createTest());
</example>

---

## FOAM Types

**Q: What are all of the types in FOAM?**

In FOAM, "types" are subclasses of <term term="foam.lang.Property"></term>. Most types are defined in `foam/lang/types.js`. Types are not hard-coded into FOAM — you can create your own by extending Property.

<example id="foam-types">
for ( var v in foam.USED ) {
  try {
    if ( foam.lang.Property.isSubClass(foam.lookup(v, true)) ) log(v);
  } catch(x) {}
}
for ( var v in foam.UNUSED ) {
  try {
    if ( foam.lang.Property.isSubClass(foam.lookup(v, true)) ) log(v);
  } catch(x) {}
}
</example>

---

## Flags

**Q: What does `flags: ['java']`, `flags: ['web']`, `flags: ['node']` mean?**

Some FOAM models are intended only for specific platforms, and the <term term="flags"></term> feature determines when and where a model will be loaded or ignored.

| Flag | Purpose |
|------|---------|
| `flags: ['web']` | Only load in web browsers |
| `flags: ['node']` | Only load in Node.js |
| `flags: ['java']` | Only for Java generation |
| `flags: ['swift']` | Only for Swift generation |
| `flags: ['debug']` | Only load in debug mode (default) |

In your HTML file, customize flags by setting `FOAM_FLAGS` before loading FOAM:

```html
<script>FOAM_FLAGS = {debug: false};</script>
<script language="javascript" src="../../../foam.js"></script>
```

The set of flags isn't fixed — you can create your own for your own purposes.

<example id="flags">
Object.keys(foam.flags).forEach(k => {
  log(k + ': ' + foam.flags[k]);
});
</example>

---

## References

**Q: How do I use References?**

A <term term="Reference"></term> is a type of property which stores the primary key of a record stored in a DAO.

To create a Reference property:
1. Set `class: 'Reference'`
2. Set `of:` to the model of the referenced class
3. Set `targetDAOKey:` to the context key of the referenced DAO

Relationships with `cardinality: '1:*'` will add a Reference property to the target model.

Each reference property has associated helper properties:
- `$dao` — Returns the referenced DAO
- `$find` — Returns a promise that looks up the referenced object

<example id="references">
foam.CLASS({
  name: 'Province',
  properties: [ 'id', 'name' ],
  methods: [
    function toSummary() { return this.name; }
  ]
});

foam.CLASS({
  name: 'ReferenceTest',
  requires: [
    'foam.dao.EasyDAO',
    'foam.u2.view.ReferenceView'
  ],
  properties: [
    {
      name: 'provinceDAO',
      hidden: true,
      factory: function() {
        return this.EasyDAO.create({
          of: Province,
          daoType: 'MDAO',
          testData: [
            { id: 'ON', name: 'Ontario' },
            { id: 'PQ', name: 'Quebec' },
            { id: 'NS', name: 'Nova Scotia' },
            { id: 'NB', name: 'New Brunswick' },
            { id: 'PE', name: 'Prince Edward Island' }
          ]
        });
      }
    },
    {
      class: 'Reference',
      name: 'province1',
      of: 'Province',
      targetDAOKey: 'provinceDAO'
      // Without specifying view:, uses ReferenceView displaying toSummary()
    },
    {
      class: 'Reference',
      of: 'Province',
      name: 'province2',
      targetDAOKey: 'provinceDAO',
      view: {
        class: 'foam.u2.view.ReferenceView',
        objToChoice: function(obj) { return [obj.id, obj.id + ' ' + obj.name]; }
      }
    }
  ]
});

add('output');
var rt = ReferenceTest.create({province1: 'ON', province2: 'PQ'});
add(rt);

// Each reference property has an associated $dao property
add('select: ').start().style({'margin-left': '12px'}).select(rt.province1$dao, function(p) {
  return this.E().add(p.name);
}).end().br();

// Each reference property has an associated $find property (returns a promise)
rt.province1$find.then(function(p) {
  add('find province1: ', p.name);
});

rt.province2$find.then(function(p) {
  add('find province2: ', p.name);
});

add('find: ').add(rt.province1$find);
</example>

---

## Slot.clear()

**Q: What does Slot.clear() do?**

Calling `slot.clear()` is the same as setting the associated property to `undefined` or calling `clearProperty()` on the owning object. In all three cases, it reverts the property to its initial value.

The initial value is determined by (in order of precedence): `value:`, `factory:`, or `expression:`.

<example id="slot-clear">
foam.CLASS({
  name: 'Test',
  properties: [
    { name: 'noDefault' },
    { name: 'defaultValue', value: 42 },
    { name: 'defaultFactory', factory: function() { return this.defaultValue * 10; } },
    {
      name: 'defaultExpression',
      expression: function(defaultValue, defaultFactory) {
        return defaultValue + defaultFactory;
      }
    }
  ]
});

var t = Test.create();
log('Initial:', t.noDefault, t.defaultValue, t.defaultFactory, t.defaultExpression);

t.noDefault = 1;
t.defaultValue = 2;
t.defaultFactory = 3;
t.defaultExpression = 4;
log('After set:', t.noDefault, t.defaultValue, t.defaultFactory, t.defaultExpression);

t.noDefault = undefined;
t.clearProperty('defaultValue');
t.defaultFactory$.clear();
log('After clear:', t.noDefault, t.defaultValue, t.defaultFactory, t.defaultExpression);
</example>

---

## Property Cloning

**Q: Does slot.follow() clone the property?**

No, it doesn't clone the property — it just copies the property value whenever it changes. It's equivalent to:

```javascript
p2.name$.sub(function() { p1.name = p2.name; });
```

Note that `follow()` creates a one-way binding. For two-way data-binding, use `linkFrom()` or direct slot assignment (`p1.name$ = p2.name$`).

<example id="property-cloning">
foam.CLASS({name: 'Person', properties: [ 'name' ]});

p1 = Person.create();
p2 = Person.create({name: 'John'});
log('Initial:', p1.name, p2.name);

p1.name$.follow(p2.name$);
log('After follow:', p1.name, p2.name);

p2.name = 'Janet';
log('After p2 update:', p1.name, p2.name);

// The binding is 1-way. Changing p1 doesn't affect p2:
p1.name = 'Kevin';
log('After p1 update:', p1.name, p2.name);

// For 2-way data-binding:
p1 = Person.create();
p2 = Person.create({name: 'John'});

p1.name$ = p2.name$;

log('After link:', p1.name, p2.name);

p1.name = 'Steve';
log('After p1 update:', p1.name, p2.name);

p2.name = 'Samantha';
log('After p2 update:', p1.name, p2.name);
</example>

---

## Literal Views

**Q: What does "Use of literal View as ViewSpec" error mean?**

It means you've added an actual View object to another View instead of adding a <term term="ViewSpec"></term>. A ViewSpec is a specification for creating a view, but not yet an actual View.

U2 relies on ViewSpecs instead of Views directly for two reasons:

1. When creating the View from a ViewSpec, it ensures the View is created in the proper sub-context with access to values exported by parent views or services.
2. Some parent views (like StackView) may need to recreate the view more than once, which they can easily do from a ViewSpec.

<example id="literal-views">
foam.CLASS({
  name: 'Test',
  extends: 'foam.u2.Element',
  requires: [ 'foam.u2.ControllerMode', 'foam.u2.view.StringView' ],
  methods: [
    function render() {
      this.startContext({controllerMode: this.ControllerMode.VIEW}).
        // works, but generates a warning
        add('literal: ').tag(this.StringView.create({data: 'value1'})).
        br().
        // works without a warning
        add('viewSpec: ').tag(this.StringView, {data: 'value2'}).
      endContext();
    }
  ]
});

add(Test.create());
</example>

---

## Property Value Precedence

**Q: What method of determining a property's value takes precedence?**

The order of precedence is:

1. The value returned by `getter:`, if specified
2. The value the property has been set to, if set (e.g., `t.p2 = 2;`)
3. The value returned by `factory:`, if specified
4. The value returned by `expression:`, if specified
5. The value specified by `value:`, if specified
6. `undefined`

<example id="property-precedence">
foam.CLASS({
  name: 'Test',
  properties: [
    { name: 'value', value: 4 },
    {
      name: 'p1',
      getter: function() { return 1; },
      factory: function() { return 3; },
      expression: function(value) { return value; },
      value: 5
    },
    {
      name: 'p2',
      factory: function() { return 3; },
      expression: function(value) { return value; },
      value: 5
    },
    {
      name: 'p3',
      factory: function() { return 3; },
      expression: function(value) { return value; },
      value: 5
    },
    {
      name: 'p4',
      expression: function(value) { return value; },
      value: 5
    },
    { name: 'p5', value: 5 },
    { name: 'p6' }
  ]
});

var t = Test.create({p1: 2, p2: 2});
log(`p1: ${t.p1}, p2: ${t.p2}, p3: ${t.p3}, p4: ${t.p4}, p5: ${t.p5}, p6: ${t.p6}`);
</example>

---

## Mutation Not Allowed

**Q: What does "Mutation is not allowed in output state" mean?**

In U2, Elements have a lifecycle: INITIAL → OUTPUT → LOADED → UNLOADED.

When an element is OUTPUT but not yet LOADED, it can't be modified — attempting to do so produces this error. U2 loads elements immediately after outputting them, so this typically happens when an element throws an exception in its `render()` method.

**Solution:** Add a try-catch block to your offending element to find the unexpected exception.

**Note:** U3 (U2's replacement) eliminates states entirely, making this error impossible.

---

## Remote Listener Support

**Q: What is remote listener support?**

The JS <term term="EasyDAO"></term> has a boolean property `remoteListenerSupport` (default: false).

| Setting | Protocol | Behavior |
|---------|----------|----------|
| `false` | HTTP (HTTPBox) | Temporary connections, no server-to-client events |
| `true` | WebSocket | Persistent connections, DAO update events propagate to clients |

With `remoteListenerSupport: true`, when data is updated on the server by a different user, clients are notified to refresh. Without it, clients won't know about remote changes.

WebSocket connections are more expensive to support, so they're rarely used.

---

## Enum Values

**Q: How does "values" work in foam.ENUM()?**

`foam.ENUM()` creates an <term term="enumeration"></term>, not a regular class — similar to enums in C or Java. Unlike classes, you can't create new instances of enums. Every instance is pre-created and stored as a constant on the enum (e.g., `DayOfWeek.MONDAY`).

Because there's only one instance of each enum value (they're singletons), you can compare equality with `==` in Java.

<example id="enum-values">
foam.ENUM({
  name: 'DayOfWeek',
  values: [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ]
});

var e = DayOfWeek.MONDAY;
log(e.name + ' ' + e.label + ' ' + e.ordinal + ' ' + e.toString());
log(DayOfWeek.forOrdinal(3).name);

for ( var day of DayOfWeek.VALUES ) {
  log(day.ordinal + " " + day.name);
}

log('isInstance(MONDAY):', DayOfWeek.isInstance(DayOfWeek.MONDAY));
log('isInstance("Sunday"):', DayOfWeek.isInstance('Sunday'));
</example>

---

## Element.start()

**Q: What are the arguments to Element.start()?**

The `start()` method accepts several argument types:

| Argument | Result |
|----------|--------|
| None | Creates a DIV tag |
| String | Creates the specified HTML tag |
| ViewSpec | Creates the specified U2View |
| Class | Creates an instance of that class |
| Function | Calls the function and uses its return value |
| Object with `toE()` | Calls `toE()` to get the element |

The optional second argument specifies data/properties. The optional third argument is a slot that receives the created Element.

<example id="element-start">
// No arguments: creates a DIV tag
add(E().start().add("I'm in a div.").end());

// String: specifies an HTML tag name
add(E().start('b').add('bold').end());

// ViewSpec: specifies a U2View
add(E().start({class: 'foam.u2.TextField'}).end());

// Custom view:
foam.CLASS({
  name: 'MyView',
  extends: 'foam.u2.View',
  methods: [
    function render() {
      this.add('MyView, myData: ', this.data$);
    }
  ]
});

// Second argument specifies data:
add(E().start({class: 'MyView'}, {data: 'data1'}).end());

// These also work:
add(E().start({class: 'MyView', data: 'data2'}).end());
add(E().start(MyView, {data: 'data3'}).end());

// Function:
var randomTag = function() { return Math.random() < 0.5 ? 'b' : 'i'; };
for ( var i = 0 ; i < 5 ; i++ )
  add(E().start(randomTag).add('bold or italic').end());

// Object with toE() method:
add(foam.util.Timer.create());

// Properties and Actions implement toE():
foam.CLASS({
  name: 'PropertyAndAction',
  extends: 'foam.u2.Controller',
  properties: [ { class: 'Int', name: 'count' } ],
  actions: [ { name: 'plusOne', code: function() { this.count++; } } ],
  methods: [
    function render() {
      this.start(this.COUNT).end().start(this.PLUS_ONE).end();
    }
  ]
});

add(PropertyAndAction.create());

// Note: .tag() is the same as .start().end()
add(E().start('input').end());
add(E().tag('input'));
</example>

---

## Element.callIf()

**Q: When should I use Element.callIf()?**

`call`, `callIf`, `callIfElse`, and `forEach` are defined in <term term="foam.lang.Fluent"></term> for creating "fluent interfaces" — where methods can be chained without storing intermediate values.

`callIf()` provides conditional logic without breaking the fluent chain.

<example id="element-callif">
// Fluent interface example:
add(E().start('div')
  .style({border: '2px solid red', background: 'pink'})
  .on('click', function() { log('click'); })
  .start('b').add('bold text').end()
  .br()
  .start('i').add('italic text').end()
  .start('blockquote')
    .add('inside')
    .start('blockquote')
      .style({background: 'white'})
      .add('in inside')
    .end()
  .end()
.end());

// callIf() provides 'if' statements without breaking the fluent interface:
function sign(isHoliday) {
  add(E().tag('hr').start()
    .start('b').add('Acme Widget Store').end()
    .callIf(isHoliday, function() {
      this.br().start('b').add("Sorry, we're closed today!").end();
    })
  .end());
}

sign(true);
sign(false);
</example>

---

## init() and render()

**Q: What's the difference between init() and render()?**

| Method | Defined On | Called When |
|--------|------------|-------------|
| `init()` | FObject | When any FOAM object is created |
| `render()` | foam.u2.Element | Just before a U2 element is added to the DOM (after init) |

> **Note:** `render()` was previously called `initE()`.

In U2, Borders need to use `init()` instead of `render()`, but in U3 both use `render()`.

<example id="init-render">
foam.CLASS({
  name: 'Test',
  methods: [
    function init() { log('init called on ' + this.cls_.name); },
    function render() { this.add('element'); log('render called on ' + this.cls_.name); }
  ]
});

foam.CLASS({
  name: 'TestElement',
  extends: 'foam.u2.Element',
  methods: [
    function init() { log('init called on ' + this.cls_.name); },
    function render() { this.add('element'); log('render called on ' + this.cls_.name); }
  ]
});

var test = Test.create();
var testE = TestElement.create();

log('both objects created');
add(testE);
</example>

---

## Service client:

**Q: How should I understand service "client:" configurations?**

### Client Stub Pattern

```json
"client": {
  "class": "foam.core.export.ClientGoogleSheetsExportService",
  "delegate": {
    "class": "foam.box.HTTPBox",
    "url": "service/googleSheetsDataExport"
  }
}
```

This is a **Client Stub**. It implements an interface by converting method calls into Box network calls. The message is sent to a **Server Skeleton** which converts the network call back to a local method call.

<term term="Stub"></term> and <term term="Skeleton"></term> patterns create the illusion that remote services are local by abstracting away the network interface.

### DAO Client

```json
"client": "{\"of\": \"foam.core.auth.GroupPermissionJunction\"}"
```

This doesn't supply `class` because the default for DAO services is `foam.dao.ClientDAO`.

---

## Slot Types

**Q: What are the differences between Slot, SimpleSlot, and ExpressionSlot?**

A <term term="Slot"></term> has three main methods:
- `set(value)` — Set the Slot's value
- `get()` — Get the Slot's value
- `sub(listener)` — Subscribe to value changes

| Type | Purpose |
|------|---------|
| PropertySlot | Bound to a property value (accessed via `property$`) |
| SimpleSlot | Standalone slot not bound to a property |
| ExpressionSlot | Combines multiple property values into one |

<example id="slot-types">
foam.CLASS({
  name: 'Person',
  properties: [ 'firstName', 'lastName' ]
});

var p1 = Person.create({firstName: 'Kevin', lastName: 'Greer'});
log(p1.firstName, p1.firstName$.cls_.name, p1.firstName$.get());

// Update directly:
p1.firstName = 'Logan';
log(p1.firstName);

// Or through the slot:
p1.firstName$.set('Mark');
log(p1.firstName);

// Subscribe to changes:
p1.firstName$.sub(function() {
  log('firstName change:', p1.firstName);
});

p1.firstName = 'Logan';
p1.firstName$.set('Kevin');

// SimpleSlot: for slots not bound to a property
var slot = foam.lang.SimpleSlot.create({value: 'Tala'});
log('SimpleSlot:', slot.get());
slot.set('Janet');
log('SimpleSlot:', slot.get());

// ExpressionSlot: combines multiple properties
var fullName = p1.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;
});
log('fullName:', fullName.get());

fullName.sub(function() {
  log('full name changed:', fullName.get());
});

p1.firstName = 'John';
p1.lastName = 'Doe';

// Note: ExpressionSlots aren't set()-able:
fullName.set('Jane Smith');
log('After set attempt:', fullName.get()); // Still John Doe
</example>

---

## Sink

**Q: What is the difference between ArraySink and AbstractSink?**

<term term="AbstractSink"></term> is an abstract base class for implementing the Sink interface. <term term="ArraySink"></term> is one implementation that stores all values from `select()` in an `array` property.

**ArraySink approach:**
```java
ArraySink sink = (ArraySink) dao.select(new ArraySink());
for ( int i = 0; i < sink.getArray().size(); i++ ) {
  SomeObject obj = (SomeObject) sink.getArray().get(i);
  if ( obj.something() ) break;
}
```

**AbstractSink approach (more efficient):**
```java
dao.select(new AbstractSink() {
  public void put(Object o, Detachable d) {
    SomeObject obj = (SomeObject) o;
    if ( o.something() ) d.detach();
  }
});
```

**Why AbstractSink is better:**
- Doesn't allocate memory for an array
- Starts processing records immediately
- Can abort early via `d.detach()` without processing remaining records

---

## javaExtras / javaCode

**Q: What is javaExtras and how do I use it?**

When you need to add extra Java code to a generated class, use `javaCode:` (formerly `javaExtras`):

```javascript
javaCode: `
  public CompoundException(String message) {
    super(message);
  }

  public CompoundException(String message, java.lang.Exception cause) {
    super(message, cause);
  }
`
```

FOAM models are collections of <term term="axioms"></term>. Properties, methods, actions, imports, exports — all are axioms. Each axiom has methods for building its part into generated code. The old `javaExtras` pattern used custom axioms, but was promoted to first-class `javaCode:` since it was used 110+ times.

---

## Journals

**Q: What's the difference between runtime and static journals?**

| Type | Extension | Purpose |
|------|-----------|---------|
| Static | `.0` | Initial configuration shipped with the system, combined from `.jrl` files |
| Runtime | `.jrl` | Data created/modified/deleted after deployment |

The system state is determined by applying static journals first, then runtime journals.

---

## Axioms

**Q: When should I use axioms with javaExtras?**

Everything defined on a model is an <term term="axiom"></term> — methods, properties, listeners, refines, imports, etc. There's no notable difference between defining an axiom in a model directly or adding it to the axioms array — the build process instantiates the model and builds it up either way.

See the [axiom documentation](https://github.com/kgrgreer/foam3/blob/5ceaacfa6abf370cfb08f31cc7c24fc2f44197fe/src/foam/lang/Boot.js#L79): "Axioms can be added either during the initial creation of a class and prototype, or anytime after."

---

## Freezable

**Q: What does "freeze" mean and why do we need it?**

Freezing objects maintains consistent data in FOAM data structures — primarily DAOs. We want to save the original object once it's in the DAO and only modify it through another DAO put. Without <term term="Freezable"></term>, a service could still have access to an object and save modifications directly.

**A frozen object means no modifications should happen.**

FOAM implements this with the `Freezable` interface on all FObjects. The default `beforeFreeze()` is a no-op, with a refinement that ensures javaFactory properties are called before freezing.

```java
// Example: beforeFreeze ensures factory properties are initialized
public void beforeFreeze() {
  getStatus();
  getServerDaoKey();
  getAdditionalGroups();
}
```

Without calling these properties before freezing, their javaFactory default code would never run if the property was never explicitly set.

---

## CSpec Service Initialization

**Q: What's the difference between "service", "serviceClass", and "serviceScript"?**

When creating <term term="CSpec"></term> services, there are three methods (attempted in order):

| Method | Use Case |
|--------|----------|
| `service` | FObject service that can be created and configured inline |
| `serviceClass` | Service class with no configuration needed |
| `serviceScript` | Complex initialization with multiple composed objects |

### 1. service

```json
"service": {
  "class": "foam.core.jetty.HttpServer",
  "port": 8080
}
```

The service is modelled and can be created and configured inline. Advantage: If edited through the GUI, a DetailView is embedded for easy configuration.

### 2. serviceClass

```json
"serviceClass": "foam.core.http.NanoRouter"
```

Use when the class doesn't require configuration. Note: Using `"service": {"class": "..."}` wouldn't work for non-modelled services like NanoRouter (which extends Java HttpServlet).

### 3. serviceScript

```javascript
"serviceScript": """
  auth = new foam.core.auth.UserAndGroupAuthService(x);
  auth = new foam.core.auth.EnabledCheckAuthService.Builder(x)
    .setDelegate(auth)
    .build();
  // ... more composition
  return auth;
"""
```

Use when creating multiple composed objects that all need configuration. The default language is BeanShell; add `"language": 2` for JSHELL (compiled Java).

---

## Local DAO vs Non-Local DAO

**Q: What is the difference between userDAO vs localUserDAO?**

Most DAOs have both local and non-local versions (e.g., `accountDAO`/`localAccountDAO`, `transactionDAO`/`localTransactionDAO`). They point to the same journals — the non-local DAO is an extension of the local one.

```json
"serviceScript": """
  return new foam.dao.EasyDAO.Builder(x)
    .setPm(true)
    .setInnerDAO(x.get("localUserDAO"))
    .setOf(foam.core.auth.User.getOwnClassInfo())
    .setPermissioned(true)
"""
```

| DAO | Served | Security | Use Case |
|-----|--------|----------|----------|
| `userDAO` | Yes (`serve: true`) | Authorization decorators | Client-side access |
| `localUserDAO` | No (`serve: false`) | Minimal security | Server-side with trusted users |

The "local" name comes from being accessed only "locally" — from the server. If you're writing Java code and your user is already authorized or is a system user, calling `x.get("localUserDAO")` directly skips authorization logic for better performance.

## See Also

- [FOAM Services By Example](be:services) — Complete guide to service architecture
- [FOAM Views By Example](be:views) — Property views and DetailViews
- [FOAM Validation By Example](be:validation) — Property validation techniques
- [FOAM CSS Tokens By Example](be:CSSTokens) — Styling and theming

<glossary>
  <def term="class" definition="A FOAM class created with foam.CLASS(). Defines properties, methods, and other axioms."></def>
  <def term="package" definition="Optional namespace for FOAM classes, preventing naming conflicts."></def>
  <def term="foam.lang.Property" definition="Base class for all FOAM property types. Custom types are created by extending Property."></def>
  <def term="flags" definition="Platform-specific markers that control when models are loaded (web, node, java, swift, debug)."></def>
  <def term="Reference" definition="A property type that stores the primary key of a record in a DAO. Includes $dao and $find helper properties."></def>
  <def term="ViewSpec" definition="A specification for creating a view, allowing deferred instantiation with proper context."></def>
  <def term="EasyDAO" definition="A configurable DAO that combines multiple DAO decorators for common use cases."></def>
  <def term="enumeration" definition="A set of named constants created with foam.ENUM(). Instances are singletons comparable with ==."></def>
  <def term="foam.lang.Fluent" definition="Mixin providing fluent interface methods like call, callIf, callIfElse, and forEach."></def>
  <def term="Slot" definition="An observable value container with get(), set(), and sub() methods. The reactive primitive in FOAM."></def>
  <def term="PropertySlot" definition="A Slot bound to a property value, accessed via property$ syntax."></def>
  <def term="SimpleSlot" definition="A standalone Slot not bound to a property. Rarely used in application code."></def>
  <def term="ExpressionSlot" definition="A Slot that combines multiple property values via a function. Read-only."></def>
  <def term="AbstractSink" definition="Abstract base class for implementing the Sink interface for DAO select operations."></def>
  <def term="ArraySink" definition="A Sink implementation that collects all selected objects into an array."></def>
  <def term="axiom" definition="A declarative component of a FOAM model (properties, methods, actions, imports, exports, etc.)."></def>
  <def term="Stub" definition="Client-side proxy that converts method calls to network requests."></def>
  <def term="Skeleton" definition="Server-side handler that converts network requests to local method calls. Auto-generated when skeleton: true."></def>
  <def term="Freezable" definition="Interface for making objects immutable after being stored in a DAO."></def>
  <def term="CSpec" definition="Configuration specification for FOAM services, defining how they're created and initialized."></def>
  <def term="javaCode" definition="Model property for adding extra Java code to generated classes. Formerly javaExtras."></def>
  <def term="U2" definition="FOAM's reactive UI framework. Elements have lifecycle states: INITIAL → OUTPUT → LOADED → UNLOADED."></def>
  <def term="U3" definition="U2's replacement that eliminates lifecycle states and simplifies view development."></def>
</glossary>