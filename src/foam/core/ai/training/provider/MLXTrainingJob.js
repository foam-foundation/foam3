/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.training.provider',
  name: 'MLXTrainingJob',
  extends: 'foam.core.job.PythonJob',

  documentation: `
    Runs MLX LoRA fine-tuning via mlx_lm.lora and tracks every iteration
    as a TrainingMetric record.

    Configuration lives in a YAML file — MLX reads it directly. FOAM
    properties capture only what the framework needs: the base model name for
    the TrainingRun record, the adapter path for suspend/resume, and maxIter
    for progress calculation.

    Suspend: when the job status is set to SUSPENDING, the readline loop sends
    SIGTERM to the subprocess. MLX flushes its current checkpoint before
    exiting. The TrainingRun is updated with the last known loss and iteration
    count so the next submission can resume from exactly that point.

    Resume: set resumeFrom to the id of the TrainingRun to continue. The job
    looks up the adapter path from that run, adds --resume-adapter-file to the
    command, and links the new TrainingRun via resumedFrom.
  `,

  javaImports: [
    'foam.core.ai.training.TrainingMetric',
    'foam.core.ai.training.TrainingRun',
    'foam.core.job.JobStatus',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.InputStreamReader',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.Comparator',
    'java.util.List',
    'java.util.UUID',
    'java.util.regex.Matcher',
    'java.util.regex.Pattern'
  ],

  properties: [
    {
      class: 'String',
      name: 'modelBase',
      documentation: 'HuggingFace id of the base model, e.g. mlx-community/Qwen2.5-7B-Instruct-4bit.',
      required: true
    },
    {
      class: 'String',
      name: 'configFile',
      documentation: 'Path to the MLX LoRA YAML config. All hyperparameters live there.',
      required: true
    },
    {
      class: 'String',
      name: 'adapterPath',
      documentation: 'Where MLX writes adapter weights. Also the resume checkpoint for the next submission.',
      value: 'adapters/adapters.npz'
    },
    {
      class: 'Int',
      name: 'maxIter',
      documentation: 'Total iterations expected. Used to compute the 0–100 progress percentage.',
      required: true
    },
    {
      class: 'String',
      name: 'datasetVersion',
      documentation: 'The dataset RUN_KEY used for this run. Stored on TrainingRun for traceability.'
    },
    {
      class: 'String',
      name: 'resumeFrom',
      documentation: `TrainingRun id to continue from. When set, the job looks up the adapter path
        from that run, adds --resume-adapter-file to the MLX command, and links the new TrainingRun
        via resumedFrom.`
    },
    {
      class: 'StringArray',
      name: 'tags',
      documentation: 'Forwarded to the TrainingRun record for grouping and filtering across runs.'
    },
    {
      class: 'String',
      name: 'runId',
      documentation: 'Set at execute time when the TrainingRun is created. FK into trainingRunDAO.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Int',
      name: 'nanCount_',
      documentation: 'Count of NaN loss reports seen this run. Job auto-stops at 3.',
      transient: true,
      visibility: 'HIDDEN'
    },
    {
      class: 'String',
      name: 'configBuffer_',
      documentation: 'Accumulates ##CONFIG## lines from run_training.py until ##CONFIG_END## is received.',
      transient: true,
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        setX(x);
        DAO runDAO    = (DAO) x.get("trainingRunDAO");
        DAO metricDAO = (DAO) x.get("trainingMetricDAO");

        out("╔══════════════════════════════════════════════════════╗");
        out("║            MLX LoRA Training Job Started             ║");
        out("╚══════════════════════════════════════════════════════╝");
        out("  Model    : " + getModelBase());
        out("  Config   : " + getConfigFile());
        out("  MaxIter  : " + getMaxIter());
        out("  Dataset  : " + getDatasetVersion());
        if ( ! getResumeFrom().isEmpty() ) out("  Resume   : " + getResumeFrom());
        out("──────────────────────────────────────────────────────");

        // Generate the run ID first so it can be embedded in the adapter path,
        // guaranteeing each run gets a unique directory even with the same datasetVersion.
        String runId = UUID.randomUUID().toString();

        // Auto-version the adapter path: <base>/<datasetVersion>-<runId[0..7]>
        String adapterBase = getAdapterPath();
        String version     = ! getDatasetVersion().isEmpty()
          ? getDatasetVersion()
          : runId.substring(0, 8);
        setAdapterPath(adapterBase + "/" + version + "-" + runId.substring(0, 8));
        out("  Adapter  : " + getAdapterPath());

        // Resolve the previous run's adapter path when resuming.
        String resumeAdapterPath = "";
        String resumedFromId     = "";
        if ( ! getResumeFrom().isEmpty() ) {
          TrainingRun prev = (TrainingRun) runDAO.find(getResumeFrom());
          if ( prev != null ) {
            resumeAdapterPath = prev.getAdapterPath();
            resumedFromId     = prev.getId();
            out("  Resuming from adapter: " + resumeAdapterPath);
          } else {
            out("  WARN: resumeFrom=" + getResumeFrom() + " not found in trainingRunDAO — starting fresh");
          }
        }

        // Create the TrainingRun before the subprocess starts.
        TrainingRun run = new TrainingRun();
        run.setId(runId);
        run.setJobId(getId());
        run.setModelBase(getModelBase());
        run.setDatasetVersion(getDatasetVersion());
        run.setConfigFile(getConfigFile());
        run.setAdapterPath(getAdapterPath());
        run.setResumedFrom(resumedFromId);
        run.setStatus(JobStatus.RUNNING);
        run.setStartedAt(new java.util.Date());
        run.setTags(getTags());
        runDAO.put(run);

        setRunId(run.getId());
        setProgress(0);
        save(x);
        out("  TrainingRun ID: " + run.getId());
        out("──────────────────────────────────────────────────────");
        Loggers.logger(x, this).info("execute-start",
          "jobId",    getId(),
          "runId",    run.getId(),
          "model",    getModelBase(),
          "config",   getConfigFile(),
          "maxIter",  getMaxIter(),
          "dataset",  getDatasetVersion(),
          "resumeFrom", getResumeFrom());

        // Run the subprocess via PythonJob. The readline loop calls parseProgress_()
        // on each line, which writes TrainingMetric records and drives the progress bar.
        // PythonJob detects SUSPENDING status, sends SIGTERM, and sets SUSPENDED before
        // returning — so we just need to mirror the final status onto the TrainingRun.
        try {
          super.execute(x);
          JobStatus finalStatus = getStatus() == JobStatus.SUSPENDED
            ? JobStatus.SUSPENDED : JobStatus.COMPLETED;
          out("──────────────────────────────────────────────────────");
          out("  Status: " + finalStatus.getLabel());
          TrainingRun done = (TrainingRun) runDAO.find(getRunId());
          if ( done != null ) {
            TrainingRun updated = (TrainingRun) done.fclone();
            updated.setStatus(finalStatus);
            updated.setCompletedAt(new java.util.Date());
            updated.setDuration(updated.getCompletedAt().getTime() - run.getStartedAt().getTime());
            runDAO.put(updated);
            out("  Final train loss : " + updated.getFinalTrainLoss());
            out("  Final val loss   : " + updated.getFinalValLoss());
            out("  Iterations       : " + updated.getIterationsCompleted());
            Loggers.logger(x, this).info("execute-done",
              "jobId",      getId(),
              "runId",      getRunId(),
              "status",     finalStatus,
              "trainLoss",  updated.getFinalTrainLoss(),
              "valLoss",    updated.getFinalValLoss(),
              "iterations", updated.getIterationsCompleted());
          }
          sweepCheckpoints_(x);
          out("╚══════════════════════════════════════════════════════╝");
        } catch ( RuntimeException e ) {
          out("  ERROR: " + e.getMessage());
          Loggers.logger(x, this).error("execute-error", "jobId", getId(), "runId", getRunId(), e);
          TrainingRun failed = (TrainingRun) runDAO.find(getRunId());
          if ( failed != null ) {
            TrainingRun updated = (TrainingRun) failed.fclone();
            updated.setStatus(JobStatus.FAILED);
            runDAO.put(updated);
          }
          throw e;
        }
      `
    },
    {
      name: 'buildCommand_',
      type: 'String[]',
      javaCode: `
        List<String> cmd = new ArrayList<>();
        cmd.add("run_training.py");   // wrapper prints runId + config, then delegates to mlx_lm.lora
        cmd.add("--run-id");       cmd.add(getRunId());
        cmd.add("--config");       cmd.add(getConfigFile());
        cmd.add("--adapter-path"); cmd.add(getAdapterPath());
        if ( ! getResumeFrom().isEmpty() ) {
          cmd.add("--resume-adapter-file");
          cmd.add(latestCheckpoint_());
        }
        setCommand(cmd.toArray(new String[0]));
        return super.buildCommand_();
      `
    },
    {
      documentation: `Resolves the adapter directory to the latest numbered checkpoint
        file (e.g. 0000200_adapters.safetensors), falling back to adapters.safetensors.
        Paths are resolved relative to workingDir when the adapter path is relative.`,
      name: 'latestCheckpoint_',
      type: 'String',
      javaCode: `
        String base = getAdapterPath();
        File   dir  = new File(base);
        if ( ! dir.isAbsolute() && ! getWorkingDir().isEmpty() )
          dir = new File(getWorkingDir(), base);

        if ( dir.isDirectory() ) {
          File[] numbered = dir.listFiles((d, n) -> n.matches("\\\\d+_adapters\\\\.safetensors"));
          if ( numbered != null && numbered.length > 0 ) {
            Arrays.sort(numbered, Comparator.comparing(File::getName).reversed());
            return numbered[0].getAbsolutePath();
          }
          File fallback = new File(dir, "adapters.safetensors");
          if ( fallback.exists() ) return fallback.getAbsolutePath();
        }
        return dir.getAbsolutePath();
      `
    },
    {
      name: 'cleanForOutput_',
      args: 'String line',
      type: 'String',
      javaCode: `return line.replaceAll("\\\\033\\\\[[^a-zA-Z]*[a-zA-Z]", "");`
    },
    {
      name: 'parseProgress_',
      args: 'String line',
      type: 'int',
      javaCode: `
        // MLX 0.32+ column output (ANSI escape codes stripped before matching):
        //   val line:   "   1    val 2.190    6.29s"
        //   train line: "  10    2.535 ▼    116    1.8k"
        //   nan line:   "  10    nan  ▼    ..."
        // Strip all ANSI/VT100 CSI sequences (colour, cursor-movement, erase, etc.)
        String clean = line.replaceAll("\\\\033\\\\[[^a-zA-Z]*[a-zA-Z]", "");

        // Server log only — keeps UI output clean.
        Loggers.logger(getX(), this).debug("parseProgress", "raw.len", line.length(), "clean", clean);

        // Config dump from run_training.py — YAML emitted line-by-line, accumulated here.
        if ( clean.equals("##CONFIG_START##") ) { setConfigBuffer_(""); return -1; }
        if ( clean.startsWith("##CONFIG## ")  ) { setConfigBuffer_(getConfigBuffer_() + clean.substring("##CONFIG## ".length()) + "\\n"); return -1; }
        if ( clean.equals("##CONFIG_END##")   ) {
          DAO runDAO = (DAO) getX().get("trainingRunDAO");
          if ( runDAO != null && ! foam.util.SafetyUtil.isEmpty(getRunId()) ) {
            TrainingRun run = (TrainingRun) runDAO.find(getRunId());
            if ( run != null ) {
              TrainingRun updated = (TrainingRun) run.fclone();
              updated.setConfig(getConfigBuffer_().trim());
              runDAO.put(updated);
              out("  Config stored on TrainingRun.");
            }
          }
          setConfigBuffer_("");
          return -1;
        }

        Matcher valM = Pattern.compile("^\\\\s+(\\\\d+)\\\\s+val\\\\s+[0-9.]+").matcher(clean);
        if ( valM.find() ) {
          int iter = Integer.parseInt(valM.group(1));
          Loggers.logger(getX(), this).info("val-line", "iter", iter, "clean", clean);
          storeMetric_(iter, clean);
          return getMaxIter() > 0 ? Math.min(100, iter * 100 / getMaxIter()) : -1;
        }

        Matcher trainM = Pattern.compile("^\\\\s+(\\\\d+)\\\\s+[0-9]+\\\\.[0-9]+").matcher(clean);
        if ( trainM.find() ) {
          int iter = Integer.parseInt(trainM.group(1));
          Loggers.logger(getX(), this).info("train-line", "iter", iter, "clean", clean);
          storeMetric_(iter, clean);
          return getMaxIter() > 0 ? Math.min(100, iter * 100 / getMaxIter()) : -1;
        }

        // NaN loss — mlx-lm outputs "  10    nan ..." when the loss explodes.
        Matcher nanM = Pattern.compile("^\\\\s+(\\\\d+)\\\\s+nan").matcher(clean);
        if ( nanM.find() ) {
          int iter  = Integer.parseInt(nanM.group(1));
          int count = getNanCount_() + 1;
          setNanCount_(count);
          storeMetric_(iter, clean);
          out("[MLXTrainingJob] NaN loss at iter " + iter + " (" + count + "/3)");
          Loggers.logger(getX(), this).warning("nan-loss", "iter", iter, "count", count);
          if ( count >= 3 ) {
            out("[MLXTrainingJob] NaN for 3 consecutive reports — stopping job.");
            Loggers.logger(getX(), this).warning("nan-stop", "iter", iter);
            setStatus(JobStatus.SUSPENDING);
            save(getX());
          }
          return getMaxIter() > 0 ? Math.min(100, iter * 100 / getMaxIter()) : -1;
        }

        return -1;
      `
    },
    {
      name: 'storeMetric_',
      args: 'int iter, String line',
      javaCode: `
        foam.lang.X x = getX();
        DAO metricDAO = (DAO) x.get("trainingMetricDAO");
        if ( metricDAO == null ) {
          out("[storeMetric_] WARN: trainingMetricDAO is null");
          Loggers.logger(x, this).warning("storeMetric_: trainingMetricDAO is null", "runId", getRunId());
          return;
        }
        if ( foam.util.SafetyUtil.isEmpty(getRunId()) ) {
          out("[storeMetric_] WARN: runId is empty");
          Loggers.logger(x, this).warning("storeMetric_: runId is empty");
          return;
        }

        // line is already ANSI-stripped by parseProgress_ before being passed here
        TrainingMetric metric = new TrainingMetric();
        metric.setRunId(getRunId());
        metric.setIteration(iter);

        // Val line:   "   1    val 2.190    6.29s"
        Matcher valM = Pattern.compile("^\\\\s+\\\\d+\\\\s+val\\\\s+([0-9.]+)").matcher(line);
        if ( valM.find() ) metric.setValLoss(Float.parseFloat(valM.group(1)));

        // Train line: "  10    2.535 ▼    116    1.8k"  (tok/s is the 3rd column)
        Matcher trainM = Pattern.compile("^\\\\s+\\\\d+\\\\s+([0-9]+\\\\.[0-9]+)\\\\s*\\\\S*\\\\s+(\\\\d+)").matcher(line);
        if ( trainM.find() ) {
          metric.setTrainLoss(Float.parseFloat(trainM.group(1)));
          metric.setTokensPerSec(Float.parseFloat(trainM.group(2)));
        }

        // NaN loss — neither regex above matches, so losses stay 0; flag the record.
        if ( line.contains("nan") ) metric.setNanDetected(true);

        // Merge with any existing record for this (runId, iteration) so that
        // a val line and a train line at the same iteration both survive.
        TrainingMetric existing = (TrainingMetric) metricDAO.find(metric.getId());
        if ( existing != null ) {
          TrainingMetric merged = (TrainingMetric) existing.fclone();
          if ( metric.getTrainLoss()    > 0 ) merged.setTrainLoss(metric.getTrainLoss());
          if ( metric.getValLoss()      > 0 ) merged.setValLoss(metric.getValLoss());
          if ( metric.getTokensPerSec() > 0 ) merged.setTokensPerSec(metric.getTokensPerSec());
          if ( metric.getNanDetected()       ) merged.setNanDetected(true);
          metric = merged;
        }
        metricDAO.put(metric);

        // Keep TrainingRun.finalTrainLoss / finalValLoss current so the table
        // shows the latest loss without opening the job output panel.
        DAO runDAO = (DAO) x.get("trainingRunDAO");
        if ( runDAO == null ) return;
        TrainingRun run = (TrainingRun) runDAO.find(getRunId());
        if ( run == null ) return;
        TrainingRun updated = (TrainingRun) run.fclone();
        updated.setIterationsCompleted(iter);
        if ( metric.getTrainLoss() > 0 ) updated.setFinalTrainLoss(metric.getTrainLoss());
        if ( metric.getValLoss()   > 0 ) updated.setFinalValLoss(metric.getValLoss());
        runDAO.put(updated);
      `
    },
    {
      documentation: `Runs sweep_checkpoints.py to list all numbered checkpoints in the
        adapter directory, then queries trainingMetricDAO for the val loss at each
        iteration. The checkpoint with the lowest val loss is stored on the TrainingRun
        as bestCheckpoint. Called automatically at the end of every run.`,
      name: 'sweepCheckpoints_',
      args: 'foam.lang.X x',
      javaCode: `
        DAO metricDAO = (DAO) x.get("trainingMetricDAO");
        DAO runDAO    = (DAO) x.get("trainingRunDAO");
        if ( metricDAO == null || runDAO == null || foam.util.SafetyUtil.isEmpty(getRunId()) ) return;

        out("──────────────────────────────────────────────────────");
        out("  Sweeping checkpoints for best validation loss...");

        // Build the same uv/python command prefix PythonJob uses.
        List<String> cmd = new ArrayList<>();
        if ( getUseUv() ) {
          cmd.add(getUvPath()); cmd.add("run"); cmd.add("python");
        } else {
          cmd.add("python3");
        }
        cmd.add("sweep_checkpoints.py");
        cmd.add("--adapter-dir"); cmd.add(getAdapterPath());

        List<String[]> entries = new ArrayList<>();  // [0]=iter  [1]=path  [2]=file
        try {
          ProcessBuilder pb = new ProcessBuilder(cmd);
          pb.redirectErrorStream(true);
          if ( ! getWorkingDir().isEmpty() ) pb.directory(new File(getWorkingDir()));
          Process proc = pb.start();
          try ( BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream())) ) {
            String line;
            Pattern iterPat = Pattern.compile("iter=(\\\\d+)");
            Pattern pathPat = Pattern.compile("path=(.+)$");
            Pattern filePat = Pattern.compile("file=(\\\\S+)");
            while ( (line = br.readLine()) != null ) {
              if ( line.startsWith("##SWEEP_ERROR## ") ) {
                out("  WARN: " + line.substring("##SWEEP_ERROR## ".length()));
                proc.waitFor();
                return;
              }
              if ( line.startsWith("##CHECKPOINT## ") ) {
                Matcher im = iterPat.matcher(line);
                Matcher pm = pathPat.matcher(line);
                Matcher fm = filePat.matcher(line);
                if ( im.find() && pm.find() && fm.find() )
                  entries.add(new String[]{ im.group(1), pm.group(1), fm.group(1) });
              }
            }
          }
          proc.waitFor();
        } catch ( Exception e ) {
          out("  WARN: checkpoint sweep subprocess failed — " + e.getMessage());
          Loggers.logger(x, this).warning("sweepCheckpoints: subprocess failed", e);
          return;
        }

        if ( entries.isEmpty() ) {
          out("  No numbered checkpoints found — skipping.");
          return;
        }

        // Look up val loss from stored TrainingMetrics and find the best.
        String bestPath    = null;
        float  bestValLoss = Float.MAX_VALUE;

        out(String.format("  %-38s  %9s", "Checkpoint", "Val Loss"));
        out("  " + "─".repeat(50));

        for ( String[] e : entries ) {
          int    iter  = Integer.parseInt(e[0]);
          String path  = e[1];
          String fname = e[2];

          TrainingMetric probe = new TrainingMetric();
          probe.setRunId(getRunId());
          probe.setIteration(iter);
          TrainingMetric metric = (TrainingMetric) metricDAO.find(probe.getId());

          float  valLoss = metric != null ? metric.getValLoss() : 0;
          String valStr  = valLoss > 0 ? String.format("%.4f", valLoss) : "—";
          boolean isBest = valLoss > 0 && valLoss < bestValLoss;
          if ( isBest ) { bestValLoss = valLoss; bestPath = path; }

          out(String.format("  %-38s  %9s%s", fname, valStr, isBest ? "  ←" : ""));
        }

        out("  " + "─".repeat(50));

        if ( bestPath == null ) {
          out("  No val loss metrics found — trainingRunId may not match these checkpoints.");
          return;
        }

        out("  Best: " + new File(bestPath).getName()
          + "  (val loss " + String.format("%.4f", bestValLoss) + ")");

        TrainingRun run = (TrainingRun) runDAO.find(getRunId());
        if ( run != null ) {
          TrainingRun updated = (TrainingRun) run.fclone();
          updated.setBestCheckpoint(bestPath);
          runDAO.put(updated);
          out("  Stored on TrainingRun.");
        }
      `
    }
  ]
});
