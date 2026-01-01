foam.POM({
  name: "referral",
  projects: [
    { name: "test/pom", flags: "test" }
],
  files: [
    { name: "ReferralCode",                                           flags: "js|java" },
    { name: "BuildReferralCodeURLRuleAction",                         flags: "js|java" },
    { name: "CreateReferralCodeRuleAction",                           flags: "js|java" },
    { name: "ReferUserView",                                          flags: "web" },
    { name: "ReferralBorder",                                         flags: "web" },
    { name: "Relationships",                                          flags: "js|java" },
    { name: "ReferralCodeGeneratorService",                           flags: "js|java" },
    { name: "IdReferralCodeGenerationService",                        flags: "js|java" },
    { name: "DisableOldReferralCodesRuleAction",                      flags: "js|java" }
  ]
});
