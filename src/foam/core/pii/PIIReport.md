<flow name="PIIReport" category="DOC/DEV" spid="foam" label="PII Report" description="GDPR PII reporting: PIIReportTicket generation via action or settings menu, PII property tagging, and email delivery." keywords="pii,gdpr,piireportticket,privacy"/>

# Personal Identifiable Information (PII)

FOAM provides for **General Data Protection Regulation (GDPR)** reporting of PII. The EU GDPR provides for the end user to inquire into PII held by a system, and additionally, deletion of said data if it does not conflict with superceeding requirements.

Currently, only reporting is considered. Data retention is left as future work and/or left to the application. In banking applications, for example, banking regulations trump GDPR for data retention.

## Report Generation

Report generation is invoked in two ways

1. action: **PII Report** 

Grant operations groups permission **user.action.pii** to allow them to generate a **PIIReportTicket** for a user.

 

An operator can select a user and then selection action **PII Report**. This will create a **PIIReportTicket** and redirect the operator to the ticket detail view. The operator can review the Key Value document and then **CLOSE** the ticket to send the email

2. menu: **Settings -> PII Report** 

Grant end user groups permission **menu.read.settings** and **menu.read.pii-report** for access to the **Settings** menu **PII Report** sub menu, which allows the user to generate and email themselves their PII Report. This process also creates an **PIIReportTicket** which is immediately **CLOSED** to send the email.

## PIIReportTicket

PII Request is implemented through the **PIIReportTicket**

A user selection of the **PII Report** menu will create a **PIIReportTicket** to capture and process the users request.  The **PIIReportTicket** generates a PDF of PII Key Value pairs throughout the system and attaches to an email, along with other PII documents, and then emails the results to the user.

## Data Identification

PII data can be identified at the property level or at the model level

1. At the property level, properties are tagged with meta property **containsPII** 
```
  properties: [
   ...
    {
      class: 'String',
      name: 'firstName',
      containsPII: true
      ...
    }
```

2. At the model level, the model implements method **piiSummary** 

See `foam/core/pii/AddressRefine.js`

## Data Collection

PII data collection is implemented in rule **PIIReportTicketRuleAction**. The FOAM rule collects **User** and **UserCapabilityJunction** data. An application can add it's own rule, overriding rule id **foam-core-pii-PIIReportTicketRule** with it's own rule action extending the FOAM action and calling **super.addData**.

## Email

When the **PIIReportTicket** is **CLOSED** the **PIIReportTicketSendRuleAction** will send an email with all documents attached.

As an operator - to resend the email, simply **OPEN** and **CLOSED** the ticket.
