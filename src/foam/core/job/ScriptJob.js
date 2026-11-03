/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'ScriptJob',

  extends: 'foam.core.job.Job',

  documentation: `Job that runs BeanShell or JShell code on the server and
    streams what the code prints to the job's output field, one line at a
    time, so progress is visible in the browser.

    The code runs through foam.core.script.Script.evalCode(), so it sees the
    same environment as a script in the scriptDAO: x, print() and, in
    BeanShell, sudo() and runScript(). A Javascript language fails the job,
    because Javascript scripts only run in the browser.

    The job itself is in the context as "job", so the code can report its own
    progress. In BeanShell:
      x.get("job").reportProgress(x, "Loading users", 50);
    JShell is typed, so it needs a cast:
      ((foam.core.job.Job) x.get("job")).reportProgress(x, "Loading users", 50);`,

  javaImports: [
    'foam.core.script.Script',
    'foam.lang.X',
    'java.io.ByteArrayOutputStream',
    'java.io.OutputStream',
    'java.io.PrintStream',
    'java.nio.charset.StandardCharsets'
  ],

  properties: [
    {
      class: 'Enum',
      of: 'foam.core.script.Language',
      name: 'language',
      value: 'BEANSHELL'
    },
    {
      documentation: 'BeanShell or JShell source to run, depending on language.',
      class: 'Code',
      name: 'code',
      required: true
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        final X jobX = x.put("job", this);

        // Collects bytes until a newline, then appends the finished line to
        // output and saves, so a poller sees each line as soon as it is printed.
        OutputStream lines = new OutputStream() {
          ByteArrayOutputStream line = new ByteArrayOutputStream();

          public void write(int b) {
            if ( b == '\\n' ) flushLine();
            else line.write(b);
          }

          public void close() {
            if ( line.size() > 0 ) flushLine();
          }

          void flushLine() {
            out(line.toString(StandardCharsets.UTF_8));
            line.reset();
            save(jobX);
          }
        };

        Script script = new Script();
        script.setLanguage(getLanguage());
        script.setCode(getCode());

        try ( PrintStream ps = new PrintStream(lines, true, StandardCharsets.UTF_8) ) {
          script.evalCode(jobX, ps);
        } catch ( RuntimeException e ) {
          throw e;
        } catch ( Exception e ) {
          throw new RuntimeException(e);
        }
      `
    }
  ]
});
