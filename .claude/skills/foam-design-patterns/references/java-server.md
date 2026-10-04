# Java inside `javaCode`

Server code is reviewed for what it allocates, what it shares between threads, and what it logs.

| Principle | One-line test |
|---|---|
| An allocation on a per-row path draws a comment | is this line inside a loop, a `put`, or a `f()`? |
| Shared mutable state is synchronized | any collection or counter touched from two threads? |
| `Loggers.logger(x, this)`, comma tokens | any `+` inside a log call? |
| Log or throw, never swallow; keep the cause | any `catch` that neither logs nor rethrows? |
| `fclone()` before mutating a DAO result | any setter on the return of `find`/`select`/`put`? |

### An allocation on a per-row path draws a comment
Garbage in a loop, a `put`, or a predicate `f()` multiplies by rows.
Don't: `new Builder(x)` per call; `Long.toString(id)`; `substring` for one char; a `SimpleDateFormat` or `Pattern` per call; `new HashSet<>(list)` per check; `ArraySink` then loop
Do:    a constructor; `sb.append(id)`; `charAt(len - 1)`; a hoisted constant or transient cached field; `select(new AbstractSink() { put(...) { ...; d.detach(); } })`
Review asked: "Rather than selecting into an ArraySink, you could just process directly... you don't generate garbage." (PR #854)

### Shared mutable state is synchronized or concurrent
A `HashMap` or counter touched from two threads is a race; `notify()` wakes one arbitrary waiter.
Don't: `static HashMap`; `count++` in a service; `notify()`; an unbounded queue
Do:    `ConcurrentHashMap`/`AtomicLong`, or `synchronized: true` on the method axiom; `notifyAll()`; `new LinkedBlockingQueue<>(128)`

### One logger per method; comma-separated tokens
`Loggers.logger(x, this)` prefixes the class; concatenation builds the string even when the level is off.
Don't: `logger.error("UploadAgent error: " + msg + " for " + id)`
Do:    `Logger logger = Loggers.logger(x, this); logger.warning("parse", "id", id, msg)`; the level word is never in the message
Review asked: "'error' is redundant. An error log output will already contain the 'error' string." (PR #4549)

### Log or throw, never swallow; keep the cause
A swallowed exception hides the failure; a rethrow without the cause hides the origin.
Don't: `catch (Exception e) { }`; `throw new RuntimeException("failed")`; `new ClientRuntimeException(MSG);` never thrown
Do:    `catch (Throwable t) { logger.error(...); throw new RuntimeException(t); }`; a `// nop` catch says why it is empty

### Level-gate diagnostics; never log a payload on a hot or PII path
A `debug` with a request body is a PII leak the moment the level is raised.
Don't: `logger.debug("payload", payload)` on every request
Do:    an `EventRecord` on failure or when debug is enabled; one WARN aggregating many parse failures

### `SafetyUtil`, `fclone`, and set-then-clear
DAO results are frozen; `null` checks miss whitespace; clearing needs the value and the isSet flag.
Don't: `s != null && ! s.isEmpty()`; `obj.setX(v)` on a `find` result; `obj.setX(null)` to unset
Do:    `! SafetyUtil.isEmpty(s)`; `obj = (T) obj.fclone(); obj.setX(v); dao.put_(x, obj)`; `obj.setX(0); obj.clearX();`

### PM in try/finally; PM before a hand-rolled timer
`PMDAO` already counts every DAO op; a `System.nanoTime()` accumulator disagrees with it.
Don't: `long t0 = System.nanoTime(); ... total += System.nanoTime() - t0;`
Do:    `PM pm = PM.create(x, this, "scan"); try { ... pm.log(x); } catch (Throwable t) { pm.error(x, t); throw t; }`

### String-form `args:` with primitives; `javaThrows` listed
The array form is boilerplate; boxed types allocate per call; hidden throws surprise callers.
Don't: `args: [ { name: 'x', type: 'X' }, { name: 'id', type: 'Long' } ]`
Do:    `args: 'X x, long id'`; `javaThrows: ['java.io.IOException']`
Review asked: "It is more efficient to use type: 'long', instead of 'Long' because it is a primitive type"

### Flatten control flow; extract the named method
`else` after `return`, nested `if`s, or a repeated try/finally hide the shape of the logic.
Don't: `if ( ! x ) return false; else return true;`; two copies of `try { set } finally { clear }`
Do:    `return x;`; guard clauses; a flat `else if` chain; one named method called twice

### Do work once
Config resolved per call, a lock per id, or a lookup inside a loop multiplies a fixed cost by traffic.
Don't: `x.get("appConfig")` per log line; a `synchronized` block per generated id; `dao.find` inside `for`
Do:    resolve at construction into a property; double-checked init plus `AtomicInteger`; one `select` then a map
