foam.POM({
  name: 'partition-test',

  files: [
    { name: 'PartitionStrRecord',                 flags: 'js&test|java&test' },
    { name: 'RefSourceRecord',                    flags: 'js&test|java&test' },
    { name: 'UnloadableDecoratedRecord',          flags: 'js&test|java&test' },
    { name: 'SingleToPartitionMigratorTest',      flags: 'js&test|java&test' },
    { name: 'ReferenceMigratorTest',              flags: 'js&test|java&test' },
    { name: 'DatePartitioningSchemeTest',         flags: 'js&test|java&test' },
    { name: 'DatePartitionedSelectTest',          flags: 'js&test|java&test' },
    { name: 'PartitionLoadReporterTest',          flags: 'js&test|java&test' },
    { name: 'PartitionLoadReplayTest',            flags: 'js&test|java&test' },
    { name: 'PartitionLoadStatusIntegrationTest', flags: 'js&test|java&test' },
    { name: 'PartitionLoadProgressDAOTest',       flags: 'js&test|java&test' },
    { name: 'UnloadableDecoratedDAOTest',         flags: 'js&test|java&test' },
    { name: 'UnloadableAddIndexTest',             flags: 'js&test|java&test' },
    { name: 'UnloadableNDiffReplayTest',          flags: 'js&test|java&test' },
    { name: 'UnloadableCSpecStatusTest',          flags: 'js&test|java&test' },
    { name: 'PartitionedDAOListenTest',           flags: 'js&test|java&test' }
  ],

  javaFiles: [
    { name: 'TwoLevelPartitionedDAO', flags: 'test' }
  ]
});
