<flow name="FOAMMinusMinus" category="DOC/GUIDE" spid="foam"/>
# FOAM-- (Minus Minus)

A living inventory of FOAM3 slimming opportunities: deprecated classes, replaced subsystems, dead shims, and long-horizon removals. Organized by readiness so engineering effort can be triaged.

---

## Tier 1 — Remove Now

Replacement exists and is stable. These can be deleted as soon as all callers in downstream apps are migrated.

### Whole Subsystems

| What | Replacement | Notes |
|------|-------------|-------|
| **MQL** (FOAM query language) | **AQL** | AQL is the current query language. MQL parser and related classes are dead code. |
| **CRUNCH** (capability/permission framework) | — | Remove entirely; the Modules system supersedes it. |
| **`foam.apploader.ClassLoader`** and related classes | — | Source already has a `// TODO: Remove foam.classloader classes` comment. |
| **Comics v1, v2** (`foam.comics`, `foam.comics2`) | **Comics v3** (`foam.comics.v3`) | v3 DAOBrowser/DAOController is the current path. |
| **Old `SearchManager`(s)** (`foam.u2.search.*`) | **`foam.u2.filter.FilterController`** | `ReciprocalSearch` and `SimpleSearch` still reference the old managers. |
| **JSON2** | Standard JSON / FObjectParser | No active users; old serialization format. |
| **FON** (`foam/parsers/FON.js`) | — | FOAM Object Notation parser; superseded. |
| **Reflow Standard & Advanced Prompts** | Auto Prompt | Auto replaces both prompt modes; Standard and Advanced can be removed. |

### Individual Classes

| Class | Replacement |
|-------|-------------|
| `foam.u2.ViewFactory` | `ViewSpec` — warns on construction |
| `foam.u2.view.DualView` | `foam.u2.MultiView` — comment in source says "deprecated: Use foam.u2.MultiView instead" |
| `foam.u2.view.ReciprocalSearch` | `foam.u2.filter.FilterView` |
| `foam.u2.view.SimpleSearch` | `foam.u2.filter.FilterView` |
| `foam.u2.TableView` (shim only) | `foam.u2.table.TableView` — shim logs deprecation warning |
| `foam.util.Emails.EmailsUtility` (Java) | `emailMessageDAO` directly — `@Deprecated` on the class |
| **Old `DetailView`** | Sections-based `AbstractSectionedDetailView` |
| **Old `TableView`** | `foam.u2.table.TableView` |
| **Old `TableCellFormatter`** | Current formatter in `foam.u2.table` |
| **`DAOMenu`** | `DAOMenu2` |
| **`ScriptMenu`** | Not used. |

### Deprecated Properties and Methods (Shims)

These are backward-compat shims on otherwise current models. Safe to remove once downstream callers are updated.

| Model | Member | Replacement |
|-------|--------|-------------|
| `foam.core.auth.User` | `enabled` property | `lifecycleState` |
| `foam.core.crunch.Capability` | `enabled` property | `lifecycleState` |
| `foam.core.alarming.AlarmConfig` | `alertGroup`, `alertUser`, `sendEmail` properties | Notification system |
| `foam.core.cron.CronSchedule` | `hour`, `month`, `dayOfWeek`, `dayOfMonth` | `hours`, `monthsOfYear`, `daysOfWeek`, `daysOfMonth` |
| `foam.dao.EasyDAO` | `approvableAwareEnabled` property | `approvableAware` |
| `foam.dao.ArraySink` | `.a` property | `.array` |
| `foam.core.dig.DIG` | `cSpecName` property | `daoKey` (setter already redirects) |
| `foam.u2.view.MultiChoiceView` | `columns` property | `numberColumns` |
| `foam.lang.Slot` | `link()` method | `linkFrom()` — warns on call |
| `foam.graphics.CView` | `removeChild()` method | `remove()` |
| `foam.graphics.CView` | `addChildren()` method | `add()` |

### Deprecated Wizard/Flow Properties (`deprecated: true` in model)

| Model | Property |
|-------|----------|
| `StepWizardConfig` | `wizardView` |
| `ConfigureFlowAgent` | `pushView`, `popView` |
| `WizardController` | `submitted` |

### Housekeeping

- **Tilde backup files** (`.js~`, `.java~`): Editor backup files found committed to the source tree — not code, but repo noise.

---

## Tier 2 — Replace When Ready

Replacement is planned but not yet complete or not yet ported to foam3.

| What | Replacement | Blocker |
|------|-------------|---------|
| **`UserAndGroupAuthService`** | Modules system | Modules must be ported to foam3 first |
| **FScript** | AScript | AScript must reach feature parity with FScript first |
| **DIG** | `MCPWebAgent` + `DownloadWebAgent` | Replacements must cover all DIG use cases first |

---

## Tier 3 — Long-horizon

Aspirational. Replacement direction is known but the successor isn't ready.

| What | Replacement | Notes |
|------|-------------|-------|
| **`ApplicationController`** | ZAC | ZAC is not production-ready; no timeline |

---

## How to Use This Doc

1. **Pick a Tier 1 item.** Grep for usages in all downstream apps. If the class or property has no live callers, delete it. If it has callers, migrate them first.
2. **Don't remove shims in place** — removing a shim is only safe after all callsites are migrated. The shim's deprecation warning is your callsite finder.
3. **Tier 2 items unblock when their prerequisite lands.** Watch for the Modules port to foam3 before touching `UserAndGroupAuthService`.
4. **Tier 3 items are not actionable yet.** Don't refactor code toward a successor that doesn't exist.
5. **When something is fully removed, delete it from this list** — a stale entry is worse than no entry.
