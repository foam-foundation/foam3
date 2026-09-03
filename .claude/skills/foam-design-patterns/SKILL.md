---
name: foam-design-patterns
description: Use when about to write or change any FOAM code, in foam3 or an app built on it - a model, property, view, DAO, decorator, rule, service, or Reflow block. Also use when a PR comes back with "why not just", "not needed", "already the default", "should be on the model", or when reviewing a FOAM diff for design rather than defects.
---

# FOAM design patterns

What maintainer review asks for, from thousands of review comments. Each principle: heading, why, `Don't`, `Do`.

## The spine

### Declare what things are, not what to do when things happen
Code is a liability; the declaration is the asset the framework regenerates behaviour from.
Don't: an event handler that styles a node, validates a field, or copies a value
Do:    a slot bound at declaration, a `validateObj`, an `expression:`

### Ask the object; never keep a registry about it
Bookkeeping in a consumer describes state the owning structure already knows, and goes stale.
Don't: `Set<String>` of index signatures in the DAO
Do:    `covers(Index)` on `Index`

### More implementations behind fewer interfaces
A new `DAO`, `Sink`, `View`, `Predicate` or `Agent` composes with everything; a new interface with nothing.
Don't: a WebAgent per model, a new Button class, a second TimeUnit enum
Do:    DIG, `foam.lang.Action`, refine the enum that exists

### Delete the second statement of anything already stated
A restated default or a duplicated fact is a line review will ask you to remove.
Don't: `implements: ['foam.mlang.Expressions']` on a View, `value: false` on a Boolean
Do:    nothing; the framework already says it

## Ten questions before writing

1. Already the default? (`start()`, `addClass()`, `after`, `&test`, `value:`)
2. A one-liner already does it? (`tag`, `show`, `enableClass`, `copyFrom`, `IN`)
3. A class already does it? Extend or refine; never parallel.
4. Model or view? Property config, action, enum value first.
5. Which axiom: `value`, `factory`, `expression`, `adapt`, `postSet`?
6. Whose context: the caller's `x`, the ruler's, the object's?
7. How many classes learn the new concept? Push down until one.
8. Only the change in the diff?
9. Anything left from debugging?
10. Style matches the guide, character for character?

## Read before writing, by task

The mechanics live in `references/`. Open every file on your task's row before writing a line.

| Task | Read |
|---|---|
| a view, or CSS | `defaults-and-reuse.md`, `u2-views.md`, `where-behaviour-lives.md` |
| a model or property | `defaults-and-reuse.md`, `property-axioms.md` |
| a DAO, decorator, rule, service, or `javaCode` | `context-and-dao.md`, `where-behaviour-lives.md`, `java-server.md` |
| a flow, block, command, or agent | `reflow.md`, `defaults-and-reuse.md` |
| a foam3 core class, index, or codegen | `foam3-core.md` |
| any PR | `style-mechanics.md` |
| a review | `review-checklist.md` |

First step on every row: grep for the thing you are about to add. A class by name under `src/`, a
command id in `cmds.jrl`, an agent in `agents.jrl`, a property on the base class.

## Reviewing a diff

Walk `review-checklist.md` top to bottom. One finding per line:
`<path:line> — <principle heading> — <do line>`. Cite the reference file, never a person.
A review workflow runs this as its design and simplicity passes; an application may layer its own patterns on top.
