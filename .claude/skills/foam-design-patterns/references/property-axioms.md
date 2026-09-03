# Property axioms

Which hook, which type, and the three mistakes that produce shared state, stale values, or a race.

| Principle | One-line test |
|---|---|
| `value` literal, `factory` mutable, `expression` derived, `adapt` coerce, `postSet` rewire | does the hook name match what the code does? |
| `value: []` shares one array across every instance | any `value:` that is an object or array is wrong |
| A server-created object never runs a JS hook | who creates this: Java or the browser? |
| Type the property to the domain | is a number, date, code, or currency stored as `String`? |
| A derived value is transient with paired `factory`/`javaFactory` | would a stored copy go stale? |

### Pick the hook by what the code does
Each hook has one timing; using another produces a value that is stale, shared, or undefined.
Don't: `factory:` for a value that depends on other properties; `preSet:` that side-effects; `postSet:` that computes this property's own value
Do:    `value:` literal scalar · `factory:` per-instance object or needs `this` · `expression:` pure function of the named properties · `adapt:` coerce input · `postSet:` detach the old, subscribe the new, on other objects
Review asked: "Don't use expression: and factory: interchangeably." (`doc/guides/claude.md:1059`)

### `value: []` shares one array across every instance
`value` is evaluated once at class definition; every instance points at the same object.
Don't: `{ class: 'Array', name: 'ids', value: [] }`
Do:    `{ class: 'Array', name: 'ids' }` (Array already has the factory), or `factory: function() { return []; }`
Review asked: "Should never do value: [] otherwise all instances will share the same array" (PR #3821)

### Return `null`, never `undefined`, from a factory or expression
`undefined` means "not computed yet" to the getter, so an expression that returns it is re-run, and re-subscribed, on every read.
Don't: `expression: function(x) { if ( ! x ) return; ... }`
Do:    `return (some expression) || null;` — `null` is a real value and is cached
Review asked: "'undefined' has a special meaning for factory and expression values that means they need to be computed. Returning undefined will cause them to be repeatedly calculated." (PR #5393)

### A server-created object never runs a JS hook
`postSet` in JS runs in the browser; an object built by a Java rule never passes through it, and `find().then()` resolves after the read.
Don't: `postSet: function(o, n) { this.userDAO.find(n).then(u => this.userName = u.toSummary()); }`
Do:    a `javaFactory` on a `storageTransient` property, or a `Reference` property whose view resolves the name
Review asked: "Aren't these created on the server in java? The JS postSet will never be run. Also, it would be a race condition"

### Async coercion is `normalize`, never `postSet`
`normalize` is awaited by the DAO before `put`; a `postSet` that writes back later loses the race with the caller.
Don't: `postSet` that fires a DAO `find` and writes the property when it resolves
Do:    `normalize: async function() { ... }` on the property

### Type the property to the domain
A `String` column defeats indexing, arithmetic, comparison, the query parser, and journal size; `Float` loses cents.
Don't: `class: 'String'` for an amount, a date, a direction code, an ISO currency
Do:    `Double` for money, `Enum` + `of:` for codes, `Date`/`DateTimeUTC` for timestamps, `CurrencyCode`, `Int` for ISO numerics

### A derived value is transient with paired `factory` and `javaFactory`
A stored copy of something computable goes stale the moment its inputs change.
Don't: a persisted `netAmount` column written by a rule
Do:    `{ class: 'Double', name: 'netAmt', storageTransient: true, factory: ..., javaFactory: ... }`
Review asked: "More efficient to be a factory on a transient field."

### `isSet` is false until the factory runs; an Enum is never `null`
Enum properties default to ordinal 0, so a null check never fires; a factory-backed property reports unset until first read.
Don't: `if ( getStatus() == null )`; `if ( ! xIsSet_ ) /* treat as absent */` when `x` has a factory
Do:    `if ( ! statusIsSet_ )`; read the value and let the factory run

### A per-subclass constant is a method override, not a property
A property costs a settable field, a serialization slot, and a shadowing hazard; a method costs nothing.
Don't: `properties: [ { name: 'category', value: IndexCategory.BOOLEAN } ]` in each subclass
Do:    `methods: [ { name: 'category', code: ..., javaCode: 'return IndexCategory.BOOLEAN;' } ]`
