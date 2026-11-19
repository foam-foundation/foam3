<flow name="Benchmarks" category="DOC/GUIDE" spid="foam" description="Timing FOAM code with foam.core.bench: Benchmark and BenchmarkRunner rows, the java-benchmarks task, reading the result, defaults and traps." keywords="benchmark,benchmarkrunner,java-benchmarks,performance,timing,knowledge"/>

# Benchmarks

A test says pass or fail; a benchmark says how fast. `foam.core.bench` runs a piece of code many times on several threads, times every run with a PM, and stores the rate in `benchmarkResultDAO`. Use it to measure a performance change before and after.

For the build flags around it see [Build.md](Build.md); for the behaviour test that should sit beside every benchmark see [Testing.md](Testing.md).

---

## The two rows

A benchmark is two journal rows: what to run, and how to run it.

| Row | Class | Journal | Holds |
|---|---|---|---|
| benchmark | a subclass of `foam.core.bench.Benchmark` | `benchmarks.jrl` (`benchmarkDAO`, `src/foam/core/bench/services.jrl:1-18`) | the code, plus size and switch properties |
| runner | `foam.core.bench.BenchmarkRunner` | `benchmarkRunners.jrl` (`benchmarkRunnerDAO`, `services.jrl:99-121`) | `benchmarkId`, `executionCount`, `threadCount`, `oneTimeSetup`, `runPerThread` |

`Benchmark` has three methods (`src/foam/core/bench/Benchmark.js:53-88`, plus `execute` from `ContextAgent`):

- `setup(x, br)` builds the data;
- `execute(x)` is the one operation being timed;
- `teardown(x, br)` cleans up.

```javascript
foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'SelectBenchmark',
  extends: 'foam.core.bench.Benchmark',

  javaImports: [ 'foam.core.auth.User', 'foam.core.bench.BenchmarkResult', 'foam.dao.DAO', 'foam.dao.MDAO', 'foam.lang.X', 'foam.mlang.sink.Count' ],

  properties: [
    { class: 'Int', name: 'rowCount', value: 100000 },
    { class: 'foam.dao.DAOProperty', name: 'dao' }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: `
        DAO dao = new MDAO(User.getOwnClassInfo());
        for ( int i = 0 ; i < getRowCount() ; i++ ) { User u = new User(); u.setId(i); dao.put(u); }
        setDao(dao);
      `
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: 'getDao().select(new Count());'
    }
  ]
});
```

```javascript
p({ class: "foam.core.benchmark.SelectBenchmark", id: "SelectBenchmark", rowCount: 1000000 })
p({ class: "foam.core.bench.BenchmarkRunner", id: "SelectBenchmarkRunner", benchmarkId: "SelectBenchmark",
    threadCount: 1, executionCount: 5, oneTimeSetup: true })
```

The class goes in the pom with `flags: "js&test|java&test"` (e.g. `benchmark/DateFormatBenchmark` in `src/foam/core/pom.js:533`). The two `.jrl` files load from the same directory.

Two sizes of one benchmark are two rows in `benchmarks.jrl` with different properties, not two classes. A runner can also skip `benchmarkId` and build its benchmark inline with `code:`, a BeanShell script by default, as the `Authorizer*` runners in `src/foam/core/benchmark/benchmarkRunners.jrl` do (`BenchmarkRunner.js:532-537`; `Script.language` defaults to BEANSHELL, `src/foam/core/script/Script.js:255-256`).

The runner works on an `fclone()` of the benchmark row, never the stored row (`BenchmarkRunner.js:524-527`), so `setup` can call setters even though rows from a DAO are frozen.

## Run

```bash
./build.sh java-benchmarks:SelectBenchmarkRunner              # one
./build.sh java-benchmarks:SelectBenchmarkRunner,OtherRunner  # several, comma-separated, one JVM
./build.sh java-benchmarks                                    # every runner with enabled: true
```

The task (`tools/JavaTooling.js:402-416`) adds the `test` flag, sets `APP_NAME` to `benchmark` and `APP_ROOT` to `/tmp` unless you set one, empties `/tmp/benchmark` first (`cleanTest`, `JavaTooling.js:257-259`), and boots with `benchmarkRunnerScript` and `-Dfoam.benchmarks=<ids>` (`JavaTooling.js:567-570`).

Each id you pass selects a runner when it equals any of (`BenchmarkRunnerScript.js:100-106`):

- the runner id (`SelectBenchmarkRunner`);
- the runner id with `Runner` removed (`SelectBenchmark`);
- the runner's `benchmarkId`;
- the runner's class simple name, with or without `Runner`. For a plain runner row that is `BenchmarkRunner` or `Benchmark`, so either id selects every enabled runner.

Only runner rows are matched. A benchmark row with no runner pointing at it never runs, whatever id you pass.

The run ends with `DONE RUNNING N BenchmarkRunners`, where N is the number of ids you passed, not the number of runners that ran (`BenchmarkRunnerScript.js:116-117`). A mistyped id still prints `DONE RUNNING 1`.

## Read the result

By default the console shows only the `DONE RUNNING` line. The script filters the logger to WARN (`BenchmarkRunnerScript.js:63-68,84-88`) and the runner logs its result table at INFO (`BenchmarkRunner.js:451-453`). Either raise the level or read the journal:

```bash
./build.sh --log-level:INFO java-benchmarks:SelectBenchmarkRunner
grep -o 'name:"[^"]*"\|operationsS:[0-9.]*\|pass:[0-9]*\|fail:[0-9]*' /tmp/benchmark/journals/benchmarkResults
```

Each result row (`BenchmarkResult`) carries:

- `name`: the runner id;
- `threads`;
- `operationsS`: `threads * executionCount` divided by the average time, in seconds, that one thread spent in `execute` (`BenchmarkRunner.js:419-437`). With one thread, `1000 / operationsS` is milliseconds per execution;
- `operationsST`: `operationsS / threads`;
- `pass` and `fail`: a `fail` above 0 means `execute` threw. The runner logs each exception at ERROR, which the WARN filter lets through.

## Defaults

| Property | Default | Source |
|---|---|---|
| `executionCount` | 1000 executions per thread | `BenchmarkRunner.js:137-141` |
| `threadCount` | every core in Java (`javaFactory`), and never more than the core count | `BenchmarkRunner.js:123-128,280` |
| `oneTimeSetup` | off: each thread runs its own `setup` | `BenchmarkRunner.js:310,343-362` |
| `oneTimeTeardown` | off: each thread runs its own `teardown` | `BenchmarkRunner.js:392-395,441-445` |
| `runPerThread` | off. When on, the runner starts at 1 thread, adds one per run up to `threadCount`, and writes one result row per run | `BenchmarkRunner.js:280-287,455-469` |

With both defaults a run is 1000 executions on every core, and `setup` builds its data once per core. Set `executionCount`, `threadCount` and `oneTimeSetup` on every runner row you write.

## Traps

- **PRODUCTION mode skips the run.** When `appConfig.mode` is PRODUCTION, `execute` logs `Benchmark execution disabled in PRODUCTION` and returns (`BenchmarkRunner.js:253-257`). The console still shows `DONE RUNNING`.
- **`-B` is not a benchmark flag.** `BenchmarkRunnerScript`'s documentation says `./build.sh -BbenchmarkRunnerId` (`BenchmarkRunnerScript.js:12`); no build option does that, and `-B` is the remote-install backup option (`tools/RemoteInstallTooling.js:17`). Use `java-benchmarks:<id>`.
- **Two runners in one JVM can share a result id.** Each run builds an `AUIDGenerator` with the same salt (`BenchmarkRunner.js:275-278`), so the second runner can draw the first runner's `uid` and its row lands as an update to the first. When comparing, run one runner per `java-benchmarks:` call.
- **`Benchmark not found <id>`.** The runner's `benchmarkId` names no row in `benchmarks.jrl` and the runner has no `code:` (`BenchmarkRunner.js:524-529`).

## Method

- **One JVM per sample.** Run the same runner on the same machine for the code before and after the change, each in a fresh `./build.sh java-benchmarks:` call, and keep every log.
- **Make each execution long enough.** Size the data so one `execute` takes at least 100 ms. At around 15 ms per execution, JIT warm-up and GC can swing the average 3x between identical runs.
- **Split a two-part change.** Run three variants (neither part, one part, both) so a loss in one part does not hide inside the other's gain.
- **Scatter sort keys.** If rows come out of the DAO in id order and the sort key follows the id, TimSort finishes the already-ordered run in one pass and the sort looks far faster than it is. Add a second row whose key is scattered, e.g. `i * prime % n`, and report both.
- **Pair it with a test.** A change that must not alter behaviour gets a behaviour test as well as a benchmark: the test proves the same rows come back, the benchmark measures the run. Run the test on the code before the change too, or it proves nothing about the change.
