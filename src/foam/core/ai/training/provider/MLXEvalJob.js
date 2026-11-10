/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.training.provider',
  name: 'MLXEvalJob',
  extends: 'foam.core.job.PythonJob',

  documentation: `
    Runs inference evaluation against a set of EvalPrompts and stores
    scored EvalResult records for each prompt.

    Before the subprocess starts, execute() reads all enabled EvalPrompts
    from evalPromptDAO, stages them in pendingPrompts_, and creates an EvalRun
    record. PythonJob calls writeStdin_() on a background thread to serialize
    the prompts as JSON to the subprocess stdin. The Python script reads them
    from stdin, runs inference on each prompt, checks the rubric, and prints
    one EVAL_RESULT line per prompt. parseProgress_() parses each line and
    calls storeResult_() to persist an EvalResult.

    On completion the EvalRun is updated with final pass counts and status.
  `,

  javaImports: [
    'foam.core.ai.training.EvalPrompt',
    'foam.core.ai.training.EvalResult',
    'foam.core.ai.training.EvalRun',
    'foam.core.ai.training.TrainingRun',
    'foam.core.job.JobStatus',
    'foam.core.logger.Loggers',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lib.json.Outputter',
    'java.io.IOException',
    'java.io.OutputStream',
    'java.io.OutputStreamWriter',
    'java.nio.charset.StandardCharsets',
    'java.util.ArrayList',
    'java.util.List',
    'java.util.UUID',
    'java.util.regex.Matcher',
    'java.util.regex.Pattern'
  ],

  properties: [
    {
      class: 'String',
      name: 'modelPath',
      documentation: 'HuggingFace model id or local path, e.g. mlx-community/Qwen2.5-Coder-7B-Instruct-4bit.',
      required: true
    },
    {
      class: 'String',
      name: 'adapterPath',
      documentation: 'Adapter directory or fused model path. Leave empty to evaluate the base model.'
    },
    {
      class: 'String',
      name: 'trainingRunId',
      documentation: 'Optional FK into trainingRunDAO — the run that produced this checkpoint.'
    },
    {
      class: 'Int',
      name: 'maxTokens',
      documentation: 'Maximum tokens to generate per prompt.',
      value: 512
    },
    {
      class: 'Float',
      name: 'temperature',
      documentation: 'Sampling temperature.',
      value: 0.1,
      javaValue: '0.1f'
    },
    {
      class: 'Float',
      name: 'repetitionPenalty',
      documentation: 'Repetition penalty applied via logits processor.',
      value: 1.1,
      javaValue: '1.1f'
    },
    {
      class: 'String',
      name: 'evalRunId',
      documentation: 'Set at execute time when the EvalRun is created.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Object',
      javaType: 'java.util.List',
      name: 'pendingPrompts_',
      transient: true,
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        setX(x);

        // Resolve adapter path from TrainingRun when not set directly.
        if ( getAdapterPath().isEmpty() && ! getTrainingRunId().isEmpty() ) {
          DAO trainRunDAO = (DAO) x.get("trainingRunDAO");
          TrainingRun tr  = (TrainingRun) trainRunDAO.find(getTrainingRunId());
          if ( tr != null && ! tr.getAdapterPath().isEmpty() )
            setAdapterPath(tr.getAdapterPath());
        }

        DAO promptDAO = (DAO) x.get("evalPromptDAO");
        DAO runDAO    = (DAO) x.get("evalRunDAO");
        DAO resultDAO = (DAO) x.get("evalResultDAO");

        out("╔══════════════════════════════════════════════════════╗");
        out("║             MLX Evaluation Job Started               ║");
        out("╚══════════════════════════════════════════════════════╝");
        out("  Model   : " + getModelPath());
        out("  Adapter : " + (getAdapterPath().isEmpty() ? "(none — base model)" : getAdapterPath()));
        out("──────────────────────────────────────────────────────");

        // Load enabled prompts.
        ArraySink sink = (ArraySink) promptDAO
          .where(foam.mlang.MLang.EQ(EvalPrompt.ENABLED, true))
          .select(new ArraySink());
        List prompts = sink.getArray();
        if ( prompts.isEmpty() ) {
          out("  WARN: no enabled EvalPrompts found — nothing to evaluate.");
          return;
        }
        out("  Prompts : " + prompts.size());
        out("──────────────────────────────────────────────────────");

        // Stage prompts for writeStdin_ — PythonJob calls it on a background thread when the subprocess starts.
        setPendingPrompts_(prompts);

        // Create EvalRun before subprocess starts.
        EvalRun run = new EvalRun();
        run.setId(UUID.randomUUID().toString());
        run.setTrainingRunId(getTrainingRunId());
        run.setModelPath(getModelPath());
        run.setAdapterPath(getAdapterPath());
        run.setStatus(JobStatus.RUNNING);
        run.setStartedAt(new java.util.Date());
        run.setPromptCount(prompts.size());
        runDAO.put(run);
        setEvalRunId(run.getId());
        save(x);
        out("  EvalRun ID: " + run.getId());
        out("──────────────────────────────────────────────────────");

        try {
          super.execute(x);
          JobStatus finalStatus = getStatus() == JobStatus.SUSPENDED
            ? JobStatus.SUSPENDED : JobStatus.COMPLETED;
          EvalRun done = (EvalRun) runDAO.find(run.getId());
          if ( done != null ) {
            EvalRun updated = (EvalRun) done.fclone();
            updated.setStatus(finalStatus);
            updated.setCompletedAt(new java.util.Date());
            runDAO.put(updated);
            out("──────────────────────────────────────────────────────");
            out("  Status    : " + finalStatus.getLabel());
            out("  Pass rate : " + updated.getPassCount() + "/" + updated.getPromptCount()
              + " (" + String.format("%.0f%%", updated.getPassRate() * 100) + ")");
          }
        } catch ( RuntimeException e ) {
          out("  ERROR: " + e.getMessage());
          Loggers.logger(x, this).error("execute-error", "evalRunId", getEvalRunId(), e);
          EvalRun failed = (EvalRun) runDAO.find(run.getId());
          if ( failed != null ) {
            EvalRun updated = (EvalRun) failed.fclone();
            updated.setStatus(JobStatus.FAILED);
            runDAO.put(updated);
          }
          throw e;
        } finally {
          setPendingPrompts_(null);
        }
        out("╚══════════════════════════════════════════════════════╝");
      `
    },
    {
      name: 'buildCommand_',
      type: 'String[]',
      javaCode: `
        List<String> cmd = new ArrayList<>();
        cmd.add("-u");
        cmd.add("eval_inference.py");
        cmd.add("--model");           cmd.add(getModelPath());
        if ( ! getAdapterPath().isEmpty() ) {
          cmd.add("--adapter-path");  cmd.add(getAdapterPath());
        } else {
          cmd.add("--no-adapter");
        }
        cmd.add("--max-tokens");        cmd.add(String.valueOf(getMaxTokens()));
        cmd.add("--temperature");       cmd.add(String.valueOf(getTemperature()));
        cmd.add("--repetition-penalty");cmd.add(String.valueOf(getRepetitionPenalty()));
        setCommand(cmd.toArray(new String[0]));
        return super.buildCommand_();
      `
    },
    {
      name: 'parseProgress_',
      args: 'String line',
      type: 'int',
      javaCode: `
        String clean = line.replaceAll("\\\\033\\\\[[^a-zA-Z]*[a-zA-Z]", "");
        Loggers.logger(getX(), this).debug("parseProgress", "clean", clean);

        if ( clean.startsWith("EVAL_RESULT ") ) {
          storeResult_(clean.substring("EVAL_RESULT ".length()));
          return -1;
        }

        // EVAL_PROGRESS i/total — drive the progress bar.
        Matcher pm = Pattern.compile("EVAL_PROGRESS (\\\\d+)/(\\\\d+)").matcher(clean);
        if ( pm.find() ) {
          int done  = Integer.parseInt(pm.group(1));
          int total = Integer.parseInt(pm.group(2));
          return total > 0 ? Math.min(100, done * 100 / total) : -1;
        }

        return -1;
      `
    },
    {
      name: 'storeResult_',
      args: 'String payload',
      javaCode: `
        // Payload format (space-separated key=value; hits is pipe-separated):
        //   promptId=<id> passed=true score=1.0 hits=p({|foam.core.boot.CSpec inputTokens=60 outputTokens=193 ms=9420
        foam.lang.X x    = getX();
        DAO resultDAO    = (DAO) x.get("evalResultDAO");
        DAO runDAO       = (DAO) x.get("evalRunDAO");

        long    promptId     = Long.parseLong(extract_(payload, "promptId=(\\\\d+)"));
        boolean passed      = "true".equals(extract_(payload, "passed=(true|false)"));
        float   score       = Float.parseFloat(extract_(payload, "score=([0-9.]+)"));
        String  hitsRaw     = extract_(payload, "hits=([^\\\\s]*)");
        int     inputTokens = Integer.parseInt(extract_(payload, "inputTokens=(\\\\d+)"));
        int     outputTokens= Integer.parseInt(extract_(payload, "outputTokens=(\\\\d+)"));
        long    ms          = Long.parseLong(extract_(payload, "ms=(\\\\d+)"));
        String  response    = extract_(payload, "response=(.+)$");

        String[] hits = hitsRaw.isEmpty() ? new String[0] : hitsRaw.split("\\\\|");

        EvalResult result = new EvalResult();
        result.setEvalRunId(getEvalRunId());
        result.setPromptId(promptId);
        result.setPassed(passed);
        result.setScore(score);
        result.setRubricHits(hits);
        result.setInputTokens(inputTokens);
        result.setOutputTokens(outputTokens);
        result.setGenerationMs(ms);
        result.setResponse(response);
        resultDAO.put(result);

        // Incrementally update EvalRun pass counts.
        EvalRun run = (EvalRun) runDAO.find(getEvalRunId());
        if ( run != null ) {
          EvalRun updated = (EvalRun) run.fclone();
          if ( passed ) updated.setPassCount(updated.getPassCount() + 1);
          runDAO.put(updated);
        }

        out("  [" + (passed ? "PASS" : "FAIL") + "] prompt=" + promptId
          + " score=" + String.format("%.2f", score)
          + " hits=" + hits.length + " tokens=" + outputTokens + " ms=" + ms);

        Loggers.logger(x, this).info("storeResult",
          "evalRunId", getEvalRunId(), "promptId", promptId,
          "passed", passed, "score", score);
      `
    },
    {
      name: 'extract_',
      args: 'String text, String regex',
      type: 'String',
      javaCode: `
        Matcher m = Pattern.compile(regex).matcher(text);
        return m.find() ? m.group(1) : "";
      `
    },
    {
      name: 'writeStdin_',
      args: 'OutputStream stdin',
      javaThrows: ['java.io.IOException'],
      javaCode: `
        List prompts = getPendingPrompts_();
        if ( prompts == null || prompts.isEmpty() ) { stdin.close(); return; }
        Outputter out = new Outputter(getX());
        StringBuilder sb = new StringBuilder("[");
        for ( int i = 0; i < prompts.size(); i++ ) {
          if ( i > 0 ) sb.append(",");
          sb.append(out.stringify((foam.lang.FObject) prompts.get(i)));
        }
        sb.append("]");
        try ( OutputStreamWriter w = new OutputStreamWriter(stdin, StandardCharsets.UTF_8) ) {
          w.write(sb.toString());
        }
      `
    }
  ]
});
