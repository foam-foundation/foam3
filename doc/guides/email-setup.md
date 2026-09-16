<flow name="email-setup" category="DOC/GUIDE" spid="foam"/>
# Email Setup Guide with Foam

This step-by-step guide will help you set up and configure email notifications in your Foam application. We'll use real examples from the Foam codebase to demonstrate each step.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Configure Email Service](#step-1-configure-email-service)
3. [Step 2: Set Up Email Templates](#step-2-set-up-email-templates)
4. [Step 3: Configure Notification Settings](#step-3-configure-notification-settings)
5. [Step 4: Implement Email Notifications](#step-4-implement-email-notifications)
6. [Step 5: Testing](#step-5-testing)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:
- A valid SMTP server (e.g., Gmail, SendGrid, etc.)
- User email addresses configured in your system
- Basic understanding of Foam's DAO system

## Step 1: Configure Email Service

1. Create a new file `deployment/your-environment/emailServiceConfig.jrl`:

```javascript
p({
  class: 'foam.core.notification.email.EmailServiceConfig',
  id: 'smtp',
  enabled: true,
  host: 'your-smtp-server.com',
  port: '587',
  username: 'your-username',
  password: 'your-password',
  authenticate: true,
  starttls: true,
  protocol: 'smtp',
  rateLimit: 14  // Default rate limit for smtp.gmail.com
})
```

**Example from Foam**: See `foam3/deployment/test/emailServiceConfig.jrl` for a test configuration.

## Step 2: Set Up Email Templates

1. Create a new file `deployment/your-environment/emailTemplates.jrl`:

```javascript
p({
  class: 'foam.core.notification.email.EmailTemplate',
  id: 'welcome-email',
  name: 'welcome-email',
  group: 'your-group',
  locale: 'en',
  displayName: '{{appName}}',
  subject: 'Welcome to {{appName}}'
})
```

**Example from Foam**: See `foam3/deployment/test/emailTemplates.jrl` for template examples.

2. Create a new file `deployment/your-environment/notificationTemplates.jrl`:

```javascript
p({
  class: 'foam.core.notification.Notification',
  id: 'welcome-notification',
  template: 'welcome-notification',
  emailName: 'welcome-email',
  groupId: 'your-group',
  notificationType: 'WELCOME'
})
```

**Example from Foam**: See `foam3/deployment/test/notificationTemplates.jrl` for notification template examples.

## Step 3: Configure Notification Settings

1. Create a new file `deployment/your-environment/notificationSettings.jrl`:

```javascript
p({
  class: 'foam.core.notification.EmailSetting',
  id: 'user-email-setting',
  owner: userId,
  enabled: true
})
```

**Example from Foam**: See `foam3/deployment/test/notificationSettings.jrl` for settings examples.

## Step 4: Implement Email Notifications

### Option 1: Using Notification DAO Directly

Create a new Java class in your project:

```java
package your.package.notification;

import foam.core.X;
import foam.dao.DAO;
import foam.core.notification.Notification;
import java.util.HashMap;
import java.util.Map;

public class WelcomeEmailService {
    private final DAO notificationDAO;

    public WelcomeEmailService(X x) {
        this.notificationDAO = (DAO) x.get("notificationDAO");
    }

    public void sendWelcomeEmail(X x, long userId) {
        Notification notification = new Notification();
        notification.setTemplate("welcome-notification");
        notification.setEmailName("welcome-email");
        notification.setBody("Welcome to our application!");
        notification.setUserId(userId);

        Map<String, Object> emailArgs = new HashMap<>();
        emailArgs.put("templateSource", this.getClass().getName());
        notification.setEmailArgs(emailArgs);

        notificationDAO.put_(x, notification);
    }
}
```

**Example from Foam**: See `foam3/src/foam/core/notification/test/EmailNotificationTest.java` for a complete example.

### Option 2: Using DAO Notification Rules

1. Create a new rule action class:

```java
package your.package.notification;

import foam.core.notification.DAONotificationRuleAction;
import foam.core.X;
import foam.core.FObject;
import foam.core.Rule;
import java.util.HashMap;
import java.util.Map;

public class UserCreatedNotificationRuleAction extends DAONotificationRuleAction {
    @Override
    public void applyAction(X x, FObject obj, FObject oldObj, Rule rule) {
        if (!(obj instanceof User)) return;

        User user = (User) obj;
        Map<String, Object> args = new HashMap<>();
        args.put("userName", user.getLegalName());
        args.put("templateSource", this.getClass().getName());

        Notification notification = new Notification();
        notification.setTemplate("welcome-notification");
        notification.setEmailName("welcome-email");
        notification.setBody("Welcome " + user.getLegalName() + "!");
        notification.setUserId(user.getId());
        notification.setEmailArgs(args);

        ((DAO) x.get("notificationDAO")).put_(x, notification);
    }
}
```

2. Register the rule in `deployment/your-environment/rules.jrl`:

```javascript
p({
  "class":"foam.core.ruler.Rule",
  "id":"your-package-notification-UserCreatedNotificationRule",
  "name":"UserCreatedNotificationRule",
  "documentation":"Generate notification to new user on user creation",
  "enabled":true,
  "ruleGroup": "auth",
  "daoKey": "localUserDAO",
  "operation": 0,
  "lifecycleState": 1,
  action: {
    "class": "your.package.notification.UserCreatedNotificationRuleAction"
  }
})
```

**Example from Foam**: See `foam3/src/foam/core/notification/DAONotificationRuleAction.js` for rule action examples.

## Step 5: Testing

1. Create a test configuration in `deployment/test/emailServiceConfig.jrl`:

```javascript
p({
  class: 'foam.core.notification.email.EmailServiceConfig',
  id: 'test',
  enabled: false,
  rateLimit: 2,
  pollInterval: 2,
  initialDelay: 1
})
```

2. Create a test class:

```java
package your.package.notification.test;

import foam.core.test.Test;
import foam.core.X;
import foam.dao.DAO;
import foam.core.notification.Notification;
import foam.core.notification.email.EmailMessage;
import java.util.List;

public class WelcomeEmailTest extends Test {
    @Override
    public void runTest() {
        // Create test notification
        Notification notification = new Notification();
        notification.setTemplate("welcome-notification");
        notification.setEmailName("welcome-email");
        notification.setBody("Test welcome message");
        notification.setUserId(testUserId);

        // Save notification
        ((DAO) x.get("notificationDAO")).put_(x, notification);

        // Verify email was sent
        DAO emailMessageDAO = (DAO) x.get("emailMessageDAO");
        List<EmailMessage> messages = (List) ((ArraySink) emailMessageDAO.select(new ArraySink())).getArray();
        
        // Add your assertions here
    }
}
```

**Example from Foam**: See `foam3/src/foam/core/notification/test/EmailNotificationTest.java` for a complete test example.

## Troubleshooting

### Common Issues and Solutions

1. **Emails Not Sending**
   - Check SMTP configuration in `emailServiceConfig.jrl`
   - Verify user email settings are enabled
   - Check user lifecycle state
   - Verify template exists and is enabled
   - Check notification DAO logs

2. **Template Variables Not Working**
   - Ensure all required variables are provided in emailArgs
   - Check template syntax
   - Verify template locale matches user settings
   - Check notification DAO for template resolution issues

3. **Rate Limiting Issues**
   - Adjust rateLimit in EmailServiceConfig
   - Check SMTP provider limits
   - Monitor email sending logs
   - Implement rate limiting in your notification service if needed

### Debugging Tips

1. Enable debug logging in your email service configuration
2. Use the test configuration to verify your setup
3. Check the notification DAO logs for any errors
4. Verify all required templates and settings are properly configured

