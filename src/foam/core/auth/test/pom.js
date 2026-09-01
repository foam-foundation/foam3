/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "test",

  files: [
    { name: "DummySp",                                                flags: "js|java" },
    { name: "GroupResetSessionTest",                                  flags: "js|java" },
    { name: "GroupURLSessionTest",                                    flags: "js|java" },
    { name: "ServiceProviderAwareTest",                               flags: "js|java" },
    { name: "ServiceProviderAuthorizerTest",                          flags: "js|java" },
    { name: "UserAndGroupPermissionTest",                             flags: "js|java" },
    { name: "PasswordPolicyTest",                                     flags: "js|java" },
    { name: "SessionContextTest",                                     flags: "js|java" },
    { name: "SessionLocalSettingTest",                                flags: "js|java" },
    { name: "UserLifecycleTicketTest",                                flags: "js|java" }
  ],
  javaFiles: [
    { name: "PreventPrivilegeEscalationTest" },
    { name: "PreventDuplicateEmailTest" }
  ]
});
