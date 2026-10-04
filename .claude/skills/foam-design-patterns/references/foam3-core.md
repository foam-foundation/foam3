# foam3 core

Changing a core class, an index, a DAO primitive, or codegen. Every principle here came from a
foam3 PR being sent back.

| Principle | One-line test |
|---|---|
| Ask the object; never keep a registry about it | any new Map, Set, or counter describing objects the class holds? |
| Push it down until nobody outside needs to know | how many classes changed to learn the concept? |
| Log when you skip work | any early `return` that declines the request silently? |
| Interface defaults fail toward the status quo | what happens if the default answer is wrong? |
| Measure the case that happens | does the benchmark time what a user waits for? |

### Ask the object; never keep a registry about it
Bookkeeping in a consumer goes stale; the structure already knows.
Don't: `Set<String>` of index signatures in `MDAO.addIndex`
Do:    `covers(Index)` on `Index`, implemented by `TreeIndex`, aggregated by `AltIndex`
Review asked: "better to use the index itself to have a method to know if it's redundant, that will be way cleaner." (PR #5339)

### Push it down until nobody outside needs to know
The lowest point every caller already passes through enforces the rule once, with no coordination.
Don't: the coverage check in `MDAO.addIndex`
Do:    the check in `AltIndex.addIndex`; `MDAO` stays byte-identical to upstream
Review asked: "would this be simpler if this code were moved into AltIndex? Then nobody outside of AltIndex would need to know?" (PR #5339)

### Recurse over self-similar structures
Index chains, node trees, nested predicates, and context chains are shallow; recursion restores polymorphism and drops the casts.
Don't: `while ( true ) { mine = (TreeIndex) mine.tail_; theirs = (TreeIndex) theirs.tail_; }`
Do:    `return tail_.covers(theirs.tail_);`

### Log when you skip work
A silent no-op is indistinguishable from a request that never happened, and surfaces later as a performance mystery.
Don't: `if ( covers(i) ) return state;`
Do:    `if ( covers(i) ) { Logger l = ...; if ( l != null ) l.info("Index already covered, not added", i); return state; }` with a null-checked context and logger

### Interface defaults fail toward the status quo
A wrong `false` costs a redundant index; a wrong `true` silently loses one, and there is no `removeIndex`.
Don't: `default boolean covers(Index i) { return true; }`
Do:    `return false;` with the asymmetry stated in the javadoc

### Use the framework's instrument; check it is not already there
`PMDAO` already records count and total per DAO operation; a hand-rolled timer disagrees with it.
Don't: `System.nanoTime()` accumulators around a seed loop
Do:    read `PMInfo`; remember PM counters accumulate from server start

### Extend codegen at the seam that already receives what you need
A hook next to a hook that already works is the version that gets rejected; a whole-method override takes ownership of scaffolding it did not mean to.
Don't: a new `javaToJSON` sibling when `javaFormatJSON` already has the object; `javaGetter` to change one field read; `%FIELD%` placeholder templates; `cls` threaded into a hook body to read a backing field
Do:    the existing hook; `javaInnerGetter`/`javaInnerSetter`; a `factory:` using `this.name`; a generated accessor on the class the other accessors live on

### Generate once in `java/refinements.js`, never per model
A core model says what an axiom is; everything that emits Java lives in the java refinement layer, so a JS-only build never loads it.
Don't: `buildJavaClass()` inside `src/foam/core/StubMethod.js`
Do:    the same method in `src/foam/java/refinements.js`; a generated hook for every model instead of asking each to add it

### Predicate simplification is where silent wrong answers live
`partialEval` that reduces with the wrong operator returns confident wrong rows.
Don't: `And.partialEval` calling `reduceOr`
Do:    each rule written as two English sentences in a comment, comparing the whole `arg1`/`arg2` pair

### Measure the case that happens
A benchmark that times the wrong thing produces a commit message the reviewer stops trusting.
Don't: a browser structure vs a 244-row server DAO; reading a million rows when the UI pages; crediting the newer of two commits
Do:    like for like at equal size; time one page; trust the profile over the guess; check the call site inlines before treating an allocation as a cost; one build per commit before attributing; say "structural" when it is structural
