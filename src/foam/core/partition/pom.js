foam.POM({
  name: "partition",

  projects: [
    { name: 'test/pom', flags: 'test' }
  ],

  files: [
    { name: "AbstractPartitionedDAO",        flags: "java" },
    { name: "PartitionedSequenceNumberDAO",  flags: "java" }
  ],

  javaFiles: [
    { name: "PartitionedDAO" },
    { name: "SingleToPartitionMigrator" }
  ]
});
