# FOAM Foundations

*A series connecting FOAM's features to the computer science they grow from.*

Most framework documentation tells you **what** to type. This series is about **why the
idea works** — the theory, the history, and the moments in computer science where someone
first ran into the same problem FOAM solves and gave it a name.

FOAM did not invent context, reactivity, data-access objects, or query predicates. It
inherited them from decades of research: from Lisp and Scheme, from the relational model,
from functional programming, from dataflow languages. When you can see the lineage, the
framework stops feeling like a bag of magic incantations to copy-paste and starts feeling
like a *coherent set of well-understood ideas* — ideas you can reason about, predict, and
extend.

That is the goal here: to trade **cargo-culting for comprehension**, and to have some fun
with the computer science along the way.

## Who this is for

Anyone using FOAM who wants to understand the *shape* of what they're using — whether
you're a beginner who wants the mental model to stick, or an experienced developer who
enjoys seeing a familiar feature snap into its theoretical place. No graduate degree
required; we build each idea up from a concrete FOAM example.

Each article is self-contained. Read them in any order, or follow a thread that interests
you.

## The series

| # | Article | FOAM feature | The theory it connects to |
|---|---------|--------------|---------------------------|
| 01 | [Context & Dynamic Scoping](01-context-and-dynamic-scoping.md) | `context` / `X`, `imports`, `exports` | Dynamic scope, the environment model, the Reader monad |

### Planned

Ideas queued for future entries (order and titles may shift):

- **Slots & Reactivity** — `foam.core.Slot`, `this.name$` → dataflow programming, functional
  reactive programming, the spreadsheet as a computational model, self-adjusting computation.
- **DAOs & Sinks** — the `DAO`/`Sink` interfaces → relational algebra, iterators vs. folds
  (catamorphisms), push vs. pull streams, the Visitor pattern.
- **Predicates & mLang** — `AND`, `OR`, `EQ`, query trees → the Interpreter pattern,
  expression trees as data, reified ASTs, and a little Church encoding.
- **Models & `foam.CLASS`** — the modelling layer itself → reflection, metaprogramming, and
  the Meta-Object Protocol (CLOS).
- **Journals** — append-only `.jrl` files → event sourcing, the log as a first-class
  abstraction, and persistent (immutable) data structures.
- **Relationships** — `foam.RELATIONSHIP` → the relational model, foreign keys, and a
  categorical view of how objects compose.

Have a FOAM concept whose theory you'd like to see unpacked? That's exactly the kind of
thing this series exists for — suggest it.

---

*"The purpose of computing is insight, not numbers."* — Richard Hamming
