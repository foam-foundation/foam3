foam.POM({
  name: "job",

  files: [
    { name: "JobStatus",           flags: "js|java" },
    { name: "Job",                 flags: "js|java" },
    { name: "JobRunner",           flags: "js|java" },
    { name: "SubmitJobRuleAction", flags: "js|java" },
    { name: "RemoveOldJobsAgent",  flags: "js|java" },
    { name: "test/SleepJob",       flags: "js&test|java&test" },
    { name: "test/JobTest",        flags: "js&test|java&test" }
  ]
});
