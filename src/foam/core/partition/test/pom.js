foam.POM({
  name: 'partition-test',

  files: [
    { name: 'PartitionStrRecord',                 flags: 'js|java' },
    { name: 'RefSourceRecord',                    flags: 'js|java' },
    { name: 'UnloadableDecoratedRecord',          flags: 'js|java' },
    { name: 'SingleToPartitionMigratorTest',      flags: 'js|java' },
    { name: 'ReferenceMigratorTest',              flags: 'js|java' },
    { name: 'DatePartitioningSchemeTest',         flags: 'js|java' },
    { name: 'DatePartitionedSelectTest',          flags: 'js|java' },
    { name: 'DatePartitionedPreloadTest',         flags: 'js|java' },
    { name: 'PartitionLoadReporterTest',          flags: 'js|java' },
    { name: 'PartitionLoadReplayTest',            flags: 'js|java' },
    { name: 'PartitionLoadStatusIntegrationTest', flags: 'js|java' },
    { name: 'PartitionLoadProgressDAOTest',       flags: 'js|java' },
    { name: 'UnloadableDecoratedDAOTest',         flags: 'js|java' },
    { name: 'UnloadableAddIndexTest',             flags: 'js|java' },
    { name: 'UnloadableNDiffReplayTest',          flags: 'js|java' },
    { name: 'UnloadableCSpecStatusTest',          flags: 'js|java' },
    { name: 'IndexBeforeReplayTest',              flags: 'js|java' },
    { name: 'PartitionedDAOListenTest',           flags: 'js|java' },
    { name: 'PartitionedDAOLegacyLayoutTest',     flags: 'js|java' },
    { name: 'PartitionedDAOSelectTest',           flags: 'js|java' },
    { name: 'PartitionedCompactionTest',          flags: 'js|java' },
    { name: 'PartitionedDAOUnprefixedFindTest',   flags: 'js|java' },
    { name: 'PartitionedAddIndexTest',            flags: 'js|java' }
  ],

  javaFiles: [
    { name: 'TwoLevelPartitionedDAO', flags: 'test' }
  ]
});
