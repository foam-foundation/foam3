# Style mechanics

The cheapest comments to avoid and the most repeated in the corpus: over 200 spacing, sort, comma,
and header nits in five years. Source: `foam3/doc/guides/StyleGuide.md` plus the review record.

## Formatting

| Rule | Example |
|---|---|
| One space inside `if`/`for`/`while`/`switch` parens | `if ( ! found )`, `for ( var i = 0 ; i < n ; i++ )` |
| Space after `!` | `! obj.isFrozen()` |
| `catch` keeps Java form | `} catch (Throwable t) {` |
| Two-space indent, JS and Java | never four |
| Single-statement bodies under 80 chars need no braces | `if ( x == null ) return;` |
| No `else` after `return` | `if ( a ) return 1; return 2;` |
| Sort `requires`, `imports`, `exports`, `javaImports`, pom entries | alphabetical within group |
| No trailing commas | last property, last array item |
| Semicolons present | every statement |
| Single quotes unless interpolating | `'text'`, `` `${a}` `` only when needed |
| Do not quote map keys unless necessary | `{ display: 'flex' }` |
| Line length 80 unless splitting hurts readability | one char over beats a split |
| Space after `//` | `// comment` |
| Blank line after `package:`/`name:`; no runs of blank lines; final newline | |
| Header with the current year | foam3: Apache `Copyright <year> The FOAM Authors`; app: its own confidential header |
| Vertical alignment where it reveals structure | aligned `=` in declaration blocks, aligned mlang args, aligned pom columns |
| Short property form when only `name` is set | `'data'` not `{ name: 'data' }` |
| Formatting is its own commit | `Formatting.` / `Spacing.`, never mixed with behaviour |

## Axiom order inside `foam.CLASS`

`package`, `name`, blank line, `extends`/`implements`/`mixins`/`refines`, `requires`, `imports`,
`exports`, `javaImports`, `documentation`, `tableColumns`/`searchColumns`, `sections`, `constants`,
`messages`, `css`, `properties`, `methods`, `listeners`, `actions`.

## Naming

| Rule | Example |
|---|---|
| Models CamelCase; acronyms as one letter | `DAOWAO`, `IOSPush`, not `DaoWAO`, `iOSPush` |
| Properties camelCase; constants and messages `UPPER_SNAKE` | `CANCEL_LABEL`, enum values `EDIT`, `VIEW` |
| `_` suffix on non-public members only; never on a public one | `delimiter_` private field; a public JS property has no `_` |
| Service pair is `Server<Name>Service` / `Client<Name>Service` behind one CSpec id | never `<Name>Impl` |
| A `ContextAgent` run by a cron is an `Agent`, not a `Cron` | `UpdateGeoAgent` |
| Refinements end in `Refinement` | `UserRefinement` |
| A mixin is not a `Utils` | `Memorable`; a `FooUtils` mixin name is legacy |
| No `model` package | put the model beside its views |
| Rule ids package-qualified | `foam_core_so_TaskCleanupOnRemovalRule` |
| File named after the model it defines | `Metric.js`, not `scenarios.js` |
| Name the thing, not its one consumer | `amount`, not `displayAmount` |
| Rename toward the domain word; keep a deprecated alias for persisted properties | `activity` → `activityType` with a hidden shim |

## Commit and PR

Subject is imperative, sentence case, one line under 72 characters, and carries the why when the
change is not self-evident. Ticket reference at the end in the repo's convention. The PR body
describes the diff against the target, not the commit history.
