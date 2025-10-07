## Expressions vs this.dynamic()

**Expressions** are reactive property computations defined at the model level that automatically recalculate when their dependencies change [1](#0-0) . **`this.dynamic()`** is a UI method that creates reactive DOM content that updates when referenced properties change [2](#0-1) .

### Property Expressions

Expressions are defined in FOAM class properties and create computed values: [3](#0-2)

They stop being reactive once manually set to a value, requiring reset to `undefined` to re-enable reactivity [4](#0-3) .

### this.dynamic()

`this.dynamic()` creates reactive UI elements in FOAM's U2 framework [5](#0-4) . It's implemented using `foam.lang.DynamicFunction` which extends `foam.lang.ExpressionSlot` [6](#0-5) .

The implementation shows that `DynamicFunction` eagerly evaluates and always updates even when nobody is accessing the value, making it suitable for UI updates [7](#0-6) .

### Key Differences

1. **Scope**: Expressions are model-level computed properties; `this.dynamic()` is for UI rendering
2. **Usage**: Expressions define reactive data; `this.dynamic()` creates reactive DOM content
3. **Evaluation**: Expressions are lazy (pull-based); `this.dynamic()` is eager (push-based) [8](#0-7)
4. **Context**: Expressions work with object properties; `this.dynamic()` works with UI elements and can access `data` properties automatically [9](#0-8)

## Notes

Both use FOAM's reactive slot system under the hood, but serve different purposes - expressions for computed model data and `this.dynamic()` for reactive UI rendering. The `DynamicFunction` implementation ensures UI updates happen immediately when dependencies change, while expressions only compute when accessed.

Wiki pages you might want to explore:
- [FOAM Framework Overview (kgrgreer/foam3)](/wiki/kgrgreer/foam3#1)
- [Advanced Features and Extensions (kgrgreer/foam3)](/wiki/kgrgreer/foam3#7)

### Citations

**File:** doc/guides/cheat-sheet.md (L134-136)
```markdown
{ class: 'String', name: 'fullName', expression: function(firstName, lastName) {
    return firstName + ' ' + lastName;
}}
```

**File:** doc/guides/cheat-sheet.md (L142-156)
```markdown
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
```

**File:** doc/guides/cheat-sheet.md (L315-317)
```markdown
this.dynamic(function(prop1, prop2) {
  return prop1 + ' ' + prop2;
});
```

**File:** doc/guides/cheat-sheet.md (L320-335)
```markdown
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
```

**File:** src/foam/lang/Slot.js (L611-614)
```javascript
foam.CLASS({
  package: 'foam.lang',
  name: 'DynamicFunction',
  extends: 'foam.lang.ExpressionSlot',
```

**File:** src/foam/lang/Slot.js (L676-693)
```javascript
    function subToArgs_(args) {
      // Overrides implementation in ExpressionSlot
      // Difference is an Expression only computes updated value if someone
      // has done a get() on the Slot, so is pull-based, but a DynamicFunction
      // always updates, even if nobody is get()-ing the value. This makes
      // it suitable as a kind of compound listener.
      const subs = args.map(a => a && a.sub(this.invalidate));

      if ( ! this.cleanup_ ) {
        this.cleanup_ = {
          detach: function() {
            for ( var i = 0 ; i < subs.length ; i++ ) {
              if ( subs[i] ) subs[i].detach();
            }
          }
        };
      }
    }
```
