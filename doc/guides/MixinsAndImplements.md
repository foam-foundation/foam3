**Summary**
- `implements:` declares intent to implement an interface or mix in a model, with special handling to avoid property override conflicts by inserting an intermediate axiom map level.
- `mixins:` directly copies all axioms from another model into the target class as if they were defined locally, without special conflict resolution.
---
## Key Differences
| Aspect | `implements:` | `mixins:` |
|--------|---------------|-----------|
| Purpose | Declare interface implementation or safe mix-ins; can be used for interfaces with or without implementation | Copy all axioms from another model into this class |
| Override handling | Inserts a new level in the class's `axiomMap_` so overridden properties see the correct super-property | No special handling; installs axioms directly |
| Property installation | Skips installing properties already present on the class | Installs all own axioms unconditionally |
| Error handling | Throws if the interface/mixin does not exist | Warns if the mixin does not exist but continues |
## Code Examples
### Using `implements:`
```javascript
foam.CLASS({
  name: 'AbstractDAOAgent',
  implements: [ 'foam.mlang.Expressions' ],
  // ...
});
```
### Using `mixins:`
```javascript
foam.CLASS({
  name: 'DAOPrompt',
  mixins: [ 'foam.core.reflow.DAOResolverMixin' ],
  // ...
});
```
## Implementation Details
- `Implements.installInClass` performs a complex dance: it avoids re-installing existing properties, then creates a new axiom map level to ensure overrides work correctly.
- `Mixin.installInClass` simply looks up the model and installs all its own axioms directly, warning if missing.
## When to Use Which
- Use `implements:` when you need interface-like semantics or safe multiple inheritance with proper override handling.
- Use `mixins:` for straightforward composition of axioms without concern for override edge cases.
## Notes
- Both are axioms in FOAM's model system.
- `implements:` can also be used for pure interfaces (properties without implementation), while `mixins:` always copies all axioms.
- The `Implements` axiom has higher priority (200) than `Mixin` (19), affecting installation order.
Wiki pages you might want to explore:
- [Advanced Features and Extensions (kgrgreer/foam3)](/wiki/kgrgreer/foam3#7)