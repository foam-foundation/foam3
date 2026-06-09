foam.POM({
  name: 'partition-test',

  files: [
    { name: 'PartitionTestRecord',           flags: 'js&test|java&test' },
    { name: 'SingleToPartitionMigratorTest', flags: 'js&test|java&test' }
  ]
});
