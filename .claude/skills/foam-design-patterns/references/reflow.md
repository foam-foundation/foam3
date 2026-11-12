# Reflow

A flow is a saved document of named blocks, not a script. Cites are `foam3/src/foam/core/reflow/<file>:<line>`.

| Principle | One-line test |
|---|---|
| One DAO select per block, filtered in the DAO stage | any loop over rows that touches a DAO? |
| Gate visibility with `reactions_`, never by assigning `shown` | is `shown` written anywhere? |
| Derived state is `transient` | would this value appear in the saved script or undo history? |
| Detach the value before the block | any listener without `onDetach`? |
| A block script is a stateless helper | does a second block need anything defined here? |

### Name every block you reference; never rename it afterwards
The name is the scope variable and dependency detection is a substring match on it.
Don't: an unnamed block another block reads; renaming `uploads` once `summary` uses it
Do:    name it first; the value is `uploads`, the block is `uploads$block`
Cite: `Block.js:81-85`, `Console.js:1536-1546`, `Console.js:1793-1821`

### One select per block, through the agent; filter in the DAO stage
The agent selects once into its sink; anything after the select pulls the table to the client and defeats indices.
Don't: a script that loops rows and calls `dao.find` per row; filtering the sink's array in JS
Do:    `where`/`aql` on the DAOPrompt; a `FilteredDAOAgent`; `=` not `:` in predicates so an index can serve it
Cite: `AbstractDAOAgent.js:47-50`, `DAOPrompt.js:251-304`, foam3 `caf522b80f`

### Prefer `aql`/`where` strings over a serialized predicate
A predicate FObject bakes `forClass_` into the script and breaks when the class is not registered at load.
Don't: `predicate: { class: 'foam.mlang.predicate.Eq', ... }` in the saved block
Do:    `aql: 'status = OPEN'`
Cite: `DAOPrompt.js:149-153` vs `311-325`

### Gate visibility with a `reactions_` formula, never by assigning `shown`
`shown` is persisted, so a runtime toggle is a document edit autosave writes back; a hidden block still runs.
Don't: `summaryTable$block.shown = uploads.count > 0` in a script
Do:    a `reactions_` entry on `summaryTable`: `shown: uploads$count > 0`; default `"shown": false` in the block JSON
Cite: `Block.js:97-101,207-208`, `ReactiveDetailView.js:22-30,91-144`, `AbstractDAOAgent.js:64-68`

### Derived state is `transient`
A non-transient derived field enters the undo memento and the saved script, and bloats both.
Don't: a computed `count` property without `transient: true` on an agent
Do:    `{ name: 'count', transient: true, expression: function(array) { ... } }`
Cite: foam3 `c2134c97ef`, `Console.js:1832`

### Bump `version` after changing an agent property programmatically
The view re-executes on `data` or `version` only.
Don't: `agent.where = 'x = 1'` and expect a redraw
Do:    `agent.where = 'x = 1'; agent.run();` (`run` is `version++`)
Cite: `DAOPrompt.js:39,44,565-567`

### A sink's output is a property; aggregation sinks run on both tiers
Render-time computation cannot be referenced by another block; a JS-only sink cannot run server-side.
Don't: build the JSON string inside `addToE`
Do:    `{ name: 'json', transient: true, expression: function(array) {...} }`; `Serializable` with paired `code`/`javaCode`
Cite: `JSONSink.js:13-25`, `GridBy.js:14-17`

### Detach the value before the block; `onDetach` every listener
The value owns the DAO listeners; a stale dynamic renders into a detached element.
Don't: `block.detach()` alone; `dao.listen(...)` without `onDetach`
Do:    `Flowable.detachFlowChild`; `this.onDetach(dao.listen(...))`; detach the previous dynamic before creating a new one
Cite: `Flowable.js:93-103`, `DAOPrompt.js:520-521`, `AbstractDAOAgent.js:61-63`

### No per-flow state on `globalThis`; no shared DAO across independent blocks
Globals survive `clearFlow` and bleed into the next flow in the tab; a shared DAO cross-talks on refresh and purge.
Don't: `window.currentBuffer = ...`; two previews sharing one DAO instance
Do:    a property on the Console or the block; one DAO per block
Cite: `Console.js:1091-1098`, foam3 `ac7d4b5ea3`

### Commands and agents live in `cmds.jrl` and `agents.jrl`; check there first
The registry is the journal, not the sibling class files; a second command with the same job is a parallel class.
Don't: a new `button` command when `grep '"id": *"button"' cmd/cmds.jrl` already hits; a sink class with no `agents.jrl` row
Do:    grep the id, extend the existing command's class; add the journal row for anything new
Cite: `cmd/cmds.jrl`, `agents.jrl`, `SinkView.js:50-89`

### Gate with permissions; set `accessLevel`
An unpermitted command never enters scope; the flow default is `PUBLIC_RW`.
Don't: a command hidden in the UI; `accessLevel` unset
Do:    `permissionRequired` on the Command or SinkAgent; `accessLevel` chosen
Cite: `SinkView.js:50-89`, `cmd/Commands.js:76-88`, `Flow.js:133-140`

### Never hand-edit a saved flow's escaped script
The script is JSON inside JSON inside a string; a literal `\n` terminates the enclosing literal and kills the block.
Don't: a regex over `"script":"..."` in a `.jrl`
Do:    `BadBlock.repair`, or lift the whole flow through export and re-import
Cite: `Flow.js:205-210`, foam3 `069ad8903d`

### A block script is a stateless helper
Anything a second block needs belongs in a named block, a model, or `foam.core.reflow.lib`.
Don't: a parser or a prompt string living inside a command's script
Do:    a model or parser class; a FLOW document the command loads
Cite: foam3 `39090d486f`, `24f3316d6c`, `lib.js:7-20`

## Markdown documents

A Knowledge Base page is a flow whose one block is markdown (`Markdown.js`), rendered by `foam.u2.view.MarkdownView`.
Its features are HTML tags the document writes, not modes of the view.

| Principle | One-line test |
|---|---|
| A document feature is a registered tag | does the change add a property or mode to `MarkdownView`? |
| Extend the tag that exists with an attribute | is there a second tag doing a variant of `<toc>`, `<a>`, `<hint>`? |
| Move between documents with an `<a>` naming the flow | any `routeTo('flow_/...')` or hand-built hash in a document view? |
| Follow the flow's fields, not the flow object | a `dynamic` on `data$value` or `flow` that should re-run on load? |
| Fetch only the columns the view reads | a full `Flow` select to read names? |
| `Flow` and the Console are hosts: extend them through their slots | does `Flow.js` or `Console.js` name a keyword, tag or view of one feature? |

### A document feature is a tag, registered in a `foam.SCRIPT`
Tags compose in any document and need no change to the renderer; a mode on the view applies to every markdown everywhere.
Don't: a `showContents` property on `MarkdownView`; a block that injects its own navigation
Do:    a class plus `foam.__context__.registerElement(Cls, 'name')` in a `foam.SCRIPT`; the author writes `<name></name>`
Cite: `u2/markdown/TOC.js:401-406`, `core/reflow/Link.js:74`

### A tag that knows about flows lives in `foam.core.reflow` and imports its services as optional
The same tag renders outside a Console (a test, a preview), where the flow and its DAO are absent.
Don't: `imports: ['flowDAO']` on a document tag; a tag in `foam.u2.markdown` that reads the current flow
Do:    `imports: ['flow?', 'flowDAO?']`, return early when they are missing; the Console exports `value as flow`
Cite: `core/reflow/Link.js:14-18`, `core/reflow/Console.js:897`

### Extend the tag that exists with an attribute
A variant of a tag is an attribute on it, the way `<tocconfig index>` turns on numbering; a second tag splits one feature in two.
Don't: a `<sidetoc>` tag beside `<toc>`
Do:    `{ class: 'Boolean', name: 'side', attribute: true }` on the existing class, written `<toc side></toc>`
Cite: `u2/markdown/TOC.js:177-183`

### Move between documents with an `<a>` that names the flow
`Link` loads a flow named by `href` in place and keeps the flow mode; a `#id` href scrolls to that heading; any other `#` href is an app route.
Don't: `routeTo('flow_/' + name)` or `window.location.hash = ...` from a document view
Do:    `start('a').attrs({ href: flow.name })`; `href: '#knowledgeBase'` to leave for a menu
Cite: `core/reflow/Link.js:29-63`

### Loading a flow copies it into the same object: follow its fields
The Console keeps one `value` and `copyFrom`s each loaded flow into it, so its slot never fires on load.
Don't: `this.dynamic(function(data$value) {...})` to redraw per document
Do:    `this.dynamic(function(flow$name, flow$category) {...})`, and compare the name after any `await`
Cite: `core/reflow/Console.js:1815`

### Inline tags sit inside a paragraph; layout that needs the document dissolves it
A tag written on its own line still lands in `div.mdParagraph`, and a sticky element sticks only within its parent; the Block's content box scrolls sideways (`overflow-x: auto`), which also makes it the box a sticky element sticks to.
Don't: `position: sticky` on a tag and expect it to follow the page
Do:    `.mdParagraph:has(> <<x) { display: contents; }` and `.foam-core-reflow-Block-content:has(<<x) { overflow: visible; }`, both in the tag's own CSS
Cite: `u2/view/MarkdownView.js:554`, `core/reflow/Block.js:52`, `u2/markdown/TOC.js` (the `side` rules)

### An order with parts is set in code, not in a journal
`ThenBy` keeps `head` and `tail` exactly as given, so a `ThenBy` read from JSON holds plain maps and sorts nothing.
Don't: `"order": { "class": "foam.mlang.order.ThenBy", "head": {...}, "tail": {...} }` in a `menus.jrl` view config
Do:    an `order` factory on the view class: `this.THEN_BY(Model.A, Model.B)`; a `GroupingDAOList` already implements `Expressions`
Cite: `mlang/order/ThenBy.js:23-27`, `mlang/Expressions.js:170`, `u2/GroupingDAOList.js:12`

### Fetch only the columns the view reads
A flow carries its whole script; a list of names for a breadcrumb or a next link does not need it.
Don't: `flowDAO.where(...).select()` then `.map(f => f.name)`
Do:    `.select(this.PROJECTION(Flow.NAME))`
Cite: `mlang/Expressions.js:155`

### `Flow` and the Console are hosts: extend them through their slots
Every flow, dashboard and document goes through `Flow` and the Console, so a feature's code there is carried by all of them (the spine's "Extend without breaking"). The Console header gives out two empty views for a flow's own content: `titlePrefix`, left of the flow's name, and `titleSuffix`, after its version. The header sets them each time it is drawn and the Console exports them.
Don't: a lookup or keyword constant on `Flow`; a feature's view required by the Console header
Do:    the feature's tag imports `titlePrefix?`, follows it in its `dynamic`, clears it with `removeAllChildren()` and adds to it, and removes what it added on detach. Its import is already cleared when its own `onDetach` runs, so it keeps its own reference to what it added.
Cite: `core/reflow/Console.js` (`titlePrefix`), `core/reflow/FlowDocumentNav.js` (`renderCrumbs`)
