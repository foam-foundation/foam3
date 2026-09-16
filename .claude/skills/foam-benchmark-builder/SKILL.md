---
name: foam-benchmark-builder
description: Use when timing FOAM code - a DAO operation, a sink, a sort, an agent, a parser - before and after a performance change, or when a benchmark run prints only "DONE RUNNING N BenchmarkRunners" and no numbers, two runners in one run overwrote each other's result, a benchmark needs seed data or a size knob, or "how do I run a benchmark from the command line". Covers foam.core.bench.Benchmark, BenchmarkRunner, benchmarks.jrl, benchmarkRunners.jrl and the java-benchmarks build task.
---

# FOAM benchmark builder

A benchmark is a `foam.core.bench.Benchmark`: `setup(x, br)` once, then `execute(x)` N times on T threads, timed by PM and written to `benchmarkResultDAO` as executions per second. A `BenchmarkRunner` row decides N and T and names the benchmark; the `java-benchmarks` build task runs runner ids.

## Files

| File | Holds | Registered by |
|---|---|---|
| `<Name>Benchmark.js` | `extends: 'foam.core.bench.Benchmark'`, `setup`, `execute` | pom `files:` with `flags: 'js&test\|java&test'` |
| `benchmarks.jrl` | one `p({class, id, ...props})` per benchmark shape; sizes and switches live here | auto-loaded from the pom's directory |
| `benchmarkRunners.jrl` | one `p({class: "foam.core.bench.BenchmarkRunner", id, benchmarkId, executionCount, threadCount, oneTimeSetup})` per run shape | same |

Two shapes of one benchmark (a different size, a different sink) are two rows in `benchmarks.jrl` setting properties, not two classes. A runner can also build the benchmark inline with `code:` (`foam/core/benchmark/benchmarkRunners.jrl`, the `Authorizer*` runners) when a `Builder` call reads better than journal properties.

```javascript
foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'SelectBenchmark',
  extends: 'foam.core.bench.Benchmark',

  javaImports: [ 'foam.core.auth.User', 'foam.core.bench.BenchmarkResult', 'foam.dao.DAO', 'foam.dao.MDAO', 'foam.lang.X', 'foam.mlang.sink.Count' ],

  properties: [
    { class: 'Int', name: 'rowCount', value: 100000 },
    { class: 'foam.dao.DAOProperty', name: 'dao' }      // the property class for a DAO built in setup
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: `
        DAO dao = new MDAO(User.getOwnClassInfo());
        for ( int i = 0 ; i < getRowCount() ; i++ ) { User u = new User(); u.setId(i); dao.put(u); }
        setDao(dao);                                     // the runner fclones the row before setup, so setters work
      `
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: 'getDao().select(new Count());'          // one timed operation
    }
  ]
});
```

```javascript
p({ class: "foam.core.benchmark.SelectBenchmark", id: "SelectBenchmark", rowCount: 1000000 })
p({ class: "foam.core.bench.BenchmarkRunner", id: "SelectBenchmarkRunner", benchmarkId: "SelectBenchmark",
    threadCount: 1, executionCount: 5, oneTimeSetup: true })
```

## Run

```bash
./build.sh java-benchmarks:SelectBenchmarkRunner              # one runner id, the runner's id not the benchmark's
./build.sh java-benchmarks:SelectBenchmarkRunner,OtherRunner  # several, comma-separated, one JVM
./build.sh java-benchmarks                                    # every runner with enabled: true
```

The task (`foam3/tools/JavaTooling.js`, `javaBenchmarks`) adds the `test` flag, builds the jar, and boots with `benchmarkRunnerScript` as the boot script and `-Dfoam.benchmarks=<ids>`. `APP_ROOT` becomes `/tmp` unless set, so the app runs from `/tmp/benchmark`.

## Read the result

The console ends with `DONE RUNNING N BenchmarkRunners` and nothing else: `BenchmarkRunnerScript` filters the logger to WARN and the runner logs its table at INFO. The result is in the journal:

```bash
grep -o 'name:"[^"]*"\|operationsS:[0-9.]*\|pass:[0-9]*\|fail:[0-9]*' /tmp/benchmark/journals/benchmarkResults
```

`operationsS` is `threads * executionCount / averageTotalTime`, executions per second over the whole sample; `1000 / operationsS` is milliseconds per execution. `fail` above 0 means `execute` threw; the runner logs the exception at ERROR, which the filter lets through.

## Before and after

Same runner, same machine, a fresh JVM per sample, the result file removed between samples. Swap the code under test between loops and keep every log:

```bash
for v in before after; do
  cp $S/Target-$v.js src/path/Target.js
  rm -f /tmp/benchmark/journals/benchmarkResults
  ./build.sh java-benchmarks:SelectBenchmarkRunner > $S/$v.log 2>&1
  grep -o 'operationsS:[0-9.]*' /tmp/benchmark/journals/benchmarkResults
done
```

Size the data so one `execute` takes at least 100 ms; at 15 ms per execution JIT warmup and GC swing the average by 3x between identical runs. When a change has two parts, run three variants (neither, one, both) so a loss in one part does not hide inside the other's gain.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `DONE RUNNING` and no numbers | result logged at INFO, filtered to WARN | read `benchmarkResults`, above |
| second runner's row shows the first runner's `uid` as a `p(` update | two runners in one JVM drew the same result id | one runner per `java-benchmarks:` invocation when comparing |
| `Benchmark not found <id>` | the runner's `benchmarkId` names no row in `benchmarks.jrl`, and the runner has no `code:` | add the row, or pass the runner id rather than the benchmark id |
| run takes minutes, or the box swaps | `executionCount` defaults to 1000 and `threadCount` to every core (`BenchmarkRunner.js`) | set both on the runner row |
| `Object is frozen` in `setup` | a caller took the row from `benchmarkDAO` and ran `setup` on it | go through the runner, which fclones the row first (`getBenchmark`) |
| `setup` ran once per thread | `oneTimeSetup` unset | `oneTimeSetup: true` on the runner row |
| a sort benchmark reads faster than the sort could be | rows came out of the DAO in id order and the key follows the id, so TimSort finished the ordered run in one pass | scatter the key (`i * prime % n`) in a second row and report both |
| `./build.sh -B<id>` does nothing | the doc comment in `BenchmarkRunnerScript.js` names a flag `build.sh` does not have | `java-benchmarks:<id>` |

## Not a test

A `foam.core.test.Test` says pass or fail; a benchmark says how fast. A change that must not alter behaviour gets both: the test proves the same rows and sinks come back, the benchmark measures the run. The test runs on the code before the change too, or it proves nothing about the change.
