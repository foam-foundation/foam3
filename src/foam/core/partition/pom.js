foam.POM({
  name: "partition",

  projects: [
    { name: 'test/pom', flags: 'test' }
  ],

  files: [
    { name: "All",                          flags: "js|java" },
    { name: "AbstractPartitionedDAO",       flags: "java" },
    { name: "PartitionedSequenceNumberDAO", flags: "java" }
  ],

  javaFiles: [
    { name: "PartitionedDAO" },
    { name: "DatePartitionedDAO" },
    { name: "ReferenceMigrator" },
    { name: "SingleToPartitionMigrator" },
    { name: "NotPartitionedDAO" },
  ]
});
