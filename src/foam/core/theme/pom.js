/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "theme",
  projects: [
    { name: "test/pom",                             flags: "test" }
  ],
  files: [
    { name: "ContextRegistrationThemeService",      flags: "js" },
    { name: "FilteredSubdomainDAO",                 flags: "js|java" },
    { name: "SubdomainAware",                       flags: "js|java" },
    { name: "SubdomainAwareDAO",                    flags: "js|java" },
    { name: "SubdomainPredicate",                   flags: "js|java" },
    { name: "Theme",                                flags: "js|java" },
    { name: "ThemeDomain",                          flags: "js|java" },
    { name: "ThemeDomainHasAllCapabilitiesGrantedPredicate", flags: "js|java" },
    { name: "ThemeDomainsDAO",                      flags: "js|java" },
    { name: "Themes",                               flags: "js|java" },
    { name: "ThemeService",                         flags: "js|java" },
    { name: "customisation/CSSTokenOverride",       flags: "js|java" },
    { name: "customisation/CSSTokenOverrideService", flags: "web" },
    { name: "customisation/ThemeCustomisationBrowseController", flags: "web" },
    { name: "customisation/ThemeCustomisationView", flags: "web" },
    { name: "customisation/ThemeFacade",            flags: "web" },
    { name: "customisation/ThemeImageUploadView",   flags: "web" }
  ]
});
