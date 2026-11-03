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
    'java.util.ArrayList',
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
        out("  Adapter  : " + getAdapterPath());
        out("  MaxIter  : " + getMaxIter());
        out("  Dataset  : " + getDatasetVersion());
        if ( ! getResumeFrom().isEmpty() ) out("  Resume   : " + getResumeFrom());
        out("──────────────────────────────────────────────────────");

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
        run.setId(UUID.randomUUID().toString());
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
        cmd.add("-m");         cmd.add("mlx_lm");
        cmd.add("lora");
        cmd.add("--config");   cmd.add(getConfigFile());
        if ( ! getResumeFrom().isEmpty() ) {
          cmd.add("--resume-adapter-file");
          cmd.add(getAdapterPath());
        }
        setCommand(cmd.toArray(new String[0]));
        return super.buildCommand_();
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
        // Strip all ANSI/VT100 CSI sequences (colour, cursor-movement, erase, etc.)
        String clean = line.replaceAll("\\\\033\\\\[[^a-zA-Z]*[a-zA-Z]", "");

        // Server log only — keeps UI output clean.
        Loggers.logger(getX(), this).debug("parseProgress", "raw.len", line.length(), "clean", clean);

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
    }
  ]
});
