/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job',
  name: 'PythonJob',

  extends: 'foam.core.job.Job',

  documentation: `Job that launches a Python subprocess and streams its output
    to the job's output field so progress is visible in the browser.

    By default PythonJob uses uv to manage the Python environment: it installs
    the listed requirements on first run and resolves them from uv's cache on
    every subsequent run, so the cost is paid once per machine. Set useUv to
    false to skip environment management entirely — the supplied command must
    then resolve its own interpreter and packages.

    command holds the Python-level arguments only (module name and its flags).
    The interpreter and any uv prefix are prepended at runtime by buildCommand_().

    Subclasses can override parseProgress_(line) to convert domain-specific
    output lines into a 0-100 completion percentage that the browser displays
    as a progress bar.`,

  javaImports: [
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.InputStreamReader',
    'java.util.ArrayList',
    'java.util.List'
  ],

  properties: [
    {
      documentation: `Python-level arguments: the module or script to run and its
        flags. The interpreter and any uv preamble are prepended automatically.
        Example: ["-m", "mlx_lm.finetune", "--model", "Qwen2.5-7B", "--iters", "100"]`,
      class: 'StringArray',
      name: 'command',
      required: true
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
    },
    {
      documentation: `When true (the default), the subprocess is launched via uv run,
        which installs requirements on first use and resolves them from cache
        thereafter. Set to false when the caller manages its own environment.`,
      class: 'Boolean',
      name: 'useUv',
      value: true
    },
    {
      documentation: `Full path to the uv binary. Defaults to "uv" (resolved via
        PATH). Set an absolute path when the server process does not inherit the
        user's PATH, e.g. "/usr/local/bin/uv".`,
      class: 'String',
      name: 'uvPath',
      value: 'uv'
    },
    {
      documentation: `Python version for uv to use, e.g. "3.11". When empty uv
        picks its default. Only used when useUv is true.`,
      class: 'String',
      name: 'pythonVersion'
    },
    {
      documentation: `PyPI packages uv should install before running. Passed as
        --with arguments. Only used when useUv is true.
        Example: ["mlx", "mlx-lm"]`,
      class: 'StringArray',
      name: 'requirements'
    },
    {
      documentation: `Path to a requirements.txt file. Passed as --with-requirements.
        Use instead of, or alongside, the requirements list. Only used when
        useUv is true.`,
      class: 'String',
      name: 'requirementsFile'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        if ( getUseUv() ) {
          try {
            new ProcessBuilder(getUvPath(), "--version").redirectErrorStream(true).start().waitFor();
          } catch ( java.io.IOException e ) {
            throw new RuntimeException(
              "uv not found at '" + getUvPath() + "'. Python jobs require uv. " +
              "Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
            );
          } catch ( InterruptedException e ) {
            Thread.currentThread().interrupt();
          }
        }

        String[] cmd = buildCommand_();
        out("$ " + String.join(" ", cmd));
        save(x);

        ProcessBuilder pb = new ProcessBuilder(cmd);
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
            throw new RuntimeException("Python process exited with code " + exit);
        } catch ( java.io.IOException | InterruptedException e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      documentation: `Assembles the full OS-level command from the job's properties.
        When useUv is true the result is:
          [uv, run, (--python ver)?, (--with req)*, (--with-requirements file)?, python, ...command]
        When useUv is false:
          [python3, ...command]`,
      name: 'buildCommand_',
      type: 'String[]',
      javaCode: `
        List<String> cmd = new ArrayList<>();
        if ( getUseUv() ) {
          cmd.add(getUvPath());
          cmd.add("run");
          if ( ! getPythonVersion().isEmpty() ) {
            cmd.add("--python");
            cmd.add(getPythonVersion());
          }
          for ( String req : getRequirements() ) {
            cmd.add("--with");
            cmd.add(req);
          }
          if ( ! getRequirementsFile().isEmpty() ) {
            cmd.add("--with-requirements");
            cmd.add(getRequirementsFile());
          }
          cmd.add("python");
        } else {
          cmd.add("python3");
        }
        for ( String arg : getCommand() ) cmd.add(arg);
        return cmd.toArray(new String[0]);
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
