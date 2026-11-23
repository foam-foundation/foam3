---
name: foam-refinement-ordering
description: Use when a FOAM refinement that sets a property `value`/default does not take effect, when the server (Java) and client (JS) disagree on a default, or when ordering refinements or pom entries so one override beats another. Covers the genJava first-wins vs genJS last-wins discrepancy, pom load order (projects/files/postProjects), and why a pom-only change needs a `-c` rebuild to show up.
---

# FOAM refinement ordering (genJava vs genJS)

When two refinements set the **same property's `value`** (or default), which one wins depends on their **load order** — and **Java and JavaScript resolve it in OPPOSITE directions.** This bites hardest on a property like a status/enum default that a library sets one way and your app refines the other way.

> This documents current foam3 behaviour. The two generators *should* agree; the
> divergence is a known defect. Until it is fixed, order refinements by the rule
> below.

## The rule

- **genJS: last-wins.** The last-loaded refinement's `value` wins.
- **genJava: first-wins.** The **first**-loaded refinement's `value` wins; later refinements setting the same `value` are ignored.

So the same model + pom can give a property one default on the client (JS) and the opposite on the server (Java). **The server's runtime value is the Java one** — read it from the generated getter in `build/src/java/<pkg>/<Model>.java`.

## Pom load order

Within one pom, FOAM loads sections in this order (`foam3/src/foam.js:298-300`, used by both the runtime and the pmake build), each recursing depth-first:

1. `projects`
2. `files`
3. `postProjects`

To make **your** refinement win in **Java**, it must load **before** the one it overrides:

- Put your refinement in `files` and the library it overrides in `postProjects` of the **same pom** — `files` load before `postProjects`, so yours applies first and wins. **Or**
- List it earlier in a `projects` list, or earlier in a `-J` journal sequence.

(For JS you would need the opposite order, but the server/Java outcome is usually the one that matters.)

## Worked example (PULSE)

foam3 `Health.status` default `UP`; foam-saf `HealthRefines` → `DOWN`; ptv3 `PulseHealthRefines` → `UP`. To boot the server **UP**, `PulseHealthRefines` must load **before** `HealthRefines`:

```js
// pulse-server/pom.js
projects:     [ { name: '../pulse-common/pom' } ],   // no saf here
files:        [ { name: '../pulse-up/PulseHealthRefines', flags: 'js|java' } ], // UP, loads first
postProjects: [ { name: '../../foam-saf/deployment/saf/pom' } ]                  // brings HealthRefines (DOWN)
```

Loading `PulseHealthRefines` **after** saf (a separate pom pulled later, or `-Jpulse-up` placed after `-Jpulse-client`) made the server boot **DOWN** while the JS build showed UP.

## Gotchas

- **A pom-only change does not retrigger genJava.** The incremental build keys off model-file mtimes, so reordering poms alone leaves `X.java` stale. Rebuild with **`-c`** to force Java regeneration, then re-check.
- **Don't diagnose from the JS bundle.** `build/js/foam-bin*.js` reflects genJS (last-wins) and can show the *opposite* of the server's Java default. Read `build/src/java/<pkg>/<Model>.java`.
- **A duplicate library reference can re-apply its refinement.** Referencing the same sub-pom (e.g. saf) from two places is deduped in the JS build but can re-apply in the Java pass, re-asserting the library's value after yours.

## Diagnosing a wrong default

1. `grep -n "return .*\.<VALUE>" build/src/java/<pkg>/<Model>.java` — read the compiled getter default.
2. If it's the library's value, your override is loading on the wrong side: move it **earlier** (Java is first-wins).
3. Rebuild `-c`, re-grep the getter, and confirm at runtime.
