/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "flow",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "widgets/AxiomShortSummary",                          flags: "js" },
    { name: "widgets/MethodShortSummary",                         flags: "js" },
    { name: "widgets/PropertyShortSummary",                       flags: "js" },
    { name: "widgets/SequenceSummary",                            flags: "js" },
    { name: "widgets/ModelSummary",                               flags: "js" },
    { name: "widgets/EnumSummary",                                flags: "js" },
    { name: "widgets/TabbedModelDocumentation",                   flags: "js" },
    { name: "widgets/DocumentationIncomplete",                    flags: "js" },
    { name: "widgets/ApiShortSummary",                            flags: "js" },
  ]
});
