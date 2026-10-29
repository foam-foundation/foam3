foam.POM({
  name: "job",

  files: [
    { name: "JobStatus",           flags: "js|java" },
    { name: "Job",                 flags: "js|java" },
    { name: "Jobs",                flags: "js" },
    { name: "JobRunner",           flags: "js|java" },
    { name: "SubmitJobRuleAction", flags: "js|java" },
    { name: "RemoveOldJobsAgent",  flags: "js|java" },
    { name: "BatchRecord",         flags: "js|java" },
    { name: "Batchable",           flags: "js|java" },
    { name: "BatchJob",            flags: "js|java" },
    { name: "PythonJob",           flags: "js|java" },
    { name: "ShellJob",            flags: "js|java" },
    { name: "ScriptJob",           flags: "js|java" },
    { name: "test/SleepJob",       flags: "js&test|java&test" },
    { name: "test/JobTest",        flags: "js&test|java&test" }
  ]
});
