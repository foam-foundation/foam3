/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'bench',

  files: [
    { name: "Benchmark",                                                            flags: "js|java" },
    { name: "BenchmarkResult",                                                      flags: "js|java" },
    { name: "BenchmarkResultReportingDAO",                                          flags: "js|java" },
    { name: "BenchmarkResultSystemDAO",                                             flags: "js|java" },
    { name: "BenchmarkRunner",                                                      flags: "js|java" },
    { name: "BenchmarkRunnerScript",                                                flags: "js|java" },
    { name: "Relationships",                                                        flags: "js" },
    { name: "TestScriptBenchmark",                                                  flags: "js|java" },
    { name: "HashingBenchmark",                                                     flags: "java" }
  ]
});