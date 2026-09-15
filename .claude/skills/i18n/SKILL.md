---
name: i18n
description: Audit or fix translatable text in FOAM code - hardcoded user-facing strings in a view that bypass messages:, a message with no translation for a shipped locale (locales.jrl row preferred; inline messageMap only for the minimal client-side set), or a locales.jrl source key that never resolves. Use only when asked to REVIEW, AUDIT, FIND, PORT, or FIX such strings or keys, in a diff ("review this branch for hardcoded strings", "i18n pass on this MR") or a tree ("audit this package for untranslated text", "port this view to messages", "add the French", "check these locale keys"). review-mr invokes it in diff mode when a changed file is a FOAM view or edits a locales.jrl. NOT for explaining how FOAM i18n works (read doc/guides/i18n.md), not for the translation service, LSP, or units-i18n code itself, and not for a branch or PR whose name merely contains i18n.
---

# i18n

## Overview

Finds hardcoded user-facing strings in FOAM views and, on request, moves them into
`messages:`. Also checks `foam.i18n.Locale` rows in a `locales.jrl` for source keys that
nothing looks up. One engine, two scopes.

**Read the detection rules first. They are the engine; do not re-derive them:**
`references/detection.md` (sites, exemptions, grep patterns, locale-key shapes, fix
recipes, verification).

For how `messages:`, `messageMap`, `${}` templates, and inline `label: { en, fr }` maps
work, read `doc/guides/i18n.md`. Neither file is restated here.

## Pick a mode

| Mode | When | Scope |
|---|---|---|
| `diff` | A branch, MR, or working-tree change is in play. Default during a code review. | Added or modified lines only. |
| `tree` | The user names a view, package, or tree to audit, port, or internationalize. | Every file under the path. |

Within `tree`, "audit", "find", "check" mean report only; "port", "fix", "migrate",
"internationalize" mean report, then apply the recipes. Within `diff`, fix only when
asked, and only lines inside the change.

## The rule: translations go in `locales.jrl` first, inline only for the minimal set

Every user-facing string needs a translation for each locale the application ships beyond its base language. Where that translation lives is the decision this skill
enforces, in this order:

1. **`locales.jrl` row (preferred).** `p({ class: "foam.i18n.Locale", locale: "fr", source: "<fqn>.<NAME>", target: "..." })`. The translation service fetches only the viewer's locale, so the client bundle carries no French at all. The `source` for a `messages:` entry is `<class id>.<MESSAGE_NAME>` (`src/foam/i18n/Messages.js:100`); `installLanguage` writes it into the axiom's `messageMap` at runtime (`Messages.js:129-132`).
2. **`messageMap: { en, fr }` on the axiom** — only for text that must exist client-side before any round trip (a boot-time label, an error the login page shows). Every inline language ships in the client JS for every user, and the shape does not scale past a couple of languages.
3. **Inline `label: { en, fr }` on a property or action** — same cost as 2; `String.adapt` picks the viewer's locale from the object (`src/foam/lang/types.js:47-62`). Same "minimal set" test applies.

So the entry itself stays English:

```javascript
messages: [
  { name: 'CLIENT', message: 'Client' },
  { name: 'TOOLTIP', message: 'Isolated to ${programName}.', template: true }
]
```

and each shipped locale is a journal row beside the class (French shown):

```
p({ class: "foam.i18n.Locale", locale: "fr", source: "com.example.MyView.CLIENT",  target: "Client" })
p({ class: "foam.i18n.Locale", locale: "fr", source: "com.example.MyView.TOOLTIP", target: "Isolées au programme ${programName}." })
```

Never write `fr:` beside `message:` — `MessageAxiom` has `name`, `messageMap`, `message`, and
`template` and no `fr` property (`Messages.js:71-119`), and an unknown constructor key is dropped
without a warning after boot (`src/foam/lang/EndBoot.js:183-185`). Never put `message:` on an
entry that has `messageMap`; the `message` setter writes only the current locale into the map
(`Messages.js:106-109`), so the outcome depends on declaration order (`doc/guides/i18n.md:56`).

**What counts as a finding:**

- A new or changed user-facing string with no translation for a shipped locale: no `locales.jrl`
  row for its `source` in that locale, and no inline map. `file:line | message name | missing <locale>`.
- A new inline `messageMap` or `{ en, fr }` map with no reason it must be client-side:
  `file:line | message name | inline <locale> — should this be a Locale row?` Not a blocker; a question.

Check for a row with `grep -rn "source: \"<fqn>.<NAME>\"" --include=locales.jrl` before
reporting either. A row for a different locale, or a `source` that differs by one character, is
the same as no row — lookup is exact.

## `diff` mode

1. Get the change: `git diff <base>...HEAD`, or the staged and working-tree changes, or
   the MR diff under review.
2. For each added or modified view line, judge the string against `detection.md`.
3. For each `messages:` entry the change adds or edits, check a `locales.jrl` row exists for its `source` in each shipped locale (or, if the entry carries an inline map, ask whether it needs to).
4. If the change touches a `locales.jrl`, judge every added or changed `source` key
   against the "Locale journal entries" section of `detection.md`. Lookup is an exact
   string match, so a key of the wrong shape is a dead translation that raises no error.
5. Report. Violations as `file:line | literal | site` with the suggested message name;
   missing translations as `file:line | message name | missing <locale>`; dead locale keys as
   `file:line | source-key | why it never resolves`.
6. If a changed file holds pre-existing hardcoded strings outside the change, add ONE
   line: "this file has N more hardcoded strings outside your change; run `i18n` in
   `tree` mode on it separately." Then stop. Do not fix them here.
7. If asked to fix: apply the recipes to the in-scope lines only, add a `locales.jrl` row per shipped
   locale for each new entry, then run the verification checklist from `detection.md`.

Fixing the whole file balloons the MR. Note the rest; do not port it.

## `tree` mode

1. Pick the scope (file, package dir, or whole tree). Confirm with the user if unstated.
2. Run the candidate greps from `detection.md` over that scope. Then find messages with no
   translation for a shipped locale (French shown). The preferred shape is `message: '...'` plus a `locales.jrl` row, so the
   gap is a `message:`-only entry whose `<fqn>.<NAME>` has no row for that locale:

   ```bash
   # every fr source key the journals already carry
   grep -rho 'locale: "fr", source: "[^"]*"' --include=locales.jrl <path> | sed 's/.*source: "//; s/"$//' | sort -u > /tmp/fr-sources

   # message:-only entries (no messageMap on the same axiom) -> "<fqn>.<NAME>"
   # build the key from the file's package+name and the entry's name, then:
   comm -23 <(sort -u /tmp/message-keys) /tmp/fr-sources        # keys with no fr row = findings

   # inline messageMap blocks missing fr (the fallback shape, still must be complete)
   awk '
   FNR == 1 { inb = 0 }
   /messageMap: *\{/ {
     start = FNR; hasfr = ($0 ~ /fr:/)
     if ( $0 ~ /\}/ ) { if ( ! hasfr ) print FILENAME ":" start; next }
     inb = 1; next
   }
   inb && /fr:/ { hasfr = 1 }
   inb && /^[ \t]*\}/ { if ( ! hasfr ) print FILENAME ":" start; inb = 0 }
   ' $(grep -rl "messageMap: {" --include="*.js" <path>)
   ```

   Every inline `messageMap` that *does* carry `fr` is still worth one question in the report:
   does this text need to be client-side before a round trip, or should it be a row?

3. Judge every hit against the violation rule and the exemption list. Discard exempt hits.
4. Produce a ranked report: worst files first (most violations, no `messages:` block).
   Always list cross-file duplicate strings; they become one shared message.
5. Fix mode only: apply the recipes, add a `locales.jrl` row per shipped locale per new message, then run
   the verification checklist per file. Do not claim a port is done without it.

### Report format (`tree`)

Per file: path, whether it has a `messages:` block, then a table of
`line | literal | site`, followed by the entries missing a locale as
`line | message name | missing <locale>`. End with a duplicates section (string, then the
files) and a one-line total. If you cap coverage (top-N files, sampled), say so; a
truncated sweep must never read as "all clean".

## Common mistakes

- Reviewing the whole file when the user gave you a branch (that is `tree`, not `diff`).
- Porting the entire file in `diff` mode because you noticed other violations. Note
  them, do not fix them.
- Flagging exempt strings: CSS classes (`addClass` / `myClass`), HTML tags, enum and
  style keys, `console.*`, `documentation:`. Re-check `references/detection.md`.
- Missing the `+=`-into-a-displayed-property cluster (progress and result text). That
  cluster is usually a view's largest source of violations.
- Fixing with string `+` concatenation instead of a `${}` template message.
- Copying the same new message into N files instead of one shared definition.
- Adding a message with no `locales.jrl` row for a shipped locale, or with `fr:` next to `message:` (a key
  the axiom never reads).
- Reaching for `messageMap: { en, fr }` by default. It is the fallback for text that must be
  client-side before a round trip, not the norm; every inline language ships to every user.
- Writing a locale key with a camelCase property (`caseNumber.label`); the runtime reads
  the constantized name (`CASE_NUMBER.label`).
