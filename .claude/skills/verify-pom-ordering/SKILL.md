---
name: verify-pom-ordering
description: Verify effective journal/service load order and trace where a config came from, using the generated build/journal/*.0 files (services.0 for CSpecs). Use when checking POM or -J load ordering, asking why a services.jrl override did or did not win, which services.jrl / deployment a CSpec came from, or the effective value of a property on a DAO for a given build (e.g. "is saf true on this DAO here?", "did my override take effect?", "where does this service get defined?"). Triggers: "pom ordering", "load order", "which override wins", "did my override take effect", "where did this config/service come from", "effective value of X on DAO Y", "services.0".
metadata:
  related: [foam-feature-wiring]
---

# Verify load order and config source via build/journal/*.0

`build/journal/*.0` files are regenerated on every build. Each is the **merged,
in-load-order** list of journal entries that actually run — the single source of
truth for "what is effective in this build" and "where did it come from". For
services/CSpecs that file is **`build/journal/services.0`**.

Two facts do all the work:

1. **Last entry wins (by id/name).** Entries appear in **load order**; for a given
   CSpec `name` (or any journal row's id), the **last** occurrence is the effective
   one. A base `services.jrl` can be overridden by a later-loaded one, and only the
   `.0` file shows the winner.
2. **`copied from <path>` traces the source.** Immediately **above** each merged
   block is a `// copied from <path>` comment naming the `services.jrl` (or other
   journal) the block originated in. Traverse **up** from the winning entry to find
   which file / deployment defined it.

**Load order = POM + `-J`.** The order entries appear in `*.0` is exactly the order
the POM `projects:` and the run's `-J<dir>` flags caused their journals to load. So
`services.0` *is* the verification of POM/`-J` ordering: a journal that loads later
sits later in the file and overrides earlier ones. To test an ordering hypothesis
("does my override load after the base?"), build and read the positions.

## Recipes

Effective config / does an override win:
```bash
# every definition of the service, in load order — the LAST block wins
grep -n '"name":"<serviceName>"\|"name": "<serviceName>"' build/journal/services.0
# then read the winning (last) block and the "copied from" line just above it
```

Where a service came from (trace the winner's source):
```bash
# each occurrence with the nearest preceding "copied from" line
grep -nB12 '"name":"<serviceName>"' build/journal/services.0 | grep -E "copied from|\"name\""
```

Effective value of a property (e.g. is `saf` on, what is `lazy`, which `journalName`?):
read the **last** block for that name in `services.0` and check the property there —
do **not** grep scattered `services.jrl` files and guess the override order.

Any other merged journal works the same way: `build/journal/rules.0`,
`build/journal/<dao>.0`, etc. — in-load-order, last-wins by id, `copied from` above
each block.

## Caveats

- **`*.0` is generated — rebuild to see current state.** A POM-only or `-J`-only
  change is not reflected until the next build; a clean generate (`-c`) rebuilds it.
- **This is journal LAST-wins (runtime config override), a different mechanism from
  genJava value-refinement FIRST-wins** (a compile-time mechanism for refinement
  property values). Don't conflate them.
- A partitioned / directory-backed journal may keep its data under
  `build/journal/<name>_/` rather than a single `.0` file; its CSpec still appears
  in `services.0`.
- Authoring the wiring that this verifies (the CSpec contract, DAO-name/`lazy`
  defaults, the POM sub-directory skip rule, test registration) is `foam-feature-wiring`.
