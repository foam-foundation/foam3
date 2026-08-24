foam.POM({
  name: "partition",

  projects: [
    { name: 'test/pom', flags: 'test' }
  ],

  files: [
    { name: "DatePartitioningScheme",       flags: "java" },
    { name: "All",                          flags: "js|java" },
    { name: "AbstractPartitionedDAO",       flags: "java" },
    { name: "PartitionedSequenceNumberDAO", flags: "java" },
    { name: "PartitionLoadStatus",          flags: "js|java" },
    { name: "F3FileJournalRefinement",      flags: "java" },
    { name: "PartitionLoadProgressDAO",     flags: "js" },
    { name: "PartitionLoadToastStack",      flags: "js" }
  ],

  javaFiles: [
    { name: "PartitionedDAO" },
    { name: "DatePartitionedDAO" },
    { name: "ReferenceMigrator" },
    { name: "SingleToPartitionMigrator" },
    { name: "NotPartitionedDAO" },
    { name: "PartitionLoadReporter" },
  ]
});
