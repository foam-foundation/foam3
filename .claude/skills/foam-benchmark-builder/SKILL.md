---
name: foam-benchmark-builder
description: Use when timing FOAM code - a DAO operation, a sink, a sort, an agent, a parser - before and after a performance change, or when a benchmark run prints only "DONE RUNNING N BenchmarkRunners" and no numbers, two runners in one run overwrote each other's result, a benchmark needs seed data or a size knob, or "how do I run a benchmark from the command line". Covers foam.core.bench.Benchmark, BenchmarkRunner, benchmarks.jrl, benchmarkRunners.jrl and the java-benchmarks build task.
---

# FOAM benchmark builder

The framework facts - the two journal rows, the `java-benchmarks` task, which ids it matches, the runner defaults, the result fields and the traps, each cited to source - are in `doc/guides/Benchmarks.md`. Read it before writing a runner row. This skill is the workflow on top of it.

## Steps

1. **Write the benchmark.** A `foam.core.bench.Benchmark` subclass: `setup(x, br)` builds the data, `execute(x)` is the one timed operation. Pom entry `flags: "js&test|java&test"`. The guide's "The two rows" has a complete example.
2. **Write both rows** beside it. A benchmark row with no runner never runs:

   ```javascript
   p({ class: "foam.core.benchmark.SelectBenchmark", id: "SelectBenchmark", rowCount: 1000000 })
   p({ class: "foam.core.bench.BenchmarkRunner", id: "SelectBenchmarkRunner", benchmarkId: "SelectBenchmark",
       threadCount: 1, executionCount: 5, oneTimeSetup: true })
   ```

   Always set `threadCount`, `executionCount` and `oneTimeSetup`: the defaults are every core, 1000 executions per thread, and `setup` once per thread. Two sizes or sinks are two `benchmarks.jrl` rows, not two classes.
3. **Run one runner per call** (two runners in one JVM can draw the same result `uid`, so the second row overwrites the first):

   ```bash
   ./build.sh --log-level:INFO java-benchmarks:SelectBenchmarkRunner
   ```

   The id may be the runner id, the runner id without `Runner`, or the `benchmarkId`. Do not pass `Benchmark` or `BenchmarkRunner`: those match every enabled runner.
4. **Read the number.** `DONE RUNNING N` counts the ids passed, not runners run, so it proves nothing. Without `--log-level:INFO` the table is filtered out; for a script read the row instead:

   ```bash
   grep -o 'name:"[^"]*"\|operationsS:[0-9.]*\|pass:[0-9]*\|fail:[0-9]*' /tmp/benchmark/journals/benchmarkResults
   ```

   No row at all: the id matched no runner, or `appConfig` is PRODUCTION. `fail` above 0: `execute` threw; the ERROR is in the log.

## Before and after

Same runner, same machine, a fresh JVM per sample. Swap the code under test between loops and keep every log (`$S` is the scratchpad):

```bash
for v in before after; do
  cp $S/Target-$v.js src/path/Target.js
  ./build.sh java-benchmarks:SelectBenchmarkRunner > $S/$v.log 2>&1
  grep -o 'operationsS:[0-9.]*' /tmp/benchmark/journals/benchmarkResults
done
```

The task empties `/tmp/benchmark` at the start of each call, so each grep sees only that sample. Restore the real file after the loop.

Size the data so one `execute` takes at least 100 ms. When a change has two parts, run three variants (neither, one, both). For a sort, add a second row with a scattered key (`i * prime % n`) and report both. The guide's "Method" section gives the reasons.

## Not a test

A change that must not alter behaviour gets a test as well as a benchmark (`foam-test-builder`): the test proves the same rows and sinks come back, the benchmark measures the run. The test runs on the code before the change too, or it proves nothing about the change.
