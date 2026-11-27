# DAO agents and sinks

An agent is the object in `DAOPrompt.select`. It builds a sink, selects the prompt's rows into it, and draws the sink in the block. Paths are under `src/foam/core/reflow/`.

## The run of one agent

`AbstractDAOAgent.execute(e)` (`AbstractDAOAgent.js:48-77`):

1. `createSink()` makes the sink. The default is an `ArraySink` (`:46`).
2. `this.dao.select(sink)` selects from the prompt's limited DAO (`:23`, `:51`).
3. `unwrapSink(s)` lets a subclass pull the real sink out of a wrapper (`:47`, `:52`).
4. `value(s)` sets `block.value`, or `block.value.value` when the block's value is a prompt (`:54-58`). Other blocks read this as `blockName.value`.
5. The sink is cloned into the agent's context, because a sink that crossed the network has lost it (`:60-62`).
6. A dynamic on the block's `shown` calls `addSinkToE(e, s)` to draw it. The previous dynamic is detached first (`:64-71`).

A failure draws an `ErrorView` and does not throw, so the other blocks of the flow still load (`:72-76`).

## The class family

| Class | Role |
|---|---|
| `AbstractDAOAgent` | the run above; `createSink`, `unwrapSink`, `value`, `addSinkToE`, `addToE` (the agent's own form) are the hooks |
| `AbstractSinkDAOAgent` | adds `sink`, the nested agent whose sink does the inner work; re-creates a loaded `sink` in its own context (`AbstractSinkDAOAgent.js:12-26`) |
| `AbstractColumnAwareDAOAgent` | adds the prompt's `columns` and an optional projection (`AbstractColumnAwareDAOAgent.js:7-30`); `CSVDAOAgent`, `JSONDAOAgent` and `XMLDAOAgent` extend it |
| `CountDAOAgent` | `COUNT()` (`CountDAOAgent.js:20`) |
| `MinDAOAgent`, `MaxDAOAgent`, `AvgDAOAgent`, `SumDAOAgent` | one property, one number. Max and Avg extend Min, Sum extends Avg (`AvgDAOAgent.js:10`, `SumDAOAgent.js:10`, `MaxDAOAgent.js:10`) |
| `GroupByDAOAgent` | `prop` and an inner `sink`; `createSink` returns `GROUP_BY(prop, inner.createSink())`, or `TopNGroupBy` when `topN > 0` and the inner sink supports it (`GroupByDAOAgent.js:132-157`) |
| `GridByDAOAgent` | two properties and an inner sink; `createSink` returns a `GridBy` (`GridByDAOAgent.js:36-40`) |
| `FilteredDAOAgent` | wraps the inner sink in a `FilteredSink` (`FilteredDAOAgent.js:65-91`) |
| `TableDAOAgent`, `CSVDAOAgent`, `JSONDAOAgent`, `XMLDAOAgent` | formats |
| `PivotDAOAgent`, `RowDAOAgent`, `ColumnDAOAgent`, `LabeledDAOAgent`, `SetDAOAgent`, `DuplicateDAOAgent`, `CitationDAOAgent`, `DownloadDAOAgent`, `ControllerDAOAgent`, `ObjectSelectDAOAgent`, `ViewDAOAgent`, `EditDAOAgent`, `AllDAOAgent`, `ScriptDAOAgent` | structure and special views; the gated ones are marked in `agents.jrl` |
| `dashboard/Dashboard*ChartDAOAgent`, `DashboardMetricDAOAgent` | chart agents; see `foam-chart-builder` |

`GroupByDAOAgent`, `GridByDAOAgent` and `FilteredDAOAgent` nest: their `sink` property is another agent, picked in the form with a `SinkView` (`GroupByDAOAgent.js:40-44`). A saved flow stores the whole tree as JSON, class names included, so never rename an agent class or a saved property.

## How an agent reaches the picker

`DAOPrompt.select` is edited with a `SinkView` (`DAOPrompt.js:164-171`). The picker is a `RichChoiceView` built from `agentDAO`: one section per `type` in the order `format`, `structure`, `calculation`, `chart`, filtered to `sink: true` rows when `sinksOnly` is set (`SinkView.js:56-74`). The prompt itself shows every row (`sinksOnly: false`); the "Operation" field inside a group-by shows only `sink: true` rows (`GroupByDAOAgent.js:40-44`).

A row in `agents.jrl` has these fields (`SinkAgent.js:18-44`):

| Field | Meaning |
|---|---|
| `id` | a Long. It is the permission name `agent.read.<id>` |
| `label` | the text in the picker |
| `value` | the agent's class id; the picker creates it with `foam.lookup(value)` (`SinkView.js:78-89`) |
| `sink` | true when the agent can be the inner operation of another agent |
| `type` | `format`, `structure`, `calculation` or `chart`. Any other value never shows: the four sections are fixed in code (`SinkView.js:59`) |
| `permissionRequired` | true to hide the row from users without `agent.read.<id>` (`SinkAgent.js:56-66`) |

Rows use the ids 1 to 15, 17 to 22, 24 to 34 and 40 (`agents.jrl`). Take the next unused id and never reuse a removed one: a grant for `agent.read.<id>` outlives the row, so the new agent would inherit it.

`agentDAO` is an authorized `EasyDAO` on the journal `agents`, so a user who cannot read a gated row does not see it in the picker (`services.jrl:79-100`).

## Where a sink runs

`ClientDAO.select_` sends the sink to the server only when it is a `foam.lang.Serializable`. Any other sink, or none, makes the client select into an `ArraySink` and feed your sink the rows in the browser, one by one (`dao/ClientDAO.js:62-90`).

| Runs on the server, returns only the answer | Runs in the browser after the rows arrive |
|---|---|
| `ArraySink`, `Count`, `Sum`, `Min`, `Max`, `Average` (`AbstractUnarySink`), `GroupBy`, `TopNGroupBy`, `Sequence`, `FilteredSink`, `Set`, `Unique`, `Projection`, `GridBy` | any sink without `implements: ['foam.lang.Serializable']`, such as every `Dashboard*Sink` except `DashboardMetricSink` (`DashboardSinks.js:2013`) |

Rules that follow:

- A Serializable sink needs a Java side. `FilteredSink` has `code` and `javaCode` for `put`; `GridBy` has them too (`mlang/sink/FilteredSink.js:37-72`, `GridBy.js:96-110`). A sink with only `code` that claims `Serializable` fails on the server.
- A sink tree is only as server-side as its weakest member. A `FilteredSink` around a row sink still pulls rows. Check every sink in the tree.
- `FilteredSink` takes `predicate` and `delegate` (`FilteredSink.js:15-26`). Created with other property names it has no predicate and `put` skips the filter, so it counts every row (`:40`).
- Group keys come back as text, because `GroupBy.groups` is a plain object. A Boolean groups under `'true'`, an id under `'123'` (`mlang/sink/GroupBy.js:42-48`). Convert before you compare.
- `GroupBy` has no group limit unless one is passed (`groupLimit` default `-1`, `GroupBy.js:36-39`). `GroupByDAOAgent` resets its hidden `groupLimit` to -1 on init, so use `topN` (`GroupByDAOAgent.js:106-130`).

To see which side ran, watch the network tab: a server run sends the sink class in the request and returns no row fields.

## `createSink()` returns a new sink every call

The prompt runs the same agent object again on each re-run, and `dao.select` adds to the sink it gets without clearing it (`AbstractDAOAgent.js:46-51`). An agent that keeps its sink in a property counts every row twice on the second run. Build the sink inside `createSink()` from the agent's properties.

A sink that builds expensive members lazily must rebuild them when its inputs change. `GridBy` clears its stored `rows` and `cols` when `xFunc`, `yFunc` or `acc` change (`GridBy.js:83-95`), so reading them early cannot freeze a grouping by nothing.

## Recipe: add an agent

1. **Grep** `agents.jrl` and the `*DAOAgent.js` files. A `GroupByDAOAgent` with a different inner sink often does the job with no new class.
2. **Pick the base.** A value computed from the rows: `AbstractSinkDAOAgent`. A column list: `AbstractColumnAwareDAOAgent`. A custom view: `AbstractDAOAgent`.
3. **Write the class** in `foam.core.reflow` with these members:
   - properties for the form, each with a `label`, a `validateObj` for required ones and a `view` that lists the DAO's properties through the context (`view: function(_, X) { return { class: 'foam.core.reflow.PropertyChoiceView', forCls: X.data.of }; }`, as in `SetDAOAgent.js:14-21`);
   - `createSink()` returning a fresh sink;
   - `value(s)` returning what other blocks should read; return the sink itself unless a sub-field is the answer;
   - `addToE(e)` for the agent's own form and `addSinkToE(e, s)` for the result. `e.startContext({data: this}).start().add(this.PROP, ...)` is the pattern (`SetDAOAgent.js:34-39`).
4. **If the sink must run on the server,** write it as a `foam.dao.AbstractSink` subclass that `implements: ['foam.lang.Serializable']` with `code` and `javaCode` on `put` and `eof` and on every property it reads. Otherwise leave it in the browser.
5. **Mark derived properties `transient: true`**, so they are not saved with the flow.
6. **Add the file to `pom.js`** with `flags: 'js'`, or `js|java` for a sink with Java code (`pom.js:26-62`).
7. **Add the `agents.jrl` row** with the next free id, a `type`, `sink` true or false, and `permissionRequired: true` unless every user should see it.
8. **Grant it.** For a gated row add `p({ "class": "foam.core.auth.Permission", "id": "agent.read.<id>" })` to a permissions journal and put it in a group or module (`access.md`).
9. **Test it** (`testing.md`) and then add it to a flow in a running server: set it as `select`, save, reload, confirm it comes back. A chart agent also needs the steps in `foam-chart-builder`.

Never rename the class or its saved properties afterwards. Keep an old property name working with a setter shim on the agent instead (`foam-chart-builder`, "Saved flows hold class and property names").
