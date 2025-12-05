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
    { name: "ServerUserReferralCodeService",                          flags: "js|java" },
    { name: "UserReferralCodeService",                                flags: "js|java" }
  ]
});
