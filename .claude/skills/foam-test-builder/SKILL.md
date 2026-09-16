---
name: foam-test-builder
description: Use when creating, registering, running, or fixing a FOAM test - a `*Test.js` run through `server-tests`, `client-tests` or `run-tests` - when choosing server (Java) versus client (JS) and a base class, wiring the pom flag or the `tests.jrl` row, or when a test will not run ("Test not run", "ERROR CREATING", "this.test is not a function", zero assertions, "Client tests timed out"). Invoke before writing or registering, since the language, flag and registration rules are not visible from the test class.
---

# FOAM test builder

A test is a `foam.core.test.Test` (server, `javaCode`) or `foam.core.test.JSTest` (client, JS `code`) whose `runTest` holds assertions. Whether it runs is decided by three things that must agree: the language, the pom flag, and a row in a loaded `tests.jrl`. A test the runner cannot find in `testDAO` reports `Test not run`, not a failure.

## Pick the side

| Behaviour under test | Side | Base class | `runTest` |
|---|---|---|---|
| server logic: DAO decorators, rules, `javaCode` methods, services, journal replay | server | `foam.core.test.Test` | `javaCode` |
| client logic: views, reactivity, `generateJava: false` code, JS-only mlang or parsers | client | `foam.core.test.JSTest` | `code: function(x)` |

Code marked `generateJava: false` has no Java and cannot run server-side; `javaCode` has no JS and cannot run in the browser. A change that spans both sides is two tests, one per side.

## Write it

```javascript
foam.CLASS({
  package: 'foam.dao',
  name: 'MyServerTest',
  extends: 'foam.core.test.Test',          // language defaults to BEANSHELL: runs server-side
  javaImports: [ 'foam.core.auth.User', 'foam.dao.DAO', 'foam.dao.MDAO', 'foam.lang.X', 'foam.mlang.sink.Count' ],
  methods: [
    {
      name: 'runTest',
      javaCode: `
        DAO dao = new MDAO(User.getOwnClassInfo());
        X   tx  = x.put("userDAO", dao);   // supply what the code under test reads from x
        test(dao.find(1L) == null, "no row yet");
        expect(((Count) dao.select(new Count())).getValue(), 0L, "count of an empty DAO");
      `
    }
  ]
});
```

```javascript
foam.CLASS({
  package: 'foam.dao',
  name: 'MyClientTest',
  extends: 'foam.core.test.JSTest',        // language JS: the server keeps a stub and skips it
  requires: [ 'foam.dao.ArraySink' ],
  methods: [
    {
      name: 'runTest',
      code: function(x) {
        var sink = this.ArraySink.create();
        x.test(sink.array.length === 0, 'starts empty');   // x.test, never this.test
      }
    }
  ]
});
```

`test(boolean, message)` and `expect(value, expected, message)` are methods on the test instance in Java, and on the sub-context `x` in JS (`Test.js`), so JS writes `x.test(...)`. `async function` with `await` is fine in JS. Objects from `find` and `select` are frozen: `fclone()` before a setter.

## Register it

| Test | pom `files:` flag | `tests.jrl` row |
|---|---|---|
| server test | `js&test\|java&test` | `p({"class":"pkg.MyServerTest","id":"MyServerTest","description":"..."})` |
| client test | `js&test\|java&test` too | same, plus `"language": 0` |
| standalone `.java` test | `javaFiles:` entry, `flags: "test"` | same as server |

The client row keeps the `java&test` half because the server instantiates every journalled test at boot, when it replays `tests.jrl` into `testDAO`; a JS-only class throws `ERROR CREATING: pkg.MyClientTest` there. The Java stub instantiates and is skipped by `language: 0`.

A `tests.jrl` loads because the pom walk reaches its directory: the directory of a loaded `pom.js`, or any directory under it that has no pom of its own (`pmake.js`). Two things stop the walk without the `test` flag: any directory named `test` or `tests` is skipped, and any `tests.jrl` is skipped (`JournalMaker.js`), which is why a test pom sits under `projects:` with `flags: 'test'`. `journalFiles:` is an exclude list, not a registration. A journal never goes in `files:`, which expects JS modules and fails the build with `Cannot find module .../tests.js`. No comments inside a `.jrl`.

## Run it

```bash
./build.sh -W9090 server-tests:MyServerTest              # server side; -W dodges a dev server on 8080
./build.sh -W9090 client-tests:MyClientTest,OtherJsTest  # client side, comma-separated ids; add test-headed to watch the browser
./build.sh -W9090 run-tests:MyServerTest,MyClientTest    # both sides in one build
./build.sh --log-level:INFO server-tests:MyServerTest    # keep INFO in the output; default is ERROR
```

`server-tests:` regenerates and compiles production code and tests in one pass, so no `-o` first. The build is incremental; `-c` and `-XcleanAll` only cost time.

## Read the result

Trust the tally and the `✘ FAILURE:` lines, never the exit code: the build exits non-zero on boot assertions and on other suites' failures.

```bash
grep -niE "PASSED:|FAILED:|✘ FAILURE|Test not run|ERROR CREATING" test.log
```

Boot prints `Assertion failed: Axiom name conflict ...`, `Could not find any registered class ...`, `Element N of actions is not an instance of Action ...` on every run; none of them is the test. Client results arrive after the `BrowserAgent ... Launching` line, from the browser; a terminal `Client tests made no progress for 30 seconds after N results. Tests may still be running in the browser.` means the browser has not reported back yet, not that a test failed.

## When it will not run

| Symptom | Cause | Fix |
|---|---|---|
| `WARNING :: Test not run: MyTest. Mode: server. Possible client/server/suite mismatch or typo.` on a `JSTest` | expected: `language: 0` makes the server skip it | run it with `client-tests:` |
| the same on a server `Test` | not in `testDAO`: no row, a `tests.jrl` the walk never reached, or an id typo; the warning only fires for ids named on the command line | add the row where the walk reaches it, and check the id |
| nothing runs, no warning | `enabled: false` on the row; both runners select `EQ(Test.ENABLED, true)` first | drop the field or set it true |
| `ERROR CREATING: pkg.MyClientTest` at replay | flagged `js&test` only, no Java class to instantiate | `js&test\|java&test` |
| `Cannot find module .../tests.js` from pmake | the journal is in `files:` | remove it; a `.jrl` beside a loaded pom needs no entry |
| `this.test is not a function` | `this.test` in a JS `runTest` | `x.test(...)` |
| a JS test passes on the server with 0 assertions | its Java `runTest` is the NOOP stub | `language: 0` on the row, or `extends: JSTest` |
| `Object is frozen` | a setter on a `find`/`select` result | `fclone()`, then `put_()` the clone |

## Worked examples

- server, direct Java: `src/foam/dao/SequenceNumberDAOTest.js`
- server, inline BeanShell in a journal with no class of its own: the `FixedSizeDAOTest` row in `src/foam/dao/tests.jrl`
- client JS: `src/foam/parse/test/QueryParserJSTest.js`
- pure JS unit: `src/foam/parse/test/SimpleQueryParserTest.js`
