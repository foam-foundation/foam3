foam.POM({
  name: 'partition-test',

  files: [
    { name: 'PartitionStrRecord',                 flags: 'js&test|java&test' },
    { name: 'RefSourceRecord',                    flags: 'js&test|java&test' },
    { name: 'SingleToPartitionMigratorTest',      flags: 'js&test|java&test' },
    { name: 'ReferenceMigratorTest',              flags: 'js&test|java&test' },
    { name: 'PartitionLoadReporterTest',          flags: 'js&test|java&test' },
    { name: 'PartitionLoadReplayTest',            flags: 'js&test|java&test' },
    { name: 'PartitionLoadStatusIntegrationTest', flags: 'js&test|java&test' },
    { name: 'PartitionLoadProgressDAOTest',       flags: 'js&test|java&test' }
  ],

  javaFiles: [
    { name: 'TwoLevelPartitionedDAO', flags: 'test' }
  ]
});
