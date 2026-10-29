/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// One of n pom files controlling foam model load boot order.
//
// Attempt to add additional files to a package scoped pom file

foam.POM({
  name: "bootstrap-2",

  projects: [
    { name: "foam/parse/pom" }
  ],

  files: [
    { name: "foam/lang/Validator",                                    flags: "js|java" },
    { name: "foam/lang/ValidationException",                          flags: "js|java" },
    { name: "foam/lang/ClientRuntimeException",                       flags: "js|java" },
    { name: "foam/lang/OptionalBoolean",                              flags: "js|java" },
    { name: "foam/parsers/FON",                                       flags: "js" },
    { name: "foam/lang/templates",                                    flags: "js" },
    { name: "foam/i18n/Messages",                                     flags: "js" },
    { name: "foam/i18n/MessageTemplateParser",                        flags: "js" },
    { name: "foam/lang/Validation",                                   flags: "js" },
    { name: "foam/lang/DateValidation",                               flags: "java" },
    { name: "foam/lang/Action",                                       flags: "js|java" },
    { name: "foam/lang/Static",                                       flags: "js" },
    { name: "foam/lang/Reaction",                                     flags: "js" },
    { name: "foam/lang/Serializable",                                 flags: "js|java" },
    { name: "foam/lang/Freezable",                                    flags: "js|java" },
    { name: "foam/lang/Detachable",                                   flags: "js|java" },
    { name: "foam/lang/ContextAgent",                                 flags: "js|java" },
    { name: "foam/lang/TimeoutAgent",                                 flags: "js|java" },
    { name: "foam/lang/CompoundContextAgency",                        flags: "js|java" },
    { name: "foam/lang/Validatable",                                  flags: "js|java" },
    { name: "foam/lang/AxiomCloner",                                  flags: "js" },
    { name: "foam/lang/Agency",                                       flags: "js|java" },
    { name: "foam/lang/AbstractAgency",                               flags: "js|java" },
    { name: "foam/i18n/TranslationFormatStringParser",                flags: "js" },
    { name: "foam/color/colorlib",                                    flags: "js" }
  ]
})
