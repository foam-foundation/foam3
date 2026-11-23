---
name: foam-refinement-ordering
description: Use when a FOAM refinement that sets a property `value`/default does not take effect, when the server (Java) and client (JS) disagree on a default, or when ordering refinements or pom entries so one override beats another. Covers why refinements on a class that is not built yet are first-wins while refinements on a built class are last-wins, and pom load order (projects/files/postProjects).
---

# FOAM refinement ordering

When two refinements set the **same property's `value`** (or default), which one wins depends on their **load order** and on **whether the class was already built** when they loaded. The two cases resolve in **OPPOSITE directions**, so the server (Java) and the client (JS) can end up with opposite defaults. This bites hardest on a property like a status/enum default that a library sets one way and your app refines the other way.

> This documents current foam3 behaviour. Waiting refinements running
> newest-first is arguably a defect. Until it is fixed, order refinements by the
> rule below.

## The rule

A class is *built* the first time something looks it up (`foam.lookup`, or a subclass being built, `foam3/src/foam/lang/Boot.js:138-140`). Until then FOAM only holds its model.

- **Class already built: last-wins.** A refinement that loads after the class is built applies at once, so refinements apply in load order and the last one's `value` wins.
- **Class not built yet: first-wins.** A refinement that loads before the class is built waits for it, and the waiting ones run **newest-first** when the class is finally built, so the **first**-loaded one is applied last and wins. `foam.CLASS` queues them with `foam.pubsub.sub` (`foam3/src/foam/lang/EndBoot.js:318-330`), and `sub` puts each new listener at the head of the list (`foam3/src/foam/lang/FObject.js:711-727`).

Java generation loads every file before it looks any class up (`foam3/tools/JavaMaker.js:41-56`), so in the Java build nearly every refinement waits and the **first** one wins. The JS bundle runs the same `foam.CLASS` in the browser, so it gives the opposite answer only when something builds the class before the refinements load. **The server's runtime value is the Java one** — read it from the generated getter in `build/src/java/<pkg>/<Model>.java`.

## Pom load order

Within one pom, FOAM loads sections in this order (`foam3/src/foam.js:298-300`, used by both the runtime and the pmake build), each recursing depth-first:

1. `projects`
2. `files`
3. `postProjects`

When nothing builds the class before both refinements load (the usual case in the Java build), **your** refinement must load **before** the one it overrides:

- Put your refinement in `files` and the library it overrides in `postProjects` of the **same pom** — `files` load before `postProjects`, so yours applies first and wins. **Or**
- List it earlier in a `projects` list, or earlier in a `-J` journal sequence.

(If something builds the class between the two loads, the order flips and the later one wins.)

## Worked example

foam3 `Health.status` defaults to `UP`; a library refinement `LibHealthRefines` sets it to `DOWN`; your app refinement `AppHealthRefines` sets it back to `UP`. To boot the server **UP**, `AppHealthRefines` must load **before** `LibHealthRefines`:

```js
// app-server/pom.js
projects:     [ { name: '../app-common/pom' } ],   // does not include the library
files:        [ { name: '../app-up/AppHealthRefines', flags: 'js|java' } ], // UP, loads first
postProjects: [ { name: '../../lib/pom' } ]                                  // brings LibHealthRefines (DOWN)
```

Loading `AppHealthRefines` **after** the library (a separate pom pulled later, or a `-J` entry placed after the library's) made the server boot **DOWN** while the JS build showed UP.

## Gotchas

- **Don't diagnose from the JS bundle.** `build/js/foam-bin*.js` can show the *opposite* of the server's Java default. Read `build/src/java/<pkg>/<Model>.java`.
- **A duplicate library reference can re-apply its refinement.** Referencing the same library sub-pom from two places is deduped in the JS build but can re-apply in the Java pass, re-asserting the library's value after yours.
- **A reorder needs no clean build.** Java generation regenerates every model on each build and rewrites a `.java` whose text changed (`foam3/src/foam/java/refinements.js:2753-2766`), so a pom-only reorder shows up on a plain build.

## Diagnosing a wrong default

1. `grep -n "return .*\.<VALUE>" build/src/java/<pkg>/<Model>.java` — read the compiled getter default.
2. If it's the library's value, your override is loading on the wrong side: move it **earlier** (the Java build is first-wins).
3. Rebuild, re-grep the getter, and confirm at runtime.
