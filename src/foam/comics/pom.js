/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "comics",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "v2/test/DAOBrowseControllerViewTest",                flags: "js&test|java&test" },
    { name: "SearchMode",                                         flags: "web|java" },
    { name: "DAOController",                                      flags: "js" },
    { name: "DAOControllerView",                                  flags: "web" },
    { name: "InlineDAOControllerView",                            flags: "web" },
    { name: "DAOCreateController",                                flags: "js" },
    { name: "DAOCreateControllerView",                            flags: "web" },
    { name: "DAOUpdateController",                                flags: "js" },
    { name: "DAOUpdateControllerView",                            flags: "web" },
    { name: "BrowserView",                                        flags: "web" },
    { name: "InlineBrowserView",                                  flags: "web" },
    { name: "RelationshipView",                                   flags: "web" },
    { name: "v2/CannedQuery",                                     flags: "js|java" },
    { name: "v2/EnabledActionsAuth",                              flags: "js|java" },
    { name: "v2/BasicEnabledActionsAuth",                         flags: "js|java" },
    { name: "v2/CRUDEnabledActionsAuth",                          flags: "js|java" },
    { name: "v2/DAOBrowseControllerView",                         flags: "js" },
    { name: "v2/DAOBrowserView",                                  flags: "js" },
    { name: "v3/ComicsAction",                                    flags: "js" },
    { name: "v3/DetailView",                                      flags: "js" },
    { name: "v3/DAOController",                                   flags: "js" },
    { name: "v3/CreateView",                                      flags: "js" },
    { name: "v3/DAOView",                                         flags: "js" },
    { name: "v2/DAOControllerConfig",                             flags: "js|java" },
    { name: "v2/DAOCreateView",                                   flags: "js" },
    { name: "v2/DAOSummaryView",                                  flags: "js" },
    { name: "v2/DAOUpdateView",                                   flags: "js" },
    { name: "v2/NamedViews",                                      flags: "js|java" },
    { name: "v2/Clickable",                                       flags: "js|java" },
    { name: "v2/userfeedback/UserFeedbackAware",                  flags: "js|java" },
    { name: "v2/userfeedback/UserFeedbackStatus",                 flags: "js|java" },
    { name: "v2/userfeedback/UserFeedback",                       flags: "js|java" },
    { name: "v2/userfeedback/UserFeedbackException",              flags: "js|java" },
    { name: "v2/userfeedback/UserFeedbackAlertType",              flags: "js|java" },
  ]
});
