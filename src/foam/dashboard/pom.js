/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "dashboard",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "model/VisualizationSize",                            flags: "js" },
    { name: "model/Visualization",                                flags: "js" },
    { name: "model/GroupBy",                                      flags: "js" },
    { name: "model/Count",                                        flags: "js" },
    { name: "model/Table",                                        flags: "js" },
    { name: "view/Count",                                         flags: "js" },
    { name: "view/Table",                                         flags: "js" },
    { name: "view/Pie",                                           flags: "js" },
    { name: "view/Bar",                                           flags: "js" },
    { name: "view/Line",                                          flags: "js" },
    { name: "view/DAOTable",                                      flags: "js" },
    { name: "view/HorizontalDAOTable",                            flags: "js" },
    { name: "view/UserGreetingView",                              flags: "js" },
    { name: "view/GroupByDAOTable",                               flags: "js" },
    { name: "view/GroupByCitationView",                           flags: "js" },
    { name: "view/Card",                                          flags: "js" },
    { name: "view/BackgroundCard",                                flags: "js" },
    { name: "view/ViewImgCard",                                   flags: "js" },
    { name: "view/CardWrapper",                                   flags: "js" },
    { name: "view/Dashboard",                                     flags: "js" },
    { name: "view/DashboardView",                                 flags: "js" },
    { name: "view/DashboardCitationView",                         flags: "js" },
    { name: "view/DateRangeChoiceView",                           flags: "js" },
    { name: "view/CenteredDashboardCitationView",                 flags: "web" },
    { name: "view/GroupedDAOTableWidget",                         flags: "web" },
  ]
});
