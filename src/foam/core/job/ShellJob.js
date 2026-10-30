/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'ShellJob',

  extends: 'foam.core.job.Job',

  documentation: `Job that runs a shell script in a subprocess and streams its
    output to the job's output field so progress is visible in the browser.

    The script is passed to the shell with -c, so it may contain several lines,
    pipes, redirects and any other shell syntax. A non-zero exit code fails the
    job; add "set -e" at the top of the script to stop at the first failing
    command.

    Subclasses can override parseProgress_(line) to convert domain-specific
    output lines into a 0-100 completion percentage that the browser displays
    as a progress bar.`,

  javaImports: [
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.InputStreamReader'
  ],

  properties: [
    {
      documentation: `The shell script to run. Example:
        set -e
        cd /tmp
        ls -l | wc -l`,
      class: 'Code',
      name: 'script',
      required: true
    },
    {
      documentation: `Shell used to run the script. Defaults to "/bin/sh". Set to
        "/bin/bash" or "/bin/zsh" when the script uses shell-specific syntax.`,
      class: 'String',
      name: 'shell',
      value: '/bin/sh'
    },
    {
      documentation: 'Working directory for the subprocess. Defaults to the JVM working directory.',
      class: 'String',
      name: 'workingDir'
    },
    {
      documentation: 'Extra environment variables to inject as KEY=VALUE strings.',
      class: 'StringArray',
      name: 'envVars'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        out("$ " + getScript());
        save(x);

        ProcessBuilder pb = new ProcessBuilder(getShell(), "-c", getScript());
        pb.redirectErrorStream(true);
        if ( ! getWorkingDir().isEmpty() )
          pb.directory(new File(getWorkingDir()));
        for ( String kv : getEnvVars() ) {
          int eq = kv.indexOf('=');
          if ( eq > 0 ) pb.environment().put(kv.substring(0, eq), kv.substring(eq + 1));
        }

        try {
          Process process = pb.start();
          try ( BufferedReader reader = new BufferedReader(
                  new InputStreamReader(process.getInputStream())) ) {
            String line;
            while ( (line = reader.readLine()) != null ) {
              out(line);
              int pct = parseProgress_(line);
              if ( pct >= 0 ) setProgress(pct);
              save(x);
            }
          }
          int exit = process.waitFor();
          if ( exit != 0 )
            throw new RuntimeException("Shell process exited with code " + exit);
        } catch ( java.io.IOException | InterruptedException e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      documentation: `Override in subclasses to extract a completion percentage from
        a subprocess output line. Return a value in [0, 100], or -1 if this line
        carries no progress information. The base implementation always returns -1,
        which leaves the progress bar in the indeterminate state.`,
      name: 'parseProgress_',
      args: 'String line',
      type: 'int',
      javaCode: `return -1;`
    }
  ]
});
