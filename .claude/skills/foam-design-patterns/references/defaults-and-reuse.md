# Defaults and reuse

The largest cluster in the review corpus by a wide margin. Every line here is cheap to fix before
the PR and costs a round after it.

| Principle | One-line test |
|---|---|
| Never write a value that is already the default | delete it; does anything change? |
| Use the one-liner the framework already has | grep the base class before writing three lines |
| Extend the class that exists; never build a parallel one | `grep -r "name: '<Thing>'" src/` first |
| The diff contains only the change | every hunk traces to the ticket |
| Nothing left from debugging | `grep -n 'console.log\|println\|debugger\|///'` on the diff |

### Never write a value that is already the default
The framework knows its defaults; restating them is noise review must read past.
Don't: `start('div')`; `addClass(this.myClass())`; `implements: ['foam.mlang.Expressions']` on a View; `factory: function() { return []; }` on an Array; `.select(this.ArraySink.create())`; `value: false` on a Boolean; `after: false, async: false` on a rule; `&test` under a `flags: 'test'` pom; `literal('x')` in a grammar
Do:    `start()`; `addClass()`; call `this.EQ(...)` directly, View already mixes Expressions in; `{ class: 'Array', name: 'ids' }`; `.select()`; omit; omit; omit; `'x'`
Review asked: "No need to waste space and slow startup by defining empty fields. FOAM knows the default values." (PR #3732); "DIV is the default value for start()"; "after and async default to false"

### Use the one-liner the framework already has
Three hand-written lines where a fluent call exists is the second most common comment.
Don't: `.start().end()` with a slot, `if ( cond ) el.show()`, `enableClass(c, s$.map(v => ! v))`, copying fields one by one, `OR(EQ(p,a), EQ(p,b))`, `typeof a === 'string'`, `sort((a,b) => a.order - b.order)`
Do:    `.tag('', null, slot$)`, `.show(cond$)`, `.enableClass(c, s$, true)`, `copyFrom(obj)`, `IN(p, [a,b])`, `foam.String.isInstance(a)`, `sort(Property.ORDER.compare)`
Review asked: "You can just do this.addClass(), since if no arg is provided it defaults to this.myClass()." (PR #3534); "Isn't this already the default factory: for FObjectArrays?" (PR #1878)

### Extend the class that exists; never build a parallel one
A second class with the same job splits every future fix in two and loses theme, permission, and a11y behaviour the original already carries.
Don't: a new TimeUnit enum; a second `button` command when `cmds.jrl` has one; a tabs view with its own CSS; a hand-rolled `getTransactions` beside a Relationship; a filter view copied from StringFilterView
Do:    grep first: `grep -rn "name: '<Thing>'" src/`, `grep -n '"id": *"<cmd>"' cmds.jrl`; then refine `foam.nanos.TimeUnit`; extend the existing command; `extends: 'foam.u2.UnderlinedTabs'`; the Relationship's accessor; `extends: 'foam.u2.filter.properties.StringFilterView'`
Review asked: "Foam already has a TimeUnit enum, can you just refine that instead?" (PR #4049); "the getTransactions(x) was removed as it is already provided by the Relationship. This is a feature of foam."; "How is this different than the DAONameParser?"

### The diff contains only the change
Reviewers say "revert" on every hunk they cannot trace to the ticket, and block the PR on a feature they disagree with.
Don't: a reformat, a rename, or a second feature riding along
Do:    one behaviour per PR; formatting as its own commit; split the extra into its own PR
Review asked: "Should this be part of this PR?" (PR #2362); "Should have been a PR on its own." (PR #4351)

### Nothing left from debugging
A `console.log` or `debugger` in a view freezes every user with devtools open; a commented-out block is dead weight.
Don't: `console.log('rendering', x)`, `System.err.println("THERE::")`, `if ( ! p ) debugger;`, a commented-out `init()`
Do:    delete, or gate behind a `Logger` at debug level
Review asked: "remove log()" (PR #3952); "Will this remain in the final commit?" (PR #4559)

### Say why when the code looks like an omission
A guard that looks redundant gets "fixed" by the next reader unless the reason sits beside it.
Don't: a bare `if ( ! this.x ) return;` that exists for a browser quirk
Do:    the same line with a one-sentence comment naming the quirk, or `documentation:` on the property
Review asked: "add a comment so that someone doesn't just delete this in the future thinking its redundant" (PR #1708)

## Rationalisations seen in testing

| Rationalisation | Reality |
|---|---|
| "The skill says not to add `implements Expressions`, so I'll create a local `foam.mlang.Expressions.create()`" | View already mixes it in. `this.EQ(...)` works with no declaration at all. |
| "I read three sibling widgets and none was a button, so I'll add one" | The registry is `cmds.jrl`, not the sibling files. Grep the id there before adding a command. |
| "I'll keep `addClass(this.myClass())` for clarity" | It is the default. The reviewer will ask for `addClass()`. |
