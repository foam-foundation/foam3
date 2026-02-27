/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "kv",

  files: [
    { name: "LSMOptions",    flags: "java" },
  ],

  javaFiles: [
    { name: "KVDAO" },
    { name: "KVCORE" },
    { name: "LSMCore" },
    { name: 'wal/WAL' },
    { name: 'wal/WALManager' },
    { name: "level/Level" },
    { name: "level/Levels" },
    { name: "level/LevelsMeta" },
    { name: "sstable/Table" },
    { name: "sstable/TableMeta" },
    { name: "transaction/Transaction" },
    { name: "util/KVFileDescriptor" },
  ]
});