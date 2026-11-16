<flow name="Flags" category="DOC/GUIDE" spid="foam" description="How FOAM build flags work: flag expressions in POMs, setting flags from build.sh, pmake, the URL and the script tag, precedence, defaults, and gotchas." keywords="flags,pom,build,setflags,java,web,debug,test,knowledge"/>

# Flags

## TLDR;

A flag is a named boolean, such as `java`, `web`, `debug` or `test`. Each entry in a POM can carry
a flag expression, and the entry is loaded only when that expression is true for the current build.

**In a POM**, put a `flags:` expression on an entry in `files:` or `projects:`. `|` means OR, and
`&` means AND and binds tighter:

```js
files: [
  { name: "acme/app/Invoice",     flags: "js|java" },     // a model used by both JS and Java
  { name: "acme/app/InvoiceView", flags: "web" },         // browser only
  { name: "acme/app/Seed",        flags: "java&test" },   // Java, only in test builds
  { name: "acme/app/DevTool",     flags: "dev&web|web&test" }
]
```

An entry with no `flags:` is always loaded, but **a model gets a `.java` file only if its entry's
flags include `java`**. That is why most model entries say `"js|java"`.

To change a flag's value for the whole project, use `setFlags:` in the top-level POM:

```js
setFlags: { dev: true, sql: false }
```

**From the build command line**, use `--flags:` followed by a comma-separated list. A leading
`-` turns a flag off:

```bash
./build.sh --flags:test            # include test-flagged files in a normal build
./build.sh --flags:dev,-debug      # turn dev on and debug off
```

The test tasks (`server-tests:`, `client-tests:`, `run-tests:`) turn `test` on by themselves, so
they don't need `--flags:test`.

The rest of this guide covers the details.

## Flag expressions

A flags value is a string of flag names joined by `|` and `&`, with no spaces:

| Expression | Meaning |
|---|---|
| `"java"` | `java` |
| `"js\|java"` | `js` OR `java` |
| `"web&debug"` | `web` AND `debug` |
| `"java\|web&debug"` | `java` OR (`web` AND `debug`) |

The string is split on `|` into AND-clauses, and the entry matches if any clause has all its flags
true (`checkFlags`, `src/foam.js:87-105`). The array form `[ "js", "java" ]` means the same as
`"js|java"`.

Whitespace or an empty token, such as `"js |java"` or `"js||java"`, fails the load with
`foam: malformed flags` (`src/foam.js:151-160`). It used to drop the entry silently.

For logic that `|` and `&` can't express, give the entry a `predicate:` function. It is checked
after `flags:` (`src/foam.js:242`):

```js
{ name: "acme/app/Beta", predicate: () => foam.flags.web && ! foam.flags.debug }
```

## Setting flags in a POM

### On `files:` and `projects:` entries

An entry whose flags don't match is skipped (`src/foam.js:235-246`). If the entry is in
`projects:`, the whole sub-POM is skipped, along with every file inside it.

A model takes its flags from the POM entry that loaded it, unless the model declares its own
`flags:` (`src/foam/lang/EndBoot.js:334`). So the entry's flags also decide the model's targets:
Java source is generated only if those flags contain `java`, or `java&test` in a test build
(`targetJava`, `src/foam/java/refinements.js:2775-2779`).

### `setFlags:`

`setFlags:` assigns flag values for everything loaded after it. **The first POM to set a flag
wins.** Later POMs that try to set the same flag only log `Not overriding flag: <name>`
(`src/foam.js:274-287`). The top-level POM loads first, so its `setFlags:` overrides any
sub-POM's.

`setFlags:` applies to the build as well as the browser, because the Node build loads POMs through
the same `foam.js` (`src/foam_node.js:69`). This is how a project turns on `dev`, which the build
doesn't set by itself (see Gotchas).

### On models and axioms

A refinement (`foam.CLASS({ refines: ... })`) whose flags don't match is not applied, and the
class stays unrefined (`src/foam/lang/Boot.js:127-129`).

A single property, method or other axiom can have its own `flags:`. For example,
`flags: ['js']` on a method keeps it out of the generated Java class
(`src/foam/u2/Element2.js:514`). Java generation keeps an axiom if it has no flags or if its
flags array contains the word `java` (`flagFilter`, `src/foam/lang/stdlib.js:1185-1192`).

A `foam.SCRIPT` with `flags:` runs only when they match (`src/foam.js:227-230`).

## Setting flags from the command line

### `build.sh`

`./build.sh --flags:<list>` sets the flags passed to every pmake call the build makes
(`tools/build.js:494`, `tools/buildlib.js:303-314`). In `<list>`, names are separated by commas
and a leading `-` turns a flag off.

- **Use the long form.** The short option `-f` takes no value, because only upper-case short
  options read the rest of the argument (`tools/buildlib.js:448-452`). So `-ftest` does not set
  `test`: `-f` clears the flag list and the rest of the argument is read as more short options.
- **One `--flags:` per command.** A second `--flags:` replaces the first rather than adding to it
  (`FLAGS = arg`, `tools/build.js:494`). Put every flag in one list.
- **Test tasks add `test` automatically.** `run-tests`, which `server-tests:` and `client-tests:`
  go through, runs `test-setup`, which adds `test` (`tools/JavaTooling.js:451`,
  `tools/JavaTooling.js:631`).
- **The Java step forces `java` on** (`tools/JavaMaker.js:32-34`), whatever you pass.

### `pmake`

When calling pmake directly, use `-flags=`, with the same comma and `-` syntax
(`tools/processArgs.js:36-44`):

```bash
./tools/pmake.js -flags=web,java,-debug ...
```

Maker settings such as `verbose` and `loadFiles` are stored in the same flag map as POM flags
(`tools/pmake.js:55-76`), so choose flag names that don't collide with them.

## Setting flags in the browser

These apply only when running from source, where `foam.js` loads the POMs in the page. A built
`foam-bin.js` already contains just the files the build's flags selected.

- **URL parameters:** `index.html?debug=false&u3=true`. A value counts as on only if it is the
  literal `true` (`src/foam.js:53-57`).
- **The `foam.js` script tag:** `<script src="foam3/src/foam.js" flags="u3,-debug"></script>`
  (`src/foam.js:38-46`).

## Precedence

Highest first:

1. URL parameters. They are locked, so no POM can override them (`src/foam.js:56`).
2. `setFlags:` in a POM, with the first POM to set a flag winning.
3. The command line (`--flags:` / `-flags=`) or the script tag's `flags` attribute.
4. Defaults.

Because `setFlags:` beats the command line, `--flags:-dev` has no effect on a project whose POM
sets `dev: true`.

## Defaults

The browser and the build start from different defaults:

| Flag | Browser (`src/foam.js:17-25`) | Build (`src/foam_node.js:11-21`) |
|---|---|---|
| `dev` | true | not set |
| `debug` | true | true |
| `js` | true | true |
| `java` | false | true |
| `web` | true | true |
| `node` | false | false |
| `swift` | false | false |
| `sql` | not set | true |

## What else the `test` flag controls

With `test` off, the build also skips:
- directories whose names end in `test` or `tests` (`tools/pmake.js:94-95`)
- `tests.jrl` files and journal files flagged `test` (`tools/JournalMaker.js:178-187`)

## Gotchas

- **`dev` is off in every built bundle unless a POM sets it.** The browser defaults `dev` to true,
  but the build doesn't set it at all. An entry flagged `dev&web` is missing from every built
  `foam-bin.js`, including the one client tests run against. For a dev-only browser class that
  has a client test, use `dev&web|web&test` (example: `ViewReloader`, `src/foam/u2/pom.js:118`).
- **A model with no flags gets no Java.** An entry with no `flags:` is loaded everywhere, but
  `targetJava` generates Java only when the flags contain `java`
  (`src/foam/java/refinements.js:2778`).- **Axiom flags are matched as whole words.** The Java generator looks for the literal word `java`
  in an axiom's flags array, without evaluating the expression. An axiom flagged
  `['java&test']` therefore fails the match and is dropped from the Java class.
