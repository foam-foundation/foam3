/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "blob",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "../lang/Blob",                                       flags: "js|java" },
    { name: "Blob",                                               flags: "js|java" },
    { name: "BlobService",                                        flags: "js|java" },
    { name: "AbstractBlob",                                       flags: "js|java" },
    { name: "AbstractBlobService",                                flags: "js|java" },
    { name: "ProxyBlobService",                                   flags: "js|java" },
    { name: "SubBlob",                                            flags: "js|java" },
    { name: "BlobBlob",                                           flags: "web" },
    { name: "IdentifiedBlob",                                     flags: "js|java" },
    { name: "ClientBlob",                                         flags: "js|java" },
    { name: "RestBlobService",                                    flags: "js|java" },
    { name: "BlobServiceDecorator",                               flags: "js|java" },
    { name: "TestBlobService",                                    flags: "js&test|java&test" },
    { name: "BlobStore",                                          flags: "java|node" },
    { name: "BlobStoreTest",                                      flags: "js&test|java&test" },
    { name: "FdBlob",                                             flags: "java|node" },
  ],

  javaFiles: [
    { name: "ByteArrayBlob" },
    { name: "HashingOutputStream" },
    { name: "InputStreamBlob" },
    { name: "RestBlobService" },
    { name: "HashingInputStream" },
    { name: "FileBlob" },
  ],

  journalFiles: [
    { name: "tests",                                              flags: "test" },
  ]
});
