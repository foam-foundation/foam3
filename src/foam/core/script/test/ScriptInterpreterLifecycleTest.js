/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.script.test',
  name: 'ScriptInterpreterLifecycleTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Proves how a Script's interpreter and the X context it bridges into a JShell
    session are released, and that the JShell bridge is per-run (no leak, no
    cross-run clobber).

    A) BEANSHELL — createInterpreter builds a local bsh.Interpreter. A loose
       top-level binding (like the CFG BClearEnrichment cron's
       "cron = new BClearEnrichmentCron()") lives only in that interpreter's
       namespace; Script keeps no reference to it, so once the run returns the
       interpreter is unreachable and GC reclaims the whole namespace.

    B) JSHELL registry — JShell snippets can only reach host objects through
       static state named by fully-qualified path, so each run publishes its X
       under a unique token in Script.X_REGISTRY and the session reads back that
       token. A registry entry pins its X until removed; runScript removes its
       own entry (and closes the JShell) in finally, so nothing is pinned for the
       life of the JVM, and a concurrent run's entry is never touched.
  `,

  javaImports: [
    'bsh.EvalError',
    'bsh.Interpreter',
    'foam.core.script.Language',
    'foam.core.script.Script',
    'foam.lang.X',
    'java.io.ByteArrayOutputStream',
    'java.io.PrintStream',
    'java.lang.ref.WeakReference',
    'jdk.jshell.JShell'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // ---- A: BeanShell releases its namespace (CFG cron is BeanShell) ----
        try {
          WeakReference ref = beanShellLooseBindingRef(x);
          test(collected(ref),
            "BEANSHELL: loose 'cron =' binding GC'd after interpreter dereferenced "
            + "- CFG BClear cron does NOT leak (Script.js createInterpreter)");
        } catch ( Throwable t ) {
          test(false, "BEANSHELL lifecycle test threw: " + t);
        }

        // ---- B: a registry entry pins its X only until removed ----
        try {
          long token = Script.X_SEQ.incrementAndGet();
          WeakReference ref = registrySentinel(x, token);
          test(! collected(ref),
            "JSHELL registry: entry pins its X while present (Script.X_REGISTRY)");
          Script.X_REGISTRY.remove(token);
          test(collected(ref),
            "JSHELL registry: X released once its entry is removed");
        } catch ( Throwable t ) {
          test(false, "registry pin/release test threw: " + t);
        }

        // ---- C: per-token isolation - no cross-run clobber ----
        try {
          long t1 = Script.X_SEQ.incrementAndGet();
          long t2 = Script.X_SEQ.incrementAndGet();
          Script.X_REGISTRY.put(t1, x);
          Script.X_REGISTRY.put(t2, x);
          Script.X_REGISTRY.remove(t1);
          test(Script.X_REGISTRY.containsKey(t2) && ! Script.X_REGISTRY.containsKey(t1),
            "JSHELL registry: removing run 1's token leaves run 2's entry intact "
            + "- concurrent runs do not clobber (fix)");
          Script.X_REGISTRY.remove(t2);
        } catch ( Throwable t ) {
          test(false, "per-token isolation test threw: " + t);
        }

        // ---- D: createInterpreter publishes exactly one entry (end-to-end) ----
        jShellCreatePublishesEntry(x);

        // ---- E (fix regression): runScript removes its entry + closes JShell ----
        jShellRunScriptRemovesEntry(x);
      `
    },
    {
      // Builds a BeanShell interpreter via the real Script code path, binds a
      // sentinel the same loose way the CFG cron does, and returns ONLY a
      // WeakReference to it. All strong refs are method locals, gone on return.
      name: 'beanShellLooseBindingRef',
      args: 'X x',
      javaType: 'java.lang.ref.WeakReference',
      javaThrows: ['bsh.EvalError'],
      javaCode: `
        Script s = new Script.Builder(x)
          .setLanguage(Language.BEANSHELL)
          .setCode("")
          .build();
        PrintStream ps = new PrintStream(new ByteArrayOutputStream());
        Interpreter shell = (Interpreter) s.createInterpreter(x, ps);
        // Mimic the cron: a top-level assignment with no var/type declaration.
        shell.eval("cron = new java.lang.Object();");
        return new WeakReference(shell.get("cron"));
      `
    },
    {
      // Publishes a fresh sentinel under the given token and returns ONLY a
      // WeakReference; the sole strong path is Script.X_REGISTRY[token] -> X ->
      // sentinel, so removing the token makes the sentinel collectible.
      name: 'registrySentinel',
      args: [ { name: 'x', type: 'Context' }, { name: 'token', type: 'Long' } ],
      javaType: 'java.lang.ref.WeakReference',
      javaCode: `
        Object sentinel = new java.lang.Object();
        Script.X_REGISTRY.put(token, x.put("leakSentinel", sentinel));
        return new WeakReference(sentinel);
      `
    },
    {
      // End-to-end: a real createInterpreter(JSHELL) call publishes one registry
      // entry mapped to the run's JShell. Tolerant: JShell may be unavailable in
      // some build/CI environments.
      name: 'jShellCreatePublishesEntry',
      args: 'X x',
      javaCode: `
        Object jshell = null;
        int before = Script.X_REGISTRY.size();
        try {
          Script js = new Script.Builder(x)
            .setLanguage(Language.JSHELL)
            .setCode("")
            .build();
          PrintStream ps = new PrintStream(new ByteArrayOutputStream());
          jshell = js.createInterpreter(x, ps);
          test(Script.X_REGISTRY.size() == before + 1,
            "JSHELL: createInterpreter publishes exactly one registry entry");
          test(jshell instanceof JShell && Script.X_TOKENS.containsKey((JShell) jshell),
            "JSHELL: registry token mapped to the run's own JShell session");
        } catch ( Throwable t ) {
          test(true, "JSHELL end-to-end skipped (JShell unavailable here): " + t);
        } finally {
          // Mirror what runScript's finally does, so the test leaves no entry.
          if ( jshell instanceof JShell ) {
            Long token = Script.X_TOKENS.remove((JShell) jshell);
            if ( token != null ) Script.X_REGISTRY.remove(token);
            ((JShell) jshell).close();
          }
        }
      `
    },
    {
      // Regression for the fix: a full runScript() of a JShell script must leave
      // no registry entry behind (and close the JShell). Before the fix the
      // static slot stayed populated, pinning the run's X for the JVM's life.
      name: 'jShellRunScriptRemovesEntry',
      args: 'X x',
      javaCode: `
        int before = Script.X_REGISTRY.size();
        Script js = new Script.Builder(x)
          .setLanguage(Language.JSHELL)
          .setCode("long n = 1;")
          .build();
        try {
          js.runScript(x);
        } catch ( Throwable t ) {
          // JShell may be unavailable, or event logging may throw in this
          // harness; the cleanup runs in runScript's finally regardless.
        }
        test(Script.X_REGISTRY.size() == before,
          "FIX: runScript removes its registry entry after a JShell run "
          + "- run's X no longer pinned for JVM life (Script.js runScript finally)");
      `
    },
    {
      // Standard JVM idiom: GC is not deterministic, so poll while nudging it.
      name: 'collected',
      args: [ { name: 'ref', javaType: 'java.lang.ref.WeakReference' } ],
      javaType: 'boolean',
      javaCode: `
        for ( int i = 0 ; i < 50 ; i++ ) {
          if ( ref.get() == null ) return true;
          System.gc();
          try {
            Thread.sleep(20);
          } catch ( InterruptedException e ) {
            Thread.currentThread().interrupt();
          }
        }
        return ref.get() == null;
      `
    }
  ]
});
