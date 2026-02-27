/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.kv',
  name: 'LSMOptions',

  javaImports: [
    'java.nio.file.Path',
  ],

  constants: [
    { type: 'String', name: 'MANIFEST_DIRECTORY', value: 'manifest' },
    { type: 'String', name: 'SSTABLE_DIRECTORY', value: 'sstables' },
    { type: 'String', name: 'WAL_DIRECTORY', value: 'wal' },
  ],
  
  properties: [
    { class: 'Int', name: 'blockSize', value: 64 * 1024, documentation: 'default to 64KB'},
    { class: 'Int', name: 'maxMemtablSize' },
    { class: 'Int', name: 'levelCount' },
    { class: 'Object', javaType: 'Path', name: 'path', documentation: 'path to store LSM files'},
    { 
      class: 'Object', javaType: 'Path', name: 'manifestDir', 
      javaGetter: `return getPath().resolve(MANIFEST_DIRECTORY);`
    },
    { 
      class: 'Object', javaType: 'Path', name: 'sstableDir', 
      javaGetter: `return getPath().resolve(SSTABLE_DIRECTORY);`
    },
    { 
      class: 'Object', javaType: 'Path', name: 'walDir', 
      javaGetter: `return getPath().resolve(WAL_DIRECTORY);`
    }
  ],

  methods: [
    {
      name: 'getManifestFilePath',
      args: 'long id',
      javaType: 'Path',
      javaCode: `
        return getManifestDir().resolve(String.format("%024d.manifest", id));
      `
    },
    {
      name: 'getSstableFilePath',
      args: 'long id',
      javaType: 'Path',
      javaCode: `
        return getSstableDir().resolve(String.format("%024d.sstable", id));
      `
    },
  ]
})