# FOAM3 Debugging: `count_` and `foam.USED`

This document explains two important debugging mechanisms in FOAM3 for tracking class usage and object instantiation in JS.

## `count_` - Instance Creation Counter

### What is it?
Every FOAM class has a `count_` property that tracks how many instances of that class have been created.

### Where is it defined?
In `foam/lang/Boot.js:146`:
```javascript
cls.count_ = 0;  // Number of instances created
```

### How is it incremented?
Every time `create()` is called on a class, the counter is incremented in `foam/lang/FObject.js:63`:
```javascript
function create(args, opt_parent) {
  var obj = Object.create(this.prototype);

  // Increment number of objects created of this class.
  this.count_++;

  // ... rest of object initialization
}
```

### Usage Example
```javascript
// Check how many instances of a specific class were created
console.log(foam.u2.Element.count_);  // e.g., 1523

// Check creation count for any class
var myClass = foam.lookup('com.paytic.domain.MyModel');
console.log(myClass.id, myClass.count_);
```

---

## `foam.USED` - Registry of Used Classes

### What is it?
`foam.USED` is an object (dictionary/map) that stores references to all FOAM models that have been actually instantiated/used in the current session.

### Where is it defined?
In `foam/lang/EndBoot.js:295`:
```javascript
foam.USED   = {};
foam.UNUSED = {};
```

### How are classes added to `foam.USED`?
When a class is first looked up/created, it moves from `foam.UNUSED` to `foam.USED`:
```javascript
// From EndBoot.js:331-335
var f = foam.Function.memoize0(function() {
  delete foam.UNUSED[m.id];
  try {
    var c = CLASS(m);
    foam.USED[m.id] = m;  // <-- Added here when class is first used
    return c;
  } catch(x) {
    console.log('ERROR: Class definition error in', m.id, x);
    throw x;
  }
});
```

### Usage Example
```javascript
// Get all used class IDs
Object.keys(foam.USED);  // ['foam.lang.FObject', 'foam.u2.Element', ...]

// Check if a specific class has been used
if (foam.USED['com.paytic.domain.MyModel']) {
  console.log('MyModel has been used');
}

// Get the model definition
var modelDef = foam.USED['com.paytic.domain.MyModel'];
```

---

## Combined Usage: Instance Count Analysis

The most common debugging use case combines both to analyze memory usage and object creation patterns.

### Console Command (from FObject.js comment)
```javascript
// Show all classes and their instance counts
Object.keys(foam.USED).forEach(k => {
  try {
    var m = foam.maybeLookup(k);
    console.log(m.id, m.count_);
  } catch (x) {}
});
```

### Built-in Scripts
FOAM3 includes pre-built scripts in `scripts.jrl`:

**Show Creation Counts** - Lists all classes with their instance counts:
```javascript
var a = [];
Object.keys(foam.USED).forEach(k => {
  try {
    var m = foam.maybeLookup(k);
    if ( m && m.count_ ) a.push(m);
  } catch (x) {}
});

a.sort(function (a, b) { return a.count_ - b.count_ });

for ( var i = 0 ; i < a.length ; i++ ) {
  var m = a[i];
  console.log(m.id, m.count_);
}
```

**Clear Creation Counts** - Resets all counters to zero (useful for measuring specific operations):
```javascript
Object.keys(foam.USED).forEach(k => {
  try {
    var m = foam.maybeLookup(k);
    if ( m && m.count_ ) m.count_ = 0;
  } catch (x) {}
});
```

---

## Related: `foam.UNUSED`

`foam.UNUSED` contains models that are defined but not yet instantiated. When a class is first used, it moves from `foam.UNUSED` to `foam.USED`.

```javascript
// Check what classes are defined but never used
Object.keys(foam.UNUSED);
```

---

## Practical Debugging Scenarios

### 1. Finding Memory Leaks
If `count_` keeps growing for a class that should have limited instances, you may have a leak:
```javascript
// Before operation
var before = foam.lookup('MyClass').count_;

// ... perform operation ...

// After operation
var after = foam.lookup('MyClass').count_;
console.log('Created:', after - before, 'instances');
```

### 2. Profiling Object Creation
```javascript
// Clear counts
Object.keys(foam.USED).forEach(k => {
  try { foam.maybeLookup(k).count_ = 0; } catch(x) {}
});

// Perform action you want to profile
await someOperation();

// Show what was created
var results = [];
Object.keys(foam.USED).forEach(k => {
  var m = foam.maybeLookup(k);
  if (m && m.count_ > 0) results.push({ id: m.id, count: m.count_ });
});
results.sort((a,b) => b.count - a.count);
console.table(results.slice(0, 20));  // Top 20 most created classes
```

### 3. Understanding Code Paths
See which classes are used when a feature is triggered:
```javascript
var usedBefore = new Set(Object.keys(foam.USED));

// Trigger feature
clickButton();

var newlyUsed = Object.keys(foam.USED).filter(k => !usedBefore.has(k));
console.log('Newly loaded classes:', newlyUsed);
```
