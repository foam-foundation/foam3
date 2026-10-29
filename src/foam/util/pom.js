/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "util",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "util",                                               flags: "js" },
    { name: "Base64",                                             flags: "js" },
    { name: "FObjectSpec",                                        flags: "js" },
    { name: "FluentSpec",                                         flags: "js|java" },
    { name: "Timer",                                              flags: "js" },
    { name: "TextDiff",                                           flags: "js" },
    { name: "AddressUtil",                                        flags: "js" },
    { name: "EmailTest",                                          flags: "js&test|java&test" },
    { name: "PasswordTest",                                       flags: "js&test|java&test" },
    { name: "SecurityUtilTest",                                   flags: "js&test|java&test" },
    { name: "PhoneNumberUtil",                                    flags: "js|java" },
    { name: "async/Sequence",                                     flags: "js" },
    { name: "async/MetaContextAgent",                             flags: "js" },
    { name: "async/SequenceInstaller",                            flags: "js" },
    { name: "async/AdvanceToAgent",                               flags: "js" },
    { name: "UIDGenerator",                                       flags: "js|java" },
    { name: "AUIDGenerator",                                      flags: "js|java" },
    { name: "NUIDGenerator",                                      flags: "js|java" },
    { name: "test/DummyNuid",                                     flags: "js&test|java&test" },
    { name: "test/UIDGeneratorTest",                              flags: "js&test|java&test" },
    { name: "test/UIDUniquenessTest",                             flags: "js&test|java&test" },
    { name: "test/SafetyUtilTest",                                flags: "js&test|java&test" },
    { name: "test/StringInternerTest",                            flags: "js&test|java&test" },
    { name: "test/StringInternerConcurrencyTest",                 flags: "js&test|java&test" },
    { name: "test/DateUtilTest",                                  flags: "js&test|java&test" },
    { name: "test/DateUtilJSTest",                                flags: "js&test|java&test" },
    { name: "test/TextDiffJSTest",                                flags: "js&test|java&test" },
    { name: "uid/GlobalSearchService",                            flags: "js|java" },
    { name: "uid/FuidSearchService",                              flags: "js|java" },
    { name: "uid/ClientGlobalSearchService",                      flags: "js|java" },
    { name: "uid/FuidKey",                                        flags: "js|java" },
    { name: "DateUtil",                                           flags: "js|java" },
    { name: "DeFeedback",                                         flags: "web" },
    { name: 'development/ClientTestingReplayDAO',                 flags: "js&test" },
    { name: "concurrent/AbstractAssembly",                        flags: "js|java" },
    { name: "concurrent/Assembly",                                flags: "js|java" },
    { name: "filesystem/FileWalker",                              flags: "node" },
    { name: "retry/RetryStrategy",                                flags: "js|java" },
    { name: "retry/NoRetryStrategy",                              flags: "js|java" },
    { name: "retry/SimpleRetryStrategy",                          flags: "js|java" },
    { name: "retry/BackoffRetryStrategy",                         flags: "js|java" },
    { name: "retry/RetryForeverStrategy",                         flags: "js|java" },
    { name: "retry/RetryUntilStrategy",                           flags: "js|java" },
    { name: "retry/RetryStrategyFactory",                         flags: "js|java" },
    { name: "retry/RetryLimitReachedException",                   flags: "js|java" },
  ],

  javaFiles: [
    { name: "QuickSortTest",                                      flags: "test" },
    { name: "LRULinkedHashMap" },
    { name: "StringInterner" },
    { name: "AddressUtil" },
    { name: "SyncFastTimestamper" },
    { name: "SecurityUtil" },
    { name: "QuickSortBenchmark",                                 flags: "test" },
    { name: "Email" },
    { name: "Auth" },
    { name: "Emails/EmailsUtility" },
    { name: "StringUtil" },
    { name: "FastTimestamper" },
    { name: "concurrent/FutureValue" },
    { name: "concurrent/LocalState" },
    { name: "concurrent/BatchingAssemblyLine" },
    { name: "concurrent/CompoundAssembly" },
    { name: "concurrent/SimpleAsyncAssemblyLine" },
    { name: "concurrent/AsyncAssemblyLine" },
    { name: "concurrent/FoldReducer" },
    { name: "concurrent/SyncAssemblyLine" },
    { name: "concurrent/AssemblyLine" },
    { name: "retry/RetryManager" },
    { name: "EmptyTRIE" },
    { name: "UIDSupport" },
    { name: "Arrays" },
    { name: "TRIE" },
    { name: "SafetyUtil" },
    { name: "Password" },
  ],

  journalFiles: [
    { name: "tests",                                              flags: "test" },
  ]
});
