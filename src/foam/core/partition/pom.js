foam.POM({
  name: "partition",

  files: [
    { name: "AbstractPartitionedDAO",       flags: "java" },
    { name: "PartitionedSequenceNumberDAO", flags: "java" }
  ],

  javaFiles: [
    { name: "PartitionedDAO" },
    { name: "DatePartitionedDAO" }
  ]
});
