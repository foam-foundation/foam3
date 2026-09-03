# Review checklist

Every principle as a question, ordered by how often it cost a review round. Walk the whole file,
not the diff hunks. Finding shape: `<path:line> — <principle heading> — <do line>`, one per line,
citing the reference file, never a person. Style nits go in one grouped line at the end.

## 1. Defaults and reuse
- `start('div')` where `start()` is the same? `addClass(this.myClass())` where `addClass()` is the same? Grep both; they hide in plain sight.
- Any other restated default? (`implements Expressions` on a View, `value: false`, `after/async: false`, `factory: () => []` on an Array, `.select(new ArraySink())`)
- A one-liner for this block? (`tag`, `show`, `enableClass`, `copyFrom`, `IN`)
- A class with this job already exists? Extended, refined, or paralleled?
- Every hunk traces to the ticket? No reformat, rename, or second feature riding along?
- Any `console.log`, `println`, `debugger`, `///`, or commented-out block?

## 2. Behaviour placement
- Could `tag(PROP.__)` plus property config replace this view code?
- A button is a declared `Action`, not a click listener?
- A switch, ordinal chain, or colour table over an enum the value could own?
- Logic in the layer its trigger belongs to? (hook / decorator / rule / service / FSM)
- A subclass detail read by its parent? A feature-specific field on an abstract base?
- A core class extended where a downstream refinement would do?
- A flag the caller maintains that the structure could derive?

## 3. Style
- `if ( x )`, `! x`, two-space indent, sorted imports, no trailing commas, semicolons, single quotes, header year, axiom order, naming table. One grouped line.

## 4. Property axioms
- Hook name matches what the code does? Any `value:` holding an array or object?
- Any factory, expression, or slot function that can return `undefined`?
- Object created in Java while the hook is JS? Any `find().then()` inside a setter?
- A number, date, code, or currency stored as `String`? `Float` for money?
- A computed value persisted where a transient with `factory`/`javaFactory` would do?
- `== null` on an Enum? `isSet_` on a factory-backed property?

## 5. Context and DAO
- `getX()` where an `x` was handed in? A user request touching a DAO without `inX(x)`?
- Inside a decorator: bare `find(`, `put(`, `select(` on the delegate?
- Inside a rule: a write through `x` instead of `ruler.getX()`? A re-put without `ruler.stop()`?
- `XLocator.get()` outside a property hook?
- `ArraySink` then `isEmpty()`/`size()` where `find` or `COUNT()` answers?
- A loop of `EQ`s where `IN` fits? A scan where an index exists? A new cache where EasyDAO has a switch?
- A decorator `cmd_` that throws? `imports: ['ctrl']`?

## 6. Java server
- An allocation (`new`, `Builder`, `substring`, `SimpleDateFormat`, collection copy) on a per-row path?
- A shared collection or counter without synchronization? `notify()`?
- `+` inside a log call? "error" in an error log? A payload at debug?
- A catch that neither logs nor rethrows? A rethrow without the cause?
- A setter on a DAO result without `fclone()`? `setX(null)` without `clearX()`?
- Array-form `args:`? Boxed primitives? `else` after `return`?

## 7. u2 views
- A colour literal? An unscoped CSS class? A root `width`/`height` on a reusable view? `!important`?
- `px` where `rem` fits? `<h3>` where a Fonts class fits?
- `dynamic()` around structure that does not change? `slot()` returning a detached element?
- `sub()` outside `onDetach`? Registered on the data instead of the view?
- A property view rendering its own label or reading `controllerMode`? A shared axiom mutated?
- An optional import without `?` and `?.`?

## 8. Reflow
- A block reading a DAO per row, or filtering after the select?
- `shown` assigned anywhere? A serialized predicate instead of `aql`?
- Derived agent state without `transient: true`?
- A listener without `onDetach`? A block detached without its value?
- Per-flow state on `globalThis`? A DAO shared across blocks?
- A new sink without an `agents.jrl` row? A command without `permissionRequired`? `accessLevel` unset?

## 9. foam3 core
- A new Map, Set, or counter describing objects the class holds?
- A concept understood by more than one class?
- An early return that skips work silently? An interface default that fails open?
- A hand-rolled timer where PM exists? A codegen hook beside one that already receives the value?
- A perf claim without a like-for-like measurement?

## 10. Tests
- Test files under `test/` with `flags: 'test'` on the pom entry?
- An assertion that cannot fail? An `async` test that awaits nothing?
