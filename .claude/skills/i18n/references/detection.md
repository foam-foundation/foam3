# i18n Detection Engine

Shared rules for finding and fixing hardcoded user-facing strings in FOAM views.
Used by both modes of the `i18n` skill: `tree` (whole tree/module) and `diff` (current change).

For HOW messages work (defining, `messageMap`, template `${}`, the expression
reactivity rule), read the mechanism guide `doc/guides/i18n.md`. This file is
only the judging layer: what is a violation, what is exempt, where to look, and how to
fix.

---

## Sites to check

A user-facing string can hide in any of these. Scan all of them, not just `.add()`:

| Site | Example violation |
|------|-------------------|
| `.add(...)` / `.start(...).add(...)` | `.add('Submit')` |
| Action / button `label:` | `label: 'Sign In'` |
| Property `label:` | `label: 'First Name'` |
| Validation `errorString:` | `errorString: 'Reason code is invalid.'` |
| `choices:` arrays | `[4, 'Low']` |
| `tableCellFormatter` / `labelFormatter` | `this.add('Yes')` |
| `notify(...)` calls | `notify('Saved', ...)` |
| Section / tab titles | `title: 'Transaction Lifecycle'` |
| Tooltips / placeholders / help text | `placeholder: 'Search...'` |
| Text built into a *displayed* String prop | `this.output += 'No new files to process.'` where `output` renders in a read-only TextArea/display view |

Note the last row: a string is still user-facing even when it is concatenated into a
property (`+=`) rather than passed straight to `.add()`, **if that property is shown on
screen**. These accumulator strings (progress logs, result summaries) are easy to miss
and are often a view's largest cluster. They are only exempt if the property is never
rendered (pure internal/debug state).

---

## Violation rule

Flag a **string literal** at one of the sites above **when it is user-facing English
prose** — words a person reads in the UI — AND it is not on the exemption list below.

A file with user-facing strings and **no `messages:` block at all** is the strongest
signal: it was authored without i18n in mind. Note it prominently.

## Exemptions — do NOT flag

These are not translatable content. Flagging them makes the review noise:

- CSS class names: `addClass('foo')`, `this.myClass('bar')`
- Single characters and punctuation: `'%'`, `':'`, `'/'`, `'-'`, `','`, `' '`
- Format/separator fragments with no words: `' | '`, `'...'` (alone)
- Enum keys, IDs, model/DAO names, property names, slot names, `buttonStyle`/`mode`
  values (`'PRIMARY'`, `'RW'`, `'INFO'`) — **but only when used AS a key**. The same
  word rendered as on-screen text is a violation, not an exemption. `'Success'` passed
  to `.add()` is user-facing; `'SUCCESS'` passed as a `LogLevel`/style is a key. Decide
  by *use*, not by the word.
- Synthetic data identifiers a fallback generates (`` `File ${i+1}` ``, an auto-name) —
  these are data, not UI prose. BUT a human-readable fallback *phrase* shown to the user
  (`'Unknown'`, `'No file'`, `'N/A'`) IS user-facing prose → flag it.
- URLs, paths, MIME types, regexes, dates/format strings
- `console.*` / logger / debug strings (developer-facing, not shipped UI)
- Strings already inside a `messages:` definition (that IS the i18n)
- HTML tag names and attribute literals (`'span'`, `'div'`, `'href'`)

When unsure whether a string is user-facing: does a non-developer read it on screen?
Yes → flag. No → exempt.

---

## Match patterns (starting grep — then judge each hit against the rules above)

```bash
# user-facing text passed to .add()  (skip single-char / class-like args)
grep -rn "\.add(['\"][A-Z][a-z].*['\"]" --include="*.js" <path>

# hardcoded action/property/section labels and titles
grep -rn "\(label\|title\|placeholder\|errorString\):\s*['\"][A-Z]" --include="*.js" <path>

# notify with a literal first arg
grep -rn "notify(\s*['\"]" --include="*.js" <path>

# files with NO messages block (candidate "authored without i18n")
grep -rL "messages:" --include="*.js" <path>   # combine with the hits above
```

Patterns over-match by design — they are a candidate list. Every hit is judged against
the violation rule + exemptions before it counts.

---

## Locale journal entries (`locales.jrl`) — key validity

When the diff adds/edits `foam.i18n.Locale` entries, judge each `source` key: a key
that nothing looks up is a **silently dead translation** (no error, target never shown).

**Lookup is EXACT string match.** No package resolution, no prefix/wildcard fallback —
server `EQ(Locale.SOURCE, source)` (`src/foam/i18n/LocaleTranslationService.js:52,65`),
client map hit (`ClientCacheTranslationService.js:127`). The key must equal, verbatim,
what a consumer builds. Two consumer mechanisms:

1. **Call-site `getTranslation`/`translate`** — caller concatenates the key.
2. **`installLanguage()` global-path assignment** (`src/foam/core/controller/ApplicationController.js:579-601`) —
   splits the key on `.`, resolves it as an object path from `globalThis`, assigns the
   target there. Class-based keys therefore must be a **resolvable global path**:
   FQN + **CONSTANTIZED** member (class constants are uppercase). Unresolvable paths are
   skipped silently.

| Key shape | Consumed by | Valid example |
|---|---|---|
| `<menuId>.label` | AbstractMenu.js:32 | `fraudReports.label` |
| `<menuId>.browseTitle` / `.createTitle` | comics/v2/DAOBrowseControllerView.js:138,303 | `fraudReports.browseTitle` |
| `<fqn>.MESSAGE_NAME` | installLanguage | `com.x.MyView.TITLE` |
| `<fqn>.<PROP_CONSTANT>.label` (also `.documentation`, `.placeholder`) | installLanguage | `com.x.FraudCase.CASE_NUMBER.label` |
| `foam.time.TimeUnit.<VALUE>.label/.plural/.shorthand`, `<currencyId>.name` | `src/foam/lang/Duration.js:35-37`, `src/foam/lang/Currency.js:142` | `CAD.name` |

**Checks per entry:**
- Menu-shaped key → menu id must exist in a `menus.jrl`; suffix must be one the runtime
  reads (`.label`, `.browseTitle`, `.createTitle`, `.handler.createControllerView.view.title`).
- Class-shaped key → class FQN must exist and member must be the **constantized** name:
  `CASE_NUMBER.label`, never `caseNumber.label`. camelCase property in a key = dead entry.
- `<menuId>.handler.config.browseTitle` is a stale extraction-script shape
  (`src/foam/i18n/scripts.jrl:260-267`) — runtime reads `<menuId>.browseTitle`. Flag it.
- Country-scoped keys (`<countryLower>.<fqn>.<PROP>.error`, literal `*.` fallback) are a
  caller convention (`src/foam/core/auth/Address.js:240-243`), not engine wildcards — the `*` must appear
  verbatim in the source string.

---

## Fix recipes

Beyond the basic Before/After in `i18n.md` (Steps 2–3), these are the cases it omits:

**1. Plain literal → message**
```javascript
// before
.add('Upload Complete')
// after — add to messages:, reference it
messages: [ { name: 'UPLOAD_COMPLETE', message: 'Upload Complete' } ],
.add(this.UPLOAD_COMPLETE)
```

**2. Concatenation → template message** (`${}`, not string `+`)
```javascript
// before
.add('Invoice No: ' + invoice.number)
// after
messages: [ { name: 'INVOICE_NO', message: 'Invoice No: ${num}', template: true } ],
.add(this.INVOICE_NO({ num: invoice.number }))
```

**3. Duplicate string across N files → one shared message**
If the same literal (e.g. `'No file available for preview.'`) appears in multiple
views, define it once on a shared/base model and reference it, rather than copying a
message into each file. Flag duplicates explicitly in audit output.

**4. Naming convention** for new message constants:
- `SCREAMING_SNAKE_CASE`
- prefix by kind: `ERROR_*`, `HELP_*`, `MSG_*`, or a noun matching the string
- name describes meaning, not the English words (`UPLOAD_COMPLETE`, not `GREEN_TEXT`)

---

## Verification after a fix

Per `verification-before-completion`: never claim a port is done without checking the
view still renders the same text.

- No remaining literal at the fixed site (re-run the grep on that file → 0 hits).
- Every `${}` placeholder in a new template message is supplied (Way 1) or exists as a
  property (Way 2). A missing key renders blank.
- For Way 2 used inside an `expression`, every property the message reads is in the
  expression's argument list (see the reactivity callout in `i18n.md`).
- Build/lint the changed file so the new `messages:` axiom loads.
