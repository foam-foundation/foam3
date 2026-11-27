# DAOPrompt

`DAOPrompt` (`DAOPrompt.js`) is the value of a `dao`, `FROM` or `daofilter`-style block. It holds a DAO, the filter that narrows it and the agent (`select`) that draws or aggregates it. Its view, `DAOPromptView`, runs the agent again whenever `version` changes (`DAOPrompt.js:19-67`).

Paths are under `src/foam/core/reflow/`.

## The pipeline

```
dao  ->  where  ->  aql  ->  order  =  filteredDAO   (exported as sinkUnlimitedDAO)
                                         |  skip, limit
                                         v
                                      limitedDAO      (exported as sinkDAO)
```

`filteredDAO_` applies `where`, then `aql`, then `order` (`DAOPrompt.js:262-308`). `limitedDAO_` adds `limit` and `skip` when they are not 0 (`:244-249`). An agent imports `sinkDAO` as its `dao` and `sinkUnlimitedDAO` as `unlimitedDAO` (`AbstractDAOAgent.js:20-24`, `DAOPrompt.js:143-151`). Only the table agent reads the unlimited one (`TableDAOAgent.js:86-89`).

## Options

| Option | Type | What it does | Trap |
|---|---|---|---|
| `dao` | DAO or name | the data. A string such as `logMessageDAO`, `logMessage` or `logMessages` is resolved against the flow scope, then the context (`DAOResolverMixin.js:15-80`) | transient: a saved block does not store it, the saved `cmd` rebuilds it (`DAOPrompt.js:198-217`) |
| `where` | String | a query string parsed by `QueryParser` in the browser (`:268-273`) | setting it hides the `aql` field in the editor but `aql` still applies (`:371`, `:269-280`); a string that does not parse shows no error (`:272`) |
| `aql` | String | a query string parsed by `SimpleQueryParser`: `count > 10 AND key = login` (`:275-280`) | a string that does not parse is skipped, so a typo returns every row (`:277-279`); `FROM x WHERE ...` fills `aql`, not `where` (`parser/FromParser.js` `STARTAction`) |
| `order` | String | comma list of property names, `-` before a name for descending: `-timestamp,id` (`:282-305`); spaces are removed (`:389`) | a name that is not a property is dropped without a message (`:295-300`) |
| `limit` | Int | at most this many rows reach every agent but the table. Default 100, 0 means no limit (`:351-356`, `:246`) | a count or sum block over a large table shows 100 unless `limit: 0` |
| `skip` | Int | rows to skip before `limit` (`:331-350`, `:247`) | applies to the same agents as `limit` |
| `columns` | String | comma list of property names, dotted for a nested one (`:399-424`) | the table agent copies this (`TableDAOAgent.js:81-83`), so set it on the prompt; unknown names fail validation |
| `select` | agent | what to do with the rows. Default `TableDAOAgent` (`:164-184`) | a loaded agent is cloned into the prompt's context (`:173-180`) |
| `autoRun` | Boolean | run again 250 ms after `aql`, `where` or `order` change (`:639-653`) | off by default: after editing `aql` in a script, a count or group block shows the old answer until `run()` unless this is on |
| `filters`, `predicate` | hidden | state of the filter bar in the browse view (`FlowBrowserView.js:121-128`) | `filteredDAO_` never reads them (`:262`), so setting `predicate` does not change the block's rows |
| `label` | String | the block title (`:186-197`) | defaults to the model's plural |

`daoKey`, `rowCount`, `executionTime`, `version`, `running`, `hasError` and `value` are state, not options (`:198-204`, `:456-462`). `value` holds the agent's result, which is what another block reads as `blockName.value` is the prompt and `blockName.value.value` is the result.

## Running it

- **`run()`** adds 1 to `version` and sets `running` (`:576-579`). The view re-selects on `data` or `version` (`:37-44`).
- **What re-runs on its own.** A change of `where` re-runs the view after 500 ms (`DAOPromptView` at `:37` and `:86-93`). A change of `aql` or `order` re-runs only when `autoRun` is true (`:639-653`). A change in the DAO's rows re-runs after 100 ms (`:531`, `:626-637`). A table needs none of this, because it follows `filteredDAO` itself.
- **Any other change needs `run()`**, and so does an `aql` or `order` change on a block without `autoRun`. After `agent.prop = 'x'` in code, call `run()` (`Reflow.md`, "Call `run()` after changing an agent in code").
- **`waitForRun()`** replaces the ready latch, runs, and returns a promise that settles after the select (`:557-561`). `onLoad()` returns the latch, so a saved flow waits for each prompt's first select before the next block loads (`:540-542`).
- **A table does not re-select.** `TableDAOAgent` keeps its table and moves it back into the block (`TableDAOAgent.js:72-79`). It listens to the DAO itself.

## Reading a prompt from another block

A block named `logs` makes `logs` the prompt. Useful members:

- `logs.filteredDAO`: the DAO after `where`, `aql` and `order`, with no limit. Use it as the source of a second block: `dao('logs.filteredDAO')`. The dotted name resolves through the scope (`DAOResolverMixin.js:20-53`).
- `logs.value`: what the agent produced. A count agent leaves a `Count` sink, a group agent a `GroupBy` sink (`CountDAOAgent.js:13-19`, `GroupByDAOAgent.js:131`).
- `logs.rowCount`: the count of `filteredDAO`, kept up to date by a listener (`:563-565`, `:620-625`).

## Writing a filter in a flow

- Use a string (`aql` or `where`) in the saved block. A predicate object saved in `predicate` stores its class name, and loading fails if that class is not registered when the block loads (`Reflow.md`, "Filter with an `aql` or `where` string").
- Use `=` for an exact match so an index can serve it (`foam-design-patterns`, `references/reflow.md`).
- To change the filter from a formula, set `aql` in `reactions_`: `{ "aql": "count > 10" }`, and set `autoRun: true` so a non-table agent re-runs. The prompt subscribes to `aql` before it checks for a DAO, so a formula that fires after the block loaded still reaches `onFilterChange` (`DAOPrompt.js:508-514`, `:639-647`).
- Do not read the DAO's default query as "no filter". When `aql` is empty at init, the prompt asks the DAO for `DEFAULT_QUERY_CMD` and fills `aql` with the answer (`:521-525`, `core/partition/AbstractPartitionedDAO.js:33-36`).
