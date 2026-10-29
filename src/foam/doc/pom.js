/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "doc",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "AxiomLink",                                          flags: "dev&web" },
    { name: "dao/PropertyPermissionCheckDecorator",               flags: "dev&web" },
    { name: "dao/AxiomDAO",                                       flags: "dev&web" },
    { name: "AxiomTableView",                                     flags: "dev&web" },
    { name: "MethodAxiom",                                        flags: "dev&web" },
    { name: "AxiomListView",                                      flags: "dev&web" },
    { name: "Axiom",                                              flags: "dev&web" },
    { name: "PropertyAxiom",                                      flags: "dev&web" },
    { name: "AxiomSummaryView",                                   flags: "dev&web" },
    { name: "SimpleClassView",                                    flags: "dev&web" },
    { name: "InterfaceView",                                      flags: "dev&web" },
    { name: "PropertyView",                                       flags: "dev&web" },
    { name: "ClassLink",                                          flags: "dev&web" },
    { name: "CodeTabs",                                           flags: "js" },
    { name: "ClassList",                                          flags: "dev&web" },
    { name: "DocBrowser",                                         flags: "dev&web" },
    { name: "UMLDiagram",                                         flags: "dev&web" },
    { name: "ModelBrowser",                                       flags: "dev&web" },
  ]
});
