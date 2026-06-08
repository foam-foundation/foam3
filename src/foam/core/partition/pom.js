foam.POM({
  name: "partition",

  files: [
    { name: "AbstractPartitionedDAO",   flags: "java" },
    { name: "PartitionedTransaction",   flags: "java" }
  ],

  javaFiles: [
    { name: "PartitionedDAO" }
  ]
});
