foam.POM({
  name: 'partition-test',

  files: [
    { name: 'PartitionStrRecord',            flags: 'js&test|java&test' },
    { name: 'RefSourceRecord',               flags: 'js&test|java&test' },
    { name: 'UnloadableDecoratedRecord',     flags: 'js&test|java&test' },
    { name: 'SingleToPartitionMigratorTest', flags: 'js&test|java&test' },
    { name: 'ReferenceMigratorTest',         flags: 'js&test|java&test' },
    { name: 'UnloadableDecoratedDAOTest',    flags: 'js&test|java&test' }
  ],

  javaFiles: [
    { name: 'TwoLevelPartitionedDAO', flags: 'test' }
  ]
});
