# FOAM3 Email System Architecture

## Table of Contents
1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Architecture](#architecture)
4. [Key Concepts](#key-concepts)
5. [Configuration Classes](#configuration-classes)
6. [Email Agents](#email-agents)
7. [Property Service Chain](#property-service-chain)
8. [Template System](#template-system)
9. [Rule Engine Integration](#rule-engine-integration)
10. [DAOs and Data Flow](#daos-and-data-flow)
11. [Microsoft Graph Integration](#microsoft-graph-integration)
12. [Gotchas](#gotchas)

---

## Quick Start

1. Create an `EmailServiceConfig` entry in `emailServiceConfig.jrl` with SMTP credentials
2. Create `EmailTemplate` entries in `emailTemplates.jrl` with your email body/subject
3. Create `EmailConfig` entry in `emailConfig.jrl` for per-SPID defaults
4. Put an `EmailMessage` with `status: DRAFT` to `emailMessageDAO` - the system handles the rest

### What Are These Configuration Entries?

```
+-------------------+     +-------------------+     +-------------------+
| EmailServiceConfig|     | EmailTemplate     |     | EmailConfig       |
+-------------------+     +-------------------+     +-------------------+
| HOW to send       |     | WHAT to send      |     | WHO sends it      |
|                   |     |                   |     |                   |
| - SMTP host/port  |     | - Subject         |     | - from address    |
| - Credentials     |     | - Body HTML       |     | - replyTo address |
| - TLS settings    |     | - Variables       |     | - displayName     |
| - Poll interval   |     | - Per group/locale|     | - Per SPID        |
+-------------------+     +-------------------+     +-------------------+
```

**EmailServiceConfig** - "How to connect to the mail server"

The connection configuration that tells the system HOW to send emails: SMTP host, port, username/password, TLS settings. Think of it as the mail server login credentials.

**EmailTemplate** - "What the email looks like"

The email content - the actual subject and body with variable placeholders like `{{ userName }}`. Templates can vary by group, locale, and SPID. Think of it as a reusable email blueprint.

**EmailConfig** - "Who sends the email"

The sender defaults per SPID (tenant) - default `from`, `replyTo`, and `displayName` values. Think of it as the "From:" line defaults for each tenant.

---

## Overview

### What It Does

The FOAM3 Email System is a comprehensive, rule-driven email processing pipeline that:

- **Sends emails** via SMTP or Microsoft Graph API
- **Receives emails** via IMAP/POP3 protocols
- **Processes templates** with variable substitution and inheritance
- **Applies cascading configuration** from theme, group, and SPID sources
- **Validates messages** before sending
- **Throttles delivery** to respect provider rate limits
- **Tracks status** through the complete email lifecycle

### Key Files

| File | Purpose |
|------|---------|
| `EmailMessage.js` | Core email data model with status tracking |
| `EmailServiceConfig.js` | SMTP/IMAP connection configuration |
| `EmailTemplate.js` | Reusable email templates with variable support |
| `EmailConfig.js` | Per-SPID default sender configuration |
| `SMTPAgent.js` | SMTP sending agent (polls for UNSENT emails) |
| `EmailFolderAgent.js` | IMAP receiving agent (polls for new emails) |
| `MicrosoftGraphEmailAgent.js` | Microsoft 365 sending via Graph API |
| `ChainedPropertyService.js` | Orchestrates the property service pipeline |
| `EmailTemplateEngine.js` | Template variable substitution engine |
| `EmailTemplateSupport.java` | Template lookup with fallback logic |

---

## Architecture

### High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                              FOAM3 Email System                                    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-------------------------+     +-------------------------+                      |
|  |   EMAIL CREATION        |     |   EMAIL RECEIVING       |                      |
|  |  (Notification/Direct)  |     |   (IMAP/POP3)          |                      |
|  +------------+------------+     +------------+------------+                      |
|               |                               |                                   |
|               v                               v                                   |
|  +------------+------------+     +------------+------------+                      |
|  |  emailMessageDAO        |     | emailMessageReceivedDAO |                      |
|  |  (status: DRAFT)        |     | (status: RECEIVED)      |                      |
|  +------------+------------+     +------------+------------+                      |
|               |                               |                                   |
|               v                               v                                   |
|  +------------+---------------------------------------------------+              |
|  |                      RULE ENGINE                                |              |
|  |  +------------------+  +------------------+  +----------------+ |              |
|  |  | PropertyService  |  | Status Rule      |  | Processed Rule | |              |
|  |  | Rule (pri:1000)  |  | (pri:100)        |  | (pri:0)        | |              |
|  |  +------------------+  +------------------+  +----------------+ |              |
|  +----------------------------------------------------------------+              |
|               |                                                                   |
|               v                                                                   |
|  +------------+------------+                                                      |
|  |  emailMessageDAO        |                                                      |
|  |  (status: UNSENT)       |                                                      |
|  +------------+------------+                                                      |
|               |                                                                   |
|               v                                                                   |
|  +------------+-------------------------------------------+                       |
|  |                   EMAIL AGENTS                          |                       |
|  |  +----------------+  +----------------+  +------------+ |                       |
|  |  |  SMTPAgent     |  | MSGraphAgent   |  | FolderAgent| |                       |
|  |  |  (id: smtp)    |  | (id: msGraph)  |  | (id: imap) | |                       |
|  |  +----------------+  +----------------+  +------------+ |                       |
|  +--------------------------------------------------------+                       |
|               |                                                                   |
|               v                                                                   |
|  +------------+------------+                                                      |
|  |   EXTERNAL SERVERS      |                                                      |
|  |  SMTP / Graph API       |                                                      |
|  +-------------------------+                                                      |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### Property Service Chain Architecture

```
+-----------------------------------------------------------------------------------+
|                        ChainedPropertyService                                      |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   EmailMessage (DRAFT)                                                            |
|        |                                                                          |
|        v                                                                          |
|   +----+------------------------------------------+                               |
|   | 1. ApplyBaseArgumentsEmailPropertyService     |                               |
|   |    - Sets SPID from user                      |                               |
|   |    - Loads theme, appConfig, supportConfig    |                               |
|   |    - Populates templateArgs (logo, appLink,   |                               |
|   |      supportEmail, hostname, etc.)            |                               |
|   +-----------------------------------------------+                               |
|        |                                                                          |
|        v                                                                          |
|   +----+------------------------------------------+                               |
|   | 2. EmailTemplateApplyEmailPropertyService     |                               |
|   |    - Finds EmailTemplate by name/group/locale |                               |
|   |    - Applies template to emailMessage         |                               |
|   |    - Renders body, subject with variables     |                               |
|   +-----------------------------------------------+                               |
|        |                                                                          |
|        v                                                                          |
|   +----+------------------------------------------+                               |
|   | 3. GroupEmailTemplateService                  |                               |
|   |    - Walks group hierarchy for replyTo, from  |                               |
|   |    - Inherits from parent groups              |                               |
|   +-----------------------------------------------+                               |
|        |                                                                          |
|        v                                                                          |
|   +----+------------------------------------------+                               |
|   | 4. EmailConfigEmailPropertyService            |                               |
|   |    - Loads EmailConfig by SPID                |                               |
|   |    - Sets replyTo, displayName, from, to      |                               |
|   +-----------------------------------------------+                               |
|        |                                                                          |
|        v                                                                          |
|   +----+------------------------------------------+                               |
|   | 5. EmailMessageValidationPropertyService      |                               |
|   |    - Validates: to, subject, body are set     |                               |
|   |    - Throws InvalidParameterException if not  |                               |
|   +-----------------------------------------------+                               |
|        |                                                                          |
|        v                                                                          |
|   EmailMessage (validated, ready for UNSENT)                                      |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## Key Concepts

### Email Status Lifecycle

| Status | Ordinal | Description |
|--------|---------|-------------|
| DRAFT | 0 | Initial state - triggers rule processing |
| UNSENT | 1 | Processed and validated - ready for agent pickup |
| SENT | 2 | Successfully delivered to mail server |
| FAILED | 3 | Delivery failed (permanent) |
| BOUNCED | 4 | Message bounced back |
| RECEIVED | 5 | Inbound email received via IMAP/POP3 |
| PROCESSED | 6 | Received email has been processed |

### Configuration Hierarchy

Configuration values are resolved in order of precedence (first match wins):

1. **EmailMessage** - explicitly set properties on the message
2. **EmailTemplate** - template-level defaults
3. **Group** - user's group hierarchy (walks up to root)
4. **EmailConfig** - SPID-level defaults
5. **Theme/SupportConfig** - theme-level defaults

### Template Variable Substitution

The EmailTemplateEngine supports three syntax patterns:

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{{ variable }}` | Simple variable substitution | `{{ appName }}` |
| `{{ object.property }}` | Object property access | `{{ user.firstName }}` |
| `{% if var %}...{% endif %}` | Conditional blocks | `{% if showLogo %}...{% endif %}` |
| `{% if var %}...{% else %}...{% endif %}` | Conditional with else | `{% if premium %}...{% else %}...{% endif %}` |
| `{$ tokenName $}` | CSS token substitution | `{$ primary500 $}` |
| `<include template='name'>...</include>` | Template inheritance | See Template Inheritance section |

---

## Configuration Classes

### EmailServiceConfig

Base configuration for email service connections (SMTP/IMAP).

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| id | String | 'default' | Unique identifier (e.g., 'smtp', 'imap', 'msGraph') |
| enabled | Boolean | false | Whether this config is active |
| host | String | '127.0.0.1' | Mail server hostname |
| port | String | '587' | Mail server port |
| username | String | null | Authentication username |
| password | Password | null | Authentication password |
| authenticate | Boolean | true | Whether to use authentication |
| starttls | Boolean | true | Whether to use STARTTLS |
| protocol | String | 'smtp' | Protocol: 'smtp' or 'imaps' |
| pollInterval | Long | 10000 | Agent polling interval (ms) |
| initialDelay | Int | 60000 | Agent startup delay (ms) |
| folderName | String | 'INBOX' | Folder to fetch (IMAP only) |
| delete | Boolean | false | Delete after fetch (IMAP only) |
| processAttachments | Boolean | true | Process attachments (IMAP only) |

### EmailServiceConfig (Microsoft Graph Extension)

Additional properties for Microsoft Graph API authentication.

| Property | Type | Description |
|----------|------|-------------|
| clientId | String | Microsoft Graph API client ID |
| tenantId | String | Microsoft Graph API tenant ID |
| password | String | Client secret (uses base class password field) |

### EmailConfig

Per-SPID email defaults (keyed by SPID).

| Property | Type | Description |
|----------|------|-------------|
| spid | Reference | Service Provider ID (primary key) |
| from | String | Default sender email address |
| displayName | String | Default sender display name |
| replyTo | String | Default reply-to address |

### EmailTemplate

Reusable email templates with variable support.

| Property | Type | Description |
|----------|------|-------------|
| id | String | Unique identifier |
| name | String | Template name (used for lookup) |
| group | String | Group filter ('*' for all) |
| locale | String | Locale filter ('en' default) |
| spid | String | SPID filter (empty for all) |
| subject | String | Email subject (supports variables) |
| body | String | Email body HTML (supports variables) |
| displayName | String | Sender display name |
| sendTo | String | Default recipient |
| replyTo | String | Reply-to address |
| enabled | Boolean | Whether template is active |
| sourceClass | String | Tracking: which class uses this template |

### EmailMessage

The core email data model.

| Property | Type | Description |
|----------|------|-------------|
| id | String | Unique message identifier |
| user | Reference | Target user for this email |
| status | Enum | Current status (DRAFT, UNSENT, SENT, etc.) |
| from | String | Sender address |
| displayName | String | Sender display name |
| replyTo | String | Reply-to address |
| to | StringArray | Recipient addresses |
| cc | StringArray | CC addresses |
| bcc | StringArray | BCC addresses |
| subject | String | Email subject |
| body | String | Email body (HTML) |
| templateArguments | Map | Variables for template rendering |
| attachments | StringArray | File IDs for attachments |
| sentDate | DateTime | When the email was sent |
| created | DateTime | When the message was created |
| spid | Reference | Service provider ID |

---

## Email Agents

### SMTPAgent

The primary sending agent for SMTP protocol.

**Service ID:** `smtp` (references EmailServiceConfig with id='smtp')

**Behavior:**
1. Starts a timer on `start()` using config's `initialDelay` and `pollInterval`
2. On each execution cycle:
   - Queries `emailMessageDAO` for messages with `status=UNSENT`
   - For each message, throttles (via `smtpAgentThrottle`), then sends
   - Updates message status to SENT or FAILED
3. Maintains SMTP session/transport for connection reuse
4. Auto-disables on repeated authentication failures
5. Reloads configuration if it changes between polling cycles

**Key Methods:**
- `start()` - Initialize timer and begin polling
- `stop()` - Cancel timer
- `execute()` - Process unsent emails
- `send()` - Send individual email via SMTP
- `createMimeMessage()` - Convert EmailMessage to MimeMessage
- `reload()` - Hot-reload configuration changes

### EmailFolderAgent

The receiving agent for IMAP/POP3 protocols.

**Service ID:** `imap` (references EmailServiceConfig with id='imap')

**Behavior:**
1. Starts a timer on `start()` using config's `initialDelay` and `pollInterval`
2. On each execution cycle:
   - Connects to mail server using config credentials
   - Opens configured folder (default: INBOX)
   - Searches for unread messages
   - For each message:
     - Converts to EmailMessage (status=RECEIVED)
     - Processes attachments (saves to fileDAO)
     - Looks up sender user by email
     - Puts to `emailMessageReceivedDAO`
     - Marks as SEEN or deletes based on config
3. Closes connection after each cycle

### MicrosoftGraphEmailAgent

Sending agent for Microsoft 365 via Graph API (extends SMTPAgent).

**Service ID:** `msGraph` (references ms.EmailServiceConfig with id='msGraph')

**Behavior:**
1. Uses OAuth2 client credentials flow for authentication
2. Acquires access token with scope `https://outlook.office365.com/.default`
3. Sends via Exchange Web Services (EWS) with OAuth bearer token
4. Automatically refreshes token when within 5 minutes of expiry
5. Uses impersonation header for app-only token scenarios
6. Throttles via `microsoftGraphEmailAgentThrottle` (default: 4 TPS)

**Configuration Requirements:**
- `clientId` - Azure AD application client ID
- `tenantId` - Azure AD tenant ID
- `password` - Client secret
- `username` - Email address to send from (for impersonation)

---

## Property Service Chain

The `emailPropertyService` is a `ChainedPropertyService` that processes each EmailMessage through a pipeline of services. Each service in the chain can modify the email, adding properties that weren't already set.

### Service Order and Responsibilities

| Order | Service | Priority | Responsibility |
|-------|---------|----------|----------------|
| 1 | ApplyBaseArgumentsEmailPropertyService | Highest | Sets SPID, loads theme/support config, populates base templateArgs |
| 2 | EmailTemplateApplyEmailPropertyService | - | Finds template, renders body/subject/displayName/replyTo/sendTo |
| 3 | GroupEmailTemplateService | - | Inherits replyTo/displayName/from from group hierarchy |
| 4 | EmailConfigEmailPropertyService | - | Applies per-SPID defaults from EmailConfig |
| 5 | EmailMessageValidationPropertyService | Lowest | Validates required fields (to, subject, body) |

### Built-in Template Arguments

The `ApplyBaseArgumentsEmailPropertyService` automatically populates these variables:

| Variable | Source | Description |
|----------|--------|-------------|
| logo | Theme | URL to theme logo |
| largeLogo | Theme | URL to large theme logo |
| appLink | AppConfig | Application base URL |
| appName | Theme | Application name |
| locale | User | User's language code |
| supportAddress | SupportConfig | Support postal address |
| supportPhone | SupportConfig | Support phone number |
| supportEmail | SupportConfig | Support email address |
| supportLogo | SupportConfig | Support logo URL |
| termsAndCondLink | AppConfig | Terms and conditions URL |
| termsAndCondLabel | AppConfig | Terms and conditions label |
| copyright | AppConfig | Copyright text |
| privacyUrl | AppConfig | Privacy policy URL |
| privacyLabel | AppConfig | Privacy policy label |
| personalSupportPhone | SupportConfig | Personal support user phone |
| personalSupportEmail | SupportConfig | Personal support user email |
| personalSupportFirstName | SupportConfig | Personal support user first name |
| personalSupportFullName | SupportConfig | Personal support user full name |
| hostname | System | Server hostname |
| theme | Theme | Full theme object for advanced use |

---

## Template System

### Template Lookup Logic

The `EmailTemplateSupport.findTemplate()` method searches for templates with cascading fallback:

```
Search Order (first match wins):
+-------+-------+--------+------+
| Name  | Group | Locale | SPID |
+-------+-------+--------+------+
|   Y   |   Y   |   Y    |   Y  |  <- Most specific
|   Y   |   Y   |   Y    |   *  |
|   Y   |   Y   |   en   |   Y  |
|   Y   |   Y   |   en   |   *  |
|   Y   | parent|   Y    |   Y  |  <- Walk group hierarchy
|   Y   | parent|   Y    |   *  |
|   Y   | parent|   en   |   Y  |
|   Y   | parent|   en   |   *  |
|   Y   |   *   |   en   |   Y  |
|   Y   |   *   |   en   |   *  |  <- Least specific (catch-all)
+-------+-------+--------+------+
```

### Template Inheritance

Templates can extend other templates using the `<include>` tag:

```
Parent Template (base-email):
+----------------------------------+
| <html>                           |
|   <head>...</head>               |
|   <body>                         |
|     <header>Logo</header>        |
|     <content></content>          |  <- Insertion point
|     <footer>Copyright</footer>   |
|   </body>                        |
| </html>                          |
+----------------------------------+

Child Template (welcome-email):
+----------------------------------+
| <include template='base-email'>  |
|   <h1>Welcome!</h1>              |
|   <p>Hello {{ userName }}</p>    |
| </include>                       |
+----------------------------------+

Rendered Result:
+----------------------------------+
| <html>                           |
|   <head>...</head>               |
|   <body>                         |
|     <header>Logo</header>        |
|     <h1>Welcome!</h1>            |
|     <p>Hello John</p>            |
|     <footer>Copyright</footer>   |
|   </body>                        |
| </html>                          |
+----------------------------------+
```

---

## Rule Engine Integration

### Email Rules

Three rules process emails on `localEmailMessageDAO`:

| Rule ID | Priority | Predicate | Action | Purpose |
|---------|----------|-----------|--------|---------|
| EmailMessagePropertyServiceRule | 1000 | status=DRAFT | EmailMessagePropertyServiceRuleAction | Process through property service chain |
| EmailMessageStatusRule | 100 | status=DRAFT | EmailMessageStatusRuleAction | Set status to UNSENT |
| EmailMessageProcessedStatusRule | 0 | status=PROCESSED | DAOPutRuleAction | Move to emailMessageProcessedDAO |

### Rule Execution Flow

```
EmailMessage PUT (status: DRAFT)
        |
        v
+-------+-------+
| Rule Engine   |
| daoKey:       |
| localEmail-   |
| MessageDAO    |
+-------+-------+
        |
        | Priority 1000
        v
+-------+-------+
| PropertySvc   |
| Rule          |
| - Apply chain |
| - Render      |
|   template    |
| - Validate    |
+-------+-------+
        |
        | Priority 100
        v
+-------+-------+
| Status Rule   |
| - Set status  |
|   to UNSENT   |
+-------+-------+
        |
        v
EmailMessage (status: UNSENT)
        |
        v
SMTPAgent picks up and sends
```

---

## DAOs and Data Flow

### Email DAOs

| DAO | Purpose | Journal |
|-----|---------|---------|
| localEmailTemplateDAO | Template storage | emailTemplates |
| emailTemplateDAO | Template access (wraps local) | - |
| localEmailMessageDAO | Outbound message storage | emailMessages |
| emailMessageDAO | Outbound message access | - |
| localEmailMessageReceivedDAO | Inbound message storage | emailMessagesReceived |
| emailMessageReceivedDAO | Inbound message access | - |
| localEmailMessageProcessedDAO | Processed inbound storage | emailMessagesProcessed |
| emailMessageProcessedDAO | Processed inbound access | - |
| emailConfigDAO | Per-SPID config | emailConfig |
| emailServiceConfigDAO | Connection config | emailServiceConfig |

### Complete Data Flow

```
OUTBOUND EMAIL FLOW:
+-------------------+     +-------------------+     +-------------------+
| Application Code  |     | localEmailMessage |     | Rule Engine       |
| creates           |---->| DAO               |---->| processes         |
| EmailMessage      |     | (status: DRAFT)   |     | (status: UNSENT)  |
| (status: DRAFT)   |     |                   |     |                   |
+-------------------+     +-------------------+     +--------+----------+
                                                             |
                          +-------------------+              |
                          | SMTPAgent or      |<-------------+
                          | MSGraphAgent      |
                          | polls & sends     |
                          | (status: SENT/    |
                          |  FAILED)          |
                          +-------------------+

INBOUND EMAIL FLOW:
+-------------------+     +-------------------+     +-------------------+
| EmailFolderAgent  |     | emailMessage-     |     | Application       |
| polls IMAP        |---->| ReceivedDAO       |---->| processes         |
| folder            |     | (status: RECEIVED)|     | (status: PROCESSED|
+-------------------+     +-------------------+     +--------+----------+
                                                             |
                          +-------------------+              |
                          | emailMessage-     |<-------------+
                          | ProcessedDAO      |
                          | (archival)        |
                          +-------------------+
```

---

## Microsoft Graph Integration

### Configuration Requirements

To use Microsoft Graph for sending emails:

1. **Azure AD Application Setup:**
   - Register an application in Azure AD
   - Grant `Mail.Send` permission (application permission)
   - Create a client secret
   - Note the client ID and tenant ID

2. **EmailServiceConfig Setup:**
   - Create entry with `class: foam.core.notification.email.ms.EmailServiceConfig`
   - **CRITICAL:** Use `id: 'msGraph'` (not 'msGraphConfig' or other names)
   - Set `clientId`, `tenantId`, `password` (client secret), `username` (sending address)

3. **Agent Configuration:**
   - The `microsoftGraphEmailAgent` service references config with `id: 'msGraph'`
   - Set `enabled: true` in services.jrl to activate

### ID Matching Requirement

```
+----------------------------------+     +----------------------------------+
| MicrosoftGraphEmailAgent         |     | ms.EmailServiceConfig            |
|                                  |     |                                  |
| properties:                      |     | Journal Entry:                   |
|   id: {                          |     |   id: 'msGraph'  <-- MUST MATCH  |
|     class: 'Reference',          |---->|   clientId: '...'                |
|     value: 'msGraph'  <--        |     |   tenantId: '...'                |
|   }                              |     |   password: '...'                |
+----------------------------------+     +----------------------------------+
```

---

## Gotchas

### 1. EmailServiceConfig ID Mismatch

**Issue:** Microsoft Graph emails not sending; agent can't find config.

**Solution:** The `MicrosoftGraphEmailAgent` looks for config with `id: 'msGraph'` (not 'msGraphConfig'). Ensure your config entry uses `id: 'msGraph'` exactly.

### 2. Template Not Found

**Issue:** Email body is empty or uses wrong template.

**Solution:** Check template lookup order:
- Template must have matching `name` or `id`
- Group must match user's group or be `*`
- Locale must match or fall back to `en`
- SPID must match or be empty

### 3. Rule Not Triggering

**Issue:** Email stuck in DRAFT status.

**Solution:** Ensure the email rules are enabled in `rules.jrl`. The rules trigger on PUT to `localEmailMessageDAO` when `status=DRAFT`.

### 4. Agent Not Starting

**Issue:** Emails stuck in UNSENT status.

**Solution:**
- Check `EmailServiceConfig.enabled` is `true`
- Agent services have `lazy: false` - they start at boot
- Check EventRecord DAO for startup/error events

### 5. Template Variables Not Replaced

**Issue:** Email shows `{{ variableName }}` instead of value.

**Solution:**
- Ensure variable is in `templateArguments` map
- Check for typos in variable names
- Variable names support alphanumeric, dash, caret, underscore only
- For object properties, use `{{ object.property }}` syntax

### 6. Attachments Not Working

**Issue:** Attachments missing from sent email.

**Solution:**
- Attachments are file IDs (strings), not file objects
- Files must exist in `fileDAO`
- Both `IdentifiedBlob` and `InputStreamBlob` are supported

### 7. Rate Limiting

**Issue:** Emails failing with "Too many login attempts" or similar.

**Solution:**
- SMTP default throttle: 14 TPS (smtpAgentThrottle)
- MS Graph default throttle: 4 TPS (microsoftGraphEmailAgentThrottle)
- Adjust `foam.core.pool.Throttle.rate` if needed

### 8. SVG Images in Emails

**Issue:** SVG images not displaying in email clients.

**Solution:** The `EmailMessagePropertyServiceRuleAction` automatically replaces `.svg` extensions with `.png` in the body. Ensure PNG versions exist at same paths.

### 9. IMAP Delete vs Mark as Read

**Issue:** Emails reprocessed after restart.

**Solution:** Set `EmailServiceConfig.delete: true` to delete after processing. Default (`false`) only marks as SEEN, which may not persist across restarts with some providers.

---

## Related Documentation

- `foam3/doc/guides/email-setup.md` - Step-by-step setup guide
- `foam3/src/foam/core/notification/` - Notification system (often triggers emails)
- `foam3/src/foam/core/theme/` - Theme system (provides email styling context)
