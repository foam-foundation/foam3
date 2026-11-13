/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "ticket",
  projects: [
    { name: "test/pom", flags: "test" }
  ],
  files: [
    { name: "Ticket",                               flags: "js|java" },
    { name: "TicketComment",                        flags: "js|java" },
    { name: "TicketCitationView",                   flags: "js" },
    { name: "TicketStatus",                         flags: "js|java" },
    { name: "TicketStatusReferenceCitationView",    flags: "js" },
    { name: "Relationships",                        flags: "js" },
    { name: "TicketAddCommentDAO",                  flags: "js|java" },
    { name: "TicketOwnerDAO",                       flags: "js|java" },
    { name: "TicketCommentOwnerDAO",                flags: "js|java" },
    { name: "TicketDAOCreateView",                  flags: "js" },
    { name: "TicketSummaryView",                    flags: "js" },
    { name: "TicketNotification",                   flags: "js|java" },
    { name: "TicketNotificationNotificationCitationView", flags: "js" },
    { name: "TicketNotificationRuleAction",         flags: "js|java" },
    { name: "SummaryCard",                          flags: "js" },
    { name: "TicketCloseCommand",                   flags: "js|java" },
    { name: "CloseTicketCommandDAO",                flags: "js|java" }
  ]
})
