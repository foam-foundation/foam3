foam.POM({
  name: 'partition-test',

  files: [
    { name: 'PartitionTestRecord',           flags: 'js&test|java&test' },
    { name: 'PartitionStrRecord',            flags: 'js&test|java&test' },
    { name: 'RefSourceRecord',               flags: 'js&test|java&test' },
    { name: 'SingleToPartitionMigratorTest', flags: 'js&test|java&test' },
    { name: 'ReferenceMigratorTest',         flags: 'js&test|java&test' }
  ]
});
