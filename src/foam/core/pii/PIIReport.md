<flow name="PIIReport" category="DOC/DEV" spid="foam"/>
<title>PII Report</title>
<h1>Personal Identifiable Information (PII)</h1>
<p>FOAM provides for <b>General Data Protection Regulation (GDPR)</b> reporting of PII. The EU GDPR provides for the end user to inquire into PII held by a system, and additionally, deletion of said data if it does not conflict with superceeding requirements.</p>
<p>Currently, only reporting is considered. Data retention is left as future work and/or left to the application. In banking applications, for example, banking regulations trump GDPR for data retention.</p>

<h2>Report Generation</h2>
<p>Report generation is invoked in two ways</p>
<ol>
<li>action: <b>PII Report</b>
<p>Grant operations groups permission <b>user.action.pii</b> to allow them to generate a <b>PIIReportTicket</b> for a user.</p>
<p>An operator can select a user and then selection action <b>PII Report</b>. This will create a <b>PIIReportTicket</b> and redirect the operator to the ticket detail view.  The operator can review the Key Value document and then <b>CLOSE</b> the ticket to send the email</p>
</li>
<li>menu: <b>Settings -> PII Report</b>
<p>Grant end user groups permission <b>menu.read.settings</b> and <b>menu.read.pii-report</b> for access to the <b>Settings</b> menu <b>PII Report</b> sub menu, which allows the user to generate and email themselves their PII Report.  This process also creates an <b>PIIReportTicket</b> which is immediately <b>CLOSED</b> to send the email.</p>
</li>
</ol>

<h2>PIIReportTicket</h2>
<p>PII Request is implemented through the <b>PIIReportTicket</b></p>
<p>A user selection of the <b>PII Report</b> menu will create a <b>PIIReportTicket</b> to capture and process the users request.  The <b>PIIReportTicket</b> generates a PDF of PII Key Value pairs throughout the system and attaches to an email, along with other PII documents, and then emails the results to the user.</p>

<h2>Data Identification</h2>
<p>PII data can be identified at the property level or at the model level</p>
<ol>
<li>At the property level, properties are tagged with meta property <b>containsPII</b>
<code>
  properties: [
   ...
    {
      class: 'String',
      name: 'firstName',
      containsPII: true
      ...
    }
</code>
</li>
<li>At the model level, the model implements method <b>piiSummary</b>
<p>See <pre>foam/core/pii/AddressRefine.js</pre></p>
</li>
</ol>

<h2>Data Collection</h2>
<p>PII data collection is implemented in rule <b>PIIReportTicketRuleAction</b>. The FOAM rule collects <b>User</b> and <b>UserCapabilityJunction</b> data. An application can add it's own rule, overriding rule id <b>foam-core-pii-PIIReportTicketRule</b> with it's own rule action extending the FOAM action and calling <b>super.addData</b>.</p>

<h2>Email</h2>
<p>When the <b>PIIReportTicket</b> is <b>CLOSED</b> the <b>PIIReportTicketSendRuleAction</b> will send an email with all documents attached.</p>
<p>As an operator - to resend the email, simply <b>OPEN</b> and <b>CLOSED</b> the ticket.</p>