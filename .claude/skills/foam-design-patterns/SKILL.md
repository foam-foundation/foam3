---
name: foam-design-patterns
description: Use when about to write or change any FOAM code, in foam3 or an app built on it - a model, property, view, DAO, decorator, rule, service, or Reflow block. Also use when a PR comes back with "why not just", "not needed", "already the default", "should be on the model", or when reviewing a FOAM diff for design rather than defects.
---

# FOAM design patterns

What maintainer review asks for, from thousands of review comments. Each principle: heading, why, `Don't`, `Do`.

## The spine

Five principles sit under almost every maintainer comment. Each has the question a review asks of every hunk, and, where one exists, a case seen in review: a reviewer who knows these five finds most findings before the checklist.

### Declare what things are, not what to do when things happen
Code is a liability; the declaration is the asset the framework regenerates behaviour from.
Review asks: is this handler, listener or loop doing what a property, slot or expression would declare?
Don't: an event handler that styles a node, validates a field, or copies a value
Do:    a slot bound at declaration, a `validateObj`, an `expression:`

### Ask the object; never keep a registry about it
Bookkeeping in a consumer describes state the owning structure already knows, and goes stale.
Review asks: is this field, map or check a copy of something another object already knows?
Don't: `Set<String>` of index signatures in the DAO
Do:    `covers(Index)` on `Index`
Seen:  a tag checking `crumb.parentNode === this.titlePrefix` before removing its crumb (the import was gone by then) became: the slot holds one crumb, so whoever fills it calls `removeAllChildren()` first

### More implementations behind fewer interfaces
A new `DAO`, `Sink`, `View`, `Predicate` or `Agent` composes with everything; a new interface with nothing.
Review asks: does a class, tag or mechanism that already exists do this, so the change is one more implementation of it?
Don't: a WebAgent per model, a new Button class, a second TimeUnit enum
Do:    DIG, `foam.lang.Action`, refine the enum that exists
Seen:  a proposed side-panel manager plus a `<side>` tag for one breadcrumb was dropped for the Console header's existing title row, given one empty view

### Extend without breaking: the host gives out slots, the feature plugs in
A shared class (a model every flow uses, a controller, a base view, a container) serves callers that never use your feature. Teach it the feature and every one of them carries it, and the next feature edits it again. Give the host a generic extension point instead and keep the feature in its own class: existing callers see no change, and the next feature needs no edit to the host.
Review asks: would this line in a shared class make sense to a caller that never uses the feature?
Don't: a feature's lookup or keyword constant on `Flow`; a controller importing one feature's view; a container's CSS naming one child's class
Do:    an exported empty view the feature fills, a hook method, a property or attribute whose default is today's behaviour; the feature's own CSS styles the box around it
Seen:  `Flow.findDocumentPlace()` moved onto the tag that shows it; the Console's import of a breadcrumb view became an exported empty `titlePrefix` the tag fills; `Block.js` naming the TOC's class became `.foam-core-reflow-Block-content:has(<<side)` in `TOC.js`; the tag's keyword and menu became attributes defaulting to today's values

### Delete the second statement of anything already stated
A restated default or a duplicated fact is a line review will ask you to remove.
Review asks: does the framework, a parent class or a helper already say this?
Don't: `implements: ['foam.mlang.Expressions']` on a View, `value: false` on a Boolean
Do:    nothing; the framework already says it
Seen:  `ThenBy.create({ head: A, tail: B })` became `this.THEN_BY(A, B)`, inherited through `Expressions`; `imports: ['document']` on an Element dropped, since `Node` imports it

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

## After it works, rethink it

The design that first worked is a draft. Before review, ask of every changed file: would you write it this way from scratch, next to the code around it? Then walk `review-checklist.md` over the whole diff as a reader, not its author: a fresh agent given only the diff, or a full re-read. Small is no defence for a line in the wrong class. (foam3 #5850 reached the maintainer with four findings this checklist names.)

## Read before writing, by task

The mechanics live in `references/`. Open every file on your task's row before writing a line.

| Task | Read |
|---|---|
| a view, or CSS | `defaults-and-reuse.md`, `u2-views.md`, `where-behaviour-lives.md` |
| a model or property | `defaults-and-reuse.md`, `property-axioms.md` |
| a DAO, decorator, rule, service, or `javaCode` | `context-and-dao.md`, `where-behaviour-lives.md`, `java-server.md` |
| a `COREService`, a throttled or outbound integration, or an authorization check | `services.md`, `context-and-dao.md` |
| a flow, block, command, or agent | `reflow.md`, `defaults-and-reuse.md` |
| a markdown document tag or Knowledge Base view | `reflow.md` (Markdown documents), `u2-views.md` |
| a foam3 core class, index, or codegen | `foam3-core.md` |
| any PR | `style-mechanics.md` |
| a review | `review-checklist.md` |

First step on every row: grep for the thing you are about to add. A class by name under `src/`, a
command id in `cmds.jrl`, an agent in `agents.jrl`, a property on the base class.

## Reviewing a diff

First pass: ask the five spine questions of every hunk, shared classes first. Then walk `review-checklist.md` top to bottom for the detail. One finding per line:
`<path:line> — <principle heading> — <do line>`. Cite the reference file, never a person.
A review workflow runs this as its design and simplicity passes; an application may layer its own patterns on top.
