<flow name="KnowledgeBaseDocs" category="DOC/GUIDE" spid="foam" description="How to add a .md file to the Knowledge Base, edit an existing doc, and fix a doc that is missing or renders badly." keywords="knowledge base,docs,markdown,flow,reflow,knowledge"/>

# Writing Knowledge Base Docs

The **Knowledge Base** menu lists Reflow flows. A doc is a plain `.md` file in the repo. The build
turns it into a flow when the file holds a `<flow>` tag.

## Turn a .md file into a doc

Put one `<flow>` tag on the first line of the file, then a blank line, then the markdown:

```
<flow name="UserSetup" category="Admin" description="Create a user and give them a group." keywords="knowledge,users"/>

# User Setup

...
```

Four things decide whether the doc shows up:

1. **The `<flow>` tag.** A `.md` without one is skipped by the build (`tools/JournalMaker.js`). It is a
   tag, not YAML frontmatter: `---` blocks do nothing.
2. **`knowledge` in `keywords`.** The menu shows only flows whose keywords include `knowledge`,
   lowercase (`src/foam/core/reflow/menus.jrl`).
3. **A folder the build reads.** The build reads every folder under a `pom.js`, except folders that
   start with `.`, or are named `examples`, `node_modules`, or end in `build`, `test` or `tests`.
   A README next to code you never build is never read.
4. **A rebuild.** The build copies the doc into the `flows` journal. A new file appears only after
   the next build.

## Tag attributes

| Attribute | What it sets | Example |
|---|---|---|
| `name` | Flow name, unique across the app. Defaults to the file name | `"UserSetup"` |
| `category` | The group the card sits in | `"Admin"` |
| `description` | The text on the card | `"Create a user..."` |
| `keywords` | Comma list; must hold `knowledge` | `"knowledge,users"` |
| `spid` | Which service provider sees the doc | `"foam"` |
| `accessLevel` | `PRIVATE`, `PUBLIC_RO`, `PUBLIC_RW` or `SHARED` | `"SHARED"` |
| `specifiedUserAccess` | With `SHARED`: who may read, as single-quoted JSON. Any list property of the app's `Flow` works the same way | `'[{"userId":1348,"accessLevel":1}]'` |
| `notes`, `label` | Copied to the flow as is | |
| `childLock` | Locks the doc to one markdown block (see below) | `"true"` |

Two docs with the same `name` collide, and the one loaded last wins. Escape `"`, `<`, `>` and `&`
inside a value as `&quot;`, `&lt;`, `&gt;` and `&amp;`.

## Edit an existing doc

**Edit the `.md` file** and rebuild. This works on every environment and is the only way that
reaches a deployed server.

**Or edit it in the app,** on a local server in DEVELOPMENT or TEST mode:

1. Open the doc, edit the markdown block and the flow properties, and save.
2. The save writes the `.md` back with a fresh `<flow>` tag (`SaveFlowToFileRuleAction`).
3. Check the file in git, then commit it.

On any other mode the save stays in the journal only. The file does not change, and the next build
replaces the edit with the file.

A doc must stay **one markdown block.** If it gets a second block, or a block that is not markdown,
the save writes a `.flow` file instead and the flow shows a WARNING status. `childLock="true"` hides
the block toolbar so this cannot happen by accident. Every save to `.md` sets it.

In DEVELOPMENT or TEST mode, opening a doc reads its `.md` directly (`LoadFlowFromFileDAO`), so a
file edit shows without a rebuild. The cards on the Knowledge Base page still show the last build's
copy. Open `#flow_/<name>?flowMode=PRESENTATION` on a fresh page to see the edit.

If Reflow offers to load unsaved changes when you open a doc, decline. They overwrite what came
from the file.

## Markdown that renders

The viewer is `foam.u2.view.MarkdownView`, not GitHub or GitBook markdown. Most standard markdown
works: headings, lists, tables, code blocks, links, bold and italic.

Hints, a coloured box, use a `<hint>` tag. The category is `hint`, `warning`, `success` or
`danger`:

```
<hint category="warning">
Read **this** first.
</hint>
```

GitBook's `{% hint style="info" %}` is not supported and shows as plain text. Convert it to a
`<hint>` tag when you migrate a page.

Other tags the editor toolbar inserts: `<toc></toc>` (contents list), `<search></search>`,
`<glossary></glossary>` and `<details>`.

**Images** go in a folder named `images` next to the `.md`, referenced as `images/<file>`:

```
![User list](images/user-setup-list.png)
```

The build copies every `images` folder into one flat folder served at `/images/`. File names must
be unique across the whole app, so prefix them with the doc name.

## Doc is missing or broken

| Symptom | Check |
|---|---|
| New `.md` never shows | `<flow>` tag on the first line, `knowledge` in `keywords`, folder under a `pom.js`, rebuilt |
| Shows for some users only | The user's `spid`, `accessLevel` and the access list in the tag, and the `menu.read.knowledgeBase` permission |
| Lost its formatting | GitBook syntax (`{% ... %}`) or HTML the viewer does not know; rewrite with the tags above |
| App edit gone after a build | The edit was made outside DEVELOPMENT or TEST mode, so the file never changed; edit the `.md` |
| Became a `.flow` file | The doc got a second block; delete it, set `source` back to the `.md`, save again, delete the stray `.flow` |
| Image missing | Folder not named `images`, or another image already has that file name |
